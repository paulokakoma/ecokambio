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
            await page.waitForTimeout(8000); // Extra wait for Angular to render (increased from 5s to 8s)

            log.info('Page loaded. Extracting rates...');

            // Extract rates from the page using text-based section identification
            const data = await page.evaluate(() => {
                const results = {
                    casaCambio: {},
                    kinguila: {}
                };

                // Get all text content and split by lines
                const allText = document.body.innerText;
                const lines = allText.split('\n').map(line => line.trim());

                // Find Casa de Câmbio section
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];

                    if (line === 'Casa de Câmbio') {
                        // Look at next 10 lines for USD and EUR rates
                        const nextLines = lines.slice(i, i + 15).join(' ');
                        // Extract all numbers with pattern \d+\.\d+ (e.g., 1058.045)
                        const rates = nextLines.match(/\d+\.\d+/g);
                        if (rates && rates.length >= 2) {
                            // First rate is USD, second is EUR
                            results.casaCambio.usd = parseFloat(rates[0]);
                            results.casaCambio.eur = parseFloat(rates[1]);
                        }
                    }

                    if (line === 'Kinguila') {
                        // Look at next 10 lines for USD and EUR rates
                        const nextLines = lines.slice(i, i + 15).join(' ');
                        const rates = nextLines.match(/\d+\.\d+/g);
                        if (rates && rates.length >= 2) {
                            // First rate is USD, second is EUR
                            results.kinguila.usd = parseFloat(rates[0]);
                            results.kinguila.eur = parseFloat(rates[1]);
                        }
                    }
                }

                return results;
            });

            // Fallback: Take screenshot for debugging
            await page.screenshot({
                path: path.join(process.cwd(), 'public', 'angocambio_debug.png'),
                fullPage: true
            });

            // Note: angocambio.ao doesn't separate buy/sell rates
            // We'll use the single value for both buy and sell
            if (data.kinguila.usd) {
                results.kinguila.usd_sell = data.kinguila.usd;
                results.kinguila.usd_buy = data.kinguila.usd;
            }
            if (data.kinguila.eur) {
                results.kinguila.eur_sell = data.kinguila.eur;
                results.kinguila.eur_buy = data.kinguila.eur;
            }
            if (data.casaCambio.usd) {
                results.casaCambio.usd_sell = data.casaCambio.usd;
                results.casaCambio.usd_buy = data.casaCambio.usd;
            }
            if (data.casaCambio.eur) {
                results.casaCambio.eur_sell = data.casaCambio.eur;
                results.casaCambio.eur_buy = data.casaCambio.eur;
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
