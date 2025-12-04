const { PlaywrightCrawler } = require('crawlee');
const { writeFile } = require('fs/promises');
const path = require('path');

/**
 * Scraper for angocambio.ao - Informal Market Rates
 * Extracts Casa de Câmbio and Kinguila rates (buy and sell)
 */

(async () => {
    console.log('🚀 Starting Angocambio Informal Market Scraper...');

    const results = {
        casaCambio: { usd_buy: null, usd_sell: null, eur_buy: null, eur_sell: null },
        kinguila: { usd_buy: null, usd_sell: null, eur_buy: null, eur_sell: null }
    };

    const crawler = new PlaywrightCrawler({
        launchContext: {
            launchOptions: {
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            }
        },
        maxRequestRetries: 2,
        requestHandlerTimeoutSecs: 120,

        async requestHandler({ page, log }) {
            log.info('Loading angocambio.ao/home...');

            // Wait for page to load
            await page.waitForLoadState('networkidle', { timeout: 30000 });
            await page.waitForTimeout(5000); // Extra wait for Angular to render

            log.info('Page loaded. Extracting rates...');

            // Extract rates from the page
            const data = await page.evaluate(() => {
                const extractRate = (text) => {
                    if (!text) return null;
                    // Remove currency symbols and whitespace, replace comma with dot
                    const cleaned = text.replace(/[^\d,\.]/g, '').replace(',', '.');
                    const value = parseFloat(cleaned);
                    return isNaN(value) ? null : value;
                };

                // Try to find rate sections
                // The page structure shows rates in a table-like format
                // We need to identify Casa de Câmbio and Kinguila sections

                const results = {
                    casaCambio: {},
                    kinguila: {}
                };

                // Look for text content containing "Casa de Câmbio" or "Kinguila"
                const allText = document.body.innerText;

                // Extract using regex patterns (this is a fallback approach)
                // Format appears to be: USD 1203.983 / EUR 1401.195 for Kinguila

                // This is a simplified extraction - may need adjustment based on actual DOM
                const sections = document.querySelectorAll('[class*="rate"], [class*="cambio"], [class*="box"]');

                sections.forEach(section => {
                    const text = section.innerText || '';

                    if (text.includes('Kinguila') || text.includes('kinguila')) {
                        // Extract Kinguila rates
                        const matches = text.match(/(\d+[.,]\d+)/g);
                        if (matches && matches.length >= 2) {
                            results.kinguila.usd = extractRate(matches[0]);
                            results.kinguila.eur = extractRate(matches[1]);
                        }
                    }

                    if (text.includes('Casa de Câmbio') || text.includes('Casa de Cambio')) {
                        // Extract Casa de Câmbio rates
                        const matches = text.match(/(\d+[.,]\d+)/g);
                        if (matches && matches.length >= 2) {
                            results.casaCambio.usd = extractRate(matches[0]);
                            results.casaCambio.eur = extractRate(matches[1]);
                        }
                    }
                });

                return results;
            });

            // Fallback: Take screenshot for debugging
            await page.screenshot({
                path: path.join(process.cwd(), 'public', 'angocambio_debug.png'),
                fullPage: true
            });

            // Note: Since angocambio.ao doesn't show buy/sell separately,
            // we'll use the single value as the sell rate and estimate buy as 98% of sell
            if (data.kinguila.usd) {
                results.kinguila.usd_sell = data.kinguila.usd;
                results.kinguila.usd_buy = data.kinguila.usd * 0.98; // Estimate 2% spread
            }
            if (data.kinguila.eur) {
                results.kinguila.eur_sell = data.kinguila.eur;
                results.kinguila.eur_buy = data.kinguila.eur * 0.98;
            }
            if (data.casaCambio.usd) {
                results.casaCambio.usd_sell = data.casaCambio.usd;
                results.casaCambio.usd_buy = data.casaCambio.usd * 0.98;
            }
            if (data.casaCambio.eur) {
                results.casaCambio.eur_sell = data.casaCambio.eur;
                results.casaCambio.eur_buy = data.casaCambio.eur * 0.98;
            }

            log.info('✅ Extraction complete', results);
        },

        failedRequestHandler({ request, log }) {
            log.error(`Request failed for ${request.url}`);
        }
    });

    await crawler.run(['https://angocambio.ao/home']);

    console.log('📊 Scraped Results:', JSON.stringify(results, null, 2));

    // Save to Supabase
    try {
        const supabase = require('../src/config/supabase');
        console.log('📡 Sending data to Supabase...');

        // Get provider IDs
        const { data: providers, error: providerError } = await supabase
            .from('rate_providers')
            .select('id, code')
            .eq('type', 'INFORMAL');

        if (providerError) {
            console.error('❌ Error fetching providers:', providerError);
            process.exit(1);
        }

        const casaId = providers.find(p => p.code === 'CASA_CAMBIO')?.id;
        const kinguilaId = providers.find(p => p.code === 'KINGUILA')?.id;

        if (!casaId || !kinguilaId) {
            console.error('❌ Providers not found. Run migration first!');
            process.exit(1);
        }

        // Prepare upsert data
        const ratesToUpsert = [];

        if (results.casaCambio.usd_buy && results.casaCambio.usd_sell) {
            ratesToUpsert.push({
                provider_id: casaId,
                currency_pair: 'USD/AOA',
                buy_rate: results.casaCambio.usd_buy,
                sell_rate: results.casaCambio.usd_sell,
                updated_at: new Date().toISOString()
            });
        }

        if (results.casaCambio.eur_buy && results.casaCambio.eur_sell) {
            ratesToUpsert.push({
                provider_id: casaId,
                currency_pair: 'EUR/AOA',
                buy_rate: results.casaCambio.eur_buy,
                sell_rate: results.casaCambio.eur_sell,
                updated_at: new Date().toISOString()
            });
        }

        if (results.kinguila.usd_buy && results.kinguila.usd_sell) {
            ratesToUpsert.push({
                provider_id: kinguilaId,
                currency_pair: 'USD/AOA',
                buy_rate: results.kinguila.usd_buy,
                sell_rate: results.kinguila.usd_sell,
                updated_at: new Date().toISOString()
            });
        }

        if (results.kinguila.eur_buy && results.kinguila.eur_sell) {
            ratesToUpsert.push({
                provider_id: kinguilaId,
                currency_pair: 'EUR/AOA',
                buy_rate: results.kinguila.eur_buy,
                sell_rate: results.kinguila.eur_sell,
                updated_at: new Date().toISOString()
            });
        }

        console.log(`📊 Upserting ${ratesToUpsert.length} rates...`);

        const { error } = await supabase
            .from('exchange_rates')
            .upsert(ratesToUpsert, {
                onConflict: 'provider_id,currency_pair',
                ignoreDuplicates: false
            });

        if (error) {
            console.error('❌ Error upserting into Supabase:', error);
            process.exit(1);
        }

        console.log('✅ Data successfully saved to Supabase!');
        console.log(`   - Total rates: ${ratesToUpsert.length}`);
        process.exit(0);

    } catch (error) {
        console.error('❌ Error during save process:', error);
        process.exit(1);
    }
})();
