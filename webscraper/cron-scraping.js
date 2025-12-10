const { PuppeteerCrawler, Dataset } = require('crawlee');
const { writeFile } = require('fs/promises');
const path = require('path');

// Targets – same as Crawlee scraper
const targets = [
    { url: 'https://bancobai.ao/pt/cambios-e-valores', label: 'BAI' },
    { url: 'https://www.bfa.ao/pt/particulares/', label: 'BFA' },
    { url: 'https://www.bancobic.ao/inicio/particulares/index', label: 'BIC' },
    { url: 'https://www.bna.ao', label: 'BNA' },
    { url: 'https://www.bci.ao/particular/conversor-de-moeda', label: 'BCI' },
    { url: 'https://www.bancoyetu.ao', label: 'YETU' },
];

(async () => {
    console.log('🚀 Starting Cron Scraper...');

    const crawler = new PuppeteerCrawler({
        // Critical for Docker environments
        launchContext: {
            launchOptions: {
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            }
        },
        // Retry configuration for failed requests
        maxRequestRetries: 3,
        requestHandlerTimeoutSecs: 180,
        preNavigationHooks: [async ({ page }) => {
            await page.setExtraHTTPHeaders({
                'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0.4844.82 Safari/537.36',
            });
        }],

        async requestHandler({ request, page, log }) {
            const { label } = request.userData;
            log.info(`Processing ${label} – ${request.url}`);
            let rates = [];
            try {
                if (label === 'BAI') {
                    await page.waitForSelector('table.table-striped', { timeout: 15000 });
                    rates = await page.evaluate(() => {
                        const rows = document.querySelectorAll('table.table-striped tbody tr');
                        return Array.from(rows, row => {
                            const cols = row.querySelectorAll('td');
                            const currency = cols[0]?.innerText.trim().split('\n')[0];
                            return { bank: 'BAI', currency, sell: cols[3]?.innerText.trim() };
                        });
                    });
                } else if (label === 'BFA') {
                    try {
                        await page.waitForSelector('.exchangeTaxes-table table', { timeout: 30000 });
                    } catch (e) {
                        log.error(`BFA table not found`);
                        throw e;
                    }
                    rates = await page.evaluate(() => {
                        const rows = document.querySelectorAll('.exchangeTaxes-table table tbody tr:not(:first-child)');
                        return Array.from(rows, row => ({
                            bank: 'BFA',
                            currency: row.querySelector('td.exchange-currency')?.innerText.trim(),
                            sell: row.querySelector('td.exchange-sell')?.innerText.trim(),
                        }));
                    });
                } else if (label === 'BIC') {
                    await page.waitForSelector('table', { timeout: 15000 });
                    rates = await page.evaluate(() => {
                        const rows = document.querySelectorAll('table tbody tr');
                        return Array.from(rows, row => {
                            const cols = row.querySelectorAll('td');
                            const currency = cols[0]?.innerText.trim();
                            const sell = cols[2]?.innerText.trim();
                            return { bank: 'BIC', currency, sell };
                        });
                    });
                } else if (label === 'BNA') {
                    await page.waitForSelector('table', { timeout: 15000 });
                    rates = await page.evaluate(() => {
                        const tables = Array.from(document.querySelectorAll('table'));
                        // Find the table that contains USD
                        const targetTable = tables.find(t => t.innerText.includes('USD'));

                        if (!targetTable) return [];

                        const rows = targetTable.querySelectorAll('tr');
                        return Array.from(rows, row => {
                            const cols = row.querySelectorAll('td');
                            if (cols.length >= 2) {
                                const currency = cols[0]?.innerText.trim();
                                const sell = cols[1]?.innerText.trim();
                                // Ensure it looks like a currency row
                                if (['USD', 'EUR', 'ZAR'].includes(currency)) {
                                    return {
                                        bank: 'BNA',
                                        currency,
                                        sell
                                    };
                                }
                            }
                            return null;
                        }).filter(r => r !== null);
                    });
                } else if (label === 'BCI') {
                    await page.waitForSelector('table', { timeout: 15000 });
                    rates = await page.evaluate(() => {
                        const table = document.querySelector('table');
                        const rows = table.querySelectorAll('tr');
                        return Array.from(rows, row => {
                            const cols = row.querySelectorAll('td');
                            if (cols.length >= 3) {
                                return {
                                    bank: 'BCI',
                                    currency: cols[0]?.innerText.trim(),
                                    sell: cols[2]?.innerText.trim()
                                };
                            }
                            return null;
                        }).filter(r => r !== null);
                    });
                } else if (label === 'YETU') {
                    await page.waitForSelector('span.text-white', { timeout: 15000 });
                    rates = await page.evaluate(() => {
                        const spans = Array.from(document.querySelectorAll('span.text-white'));
                        return spans.map(span => {
                            const text = span.innerText.trim();
                            const match = text.match(/^([A-Z]{3})\s*-\s*VENDA\s*-?([\d.,]+)/i);
                            if (match) {
                                return {
                                    bank: 'YETU',
                                    currency: match[1].toUpperCase(),
                                    sell: match[2].replace('-', '').trim()
                                };
                            }
                            return null;
                        }).filter(r => r !== null);
                    });
                }
                const valid = rates.filter(r => r.currency && r.sell);
                await Dataset.pushData(valid);
                log.info(`✅ Extracted ${valid.length} rates from ${label}`);
            } catch (err) {
                log.error(`❌ Error processing ${label}: ${err.message}`);
            }
        },
        failedRequestHandler({ request, log }) {
            log.error(`Request failed for ${request.userData.label}: ${request.url}`);
        },
    });

    await crawler.addRequests(
        targets.map(t => ({
            url: t.url,
            userData: { label: t.label },
            ...(t.label === 'BFA' && { navigationTimeoutSecs: 120 }),
            ...(t.label === 'BNA' && { navigationTimeoutSecs: 120 }),
        }))
    );

    await crawler.run();
    console.log('✅ Puppeteer scraping completed');

    // Helper function for bank-specific parsing
    function parseRate(rateStr, bankLabel) {
        if (!rateStr) return null;
        let cleanStr = rateStr.trim();
        try {
            if (bankLabel === 'BAI') {
                // BAI: "1.115,04560" -> 1115.04560 (European: dot thousands, comma decimal)
                cleanStr = cleanStr.replace(/\./g, '').replace(',', '.');
            } else if (bankLabel === 'BFA') {
                // BFA: "957.122" -> 957.122 (US-like: dot decimal)
                // No special replacement needed
            } else if (bankLabel === 'BNA') {
                // BNA: "911,545" or "1.055,843" (European: dot thousands, comma decimal)
                cleanStr = cleanStr.replace(/\./g, '').replace(',', '.');
            } else if (bankLabel === 'BIC') {
                // BIC: "911.5450" (US-like: dot decimal)
                // No special replacement needed
            } else if (bankLabel === 'BCI') {
                // BCI: Uses European format - "1.654,9865" (dot thousands, comma decimal)
                // Remove dots (thousands), replace comma with dot (decimal)
                if (cleanStr.includes('.') && cleanStr.includes(',')) {
                    // Has both: "1.654,9865" → remove dots, replace comma
                    cleanStr = cleanStr.replace(/\./g, '').replace(',', '.');
                } else if (cleanStr.includes(',')) {
                    // Only comma: "1654,98" → replace comma with dot
                    cleanStr = cleanStr.replace(',', '.');
                }
                // If only dots or no separators, leave as-is
            } else if (bankLabel === 'YETU') {
                // YETU: "890,00" -> 890.00
                cleanStr = cleanStr.replace(',', '.');
            }
            const rate = parseFloat(cleanStr);
            return isNaN(rate) ? null : rate;
        } catch (e) {
            return null;
        }
    }

    // Save results to public folder (Optional for Worker, but good for debugging/logs)
    try {
        const { items } = await Dataset.getData();
        const allRates = items.flat();

        // Normalize rates for JSON output (User wants comma decimal: "911,00")
        const normalizedRates = allRates.map(rate => {
            const parsed = parseRate(rate.sell, rate.bank);
            if (parsed !== null) {
                // Format with comma decimal, preserve original precision if possible or default to string
                // Using pt-AO locale to ensure comma decimal
                return {
                    ...rate,
                    sell: parsed.toLocaleString('pt-AO', { useGrouping: false, minimumFractionDigits: 2, maximumFractionDigits: 10 })
                };
            }
            return rate; // Fallback to original if parsing fails
        });

        // Note: This file persists locally but not in serverless environments.
        // The primary source of truth is Supabase.
        const outputPath = path.join(process.cwd(), 'public', 'exchange_rates.json');
        const data = { lastUpdated: new Date().toISOString(), rates: normalizedRates };
        await writeFile(outputPath, JSON.stringify(data, null, 2));
        console.log(`💾 Data saved to ${outputPath}`);

        // --- Save to Supabase ---
        const supabase = require('../src/config/supabase'); // ✅ Fixed path
        console.log('📡 Sending data to Supabase...');

        // Get provider mappings for upsert
        const { data: providers, error: providerError } = await supabase
            .from('rate_providers')
            .select('id, code')
            .eq('type', 'FORMAL');

        if (providerError) {
            console.error('❌ Error fetching providers:', providerError);
            process.exit(1);
        }

        const providerMap = {};
        providers.forEach(p => {
            providerMap[p.code] = p.id;
        });

        // Transform scraper data to exchange_rates format
        const transformedRecords = [];
        allRates.forEach(rate => {
            const providerId = providerMap[rate.bank];
            if (!providerId) {
                console.warn(`⚠️ Provider ${rate.bank} not found in database, skipping`);
                return;
            }

            // Use specific parsing logic
            const sellRate = parseRate(rate.sell, rate.bank);

            if (sellRate === null) {
                console.warn(`⚠️ Invalid rate for ${rate.bank} ${rate.currency}: ${rate.sell}`);
                return;
            }

            // Validation: Check for numeric overflow (max 5,000)
            // AOA rates are typically around 900-1200. Anything above 5000 is likely a parsing error (e.g. missing decimal).
            if (sellRate > 5000) {
                console.warn(`⚠️ Rate too high for ${rate.bank} ${rate.currency}: ${sellRate} (ignoring to prevent overflow/bad data)`);
                return;
            }

            transformedRecords.push({
                provider_id: providerId,
                currency_pair: `${rate.currency}/AOA`,
                sell_rate: sellRate,
                updated_at: new Date().toISOString()
            });
        });

        console.log(`📊 Transformed ${transformedRecords.length} records for upsert`);

        // ✅ Deduplicate records (keep latest value for each provider_id + currency_pair)
        const deduplicatedRecords = [];
        const seen = new Set();

        // Iterate in reverse so we keep the LAST occurrence (most recent)
        for (let i = transformedRecords.length - 1; i >= 0; i--) {
            const record = transformedRecords[i];
            const key = `${record.provider_id}-${record.currency_pair}`;

            if (!seen.has(key)) {
                seen.add(key);
                deduplicatedRecords.unshift(record); // Add to front to maintain original order
            }
        }

        console.log(`🔍 Deduplicated: ${transformedRecords.length} → ${deduplicatedRecords.length} records`);

        // Upsert into exchange_rates table
        const { error } = await supabase
            .from('exchange_rates')
            .upsert(deduplicatedRecords, {
                onConflict: 'provider_id,currency_pair',
                ignoreDuplicates: false
            });

        if (error) {
            console.error('❌ Error upserting into Supabase:', error);
            process.exit(1);
        } else {
            console.log('✅ Data successfully saved to Supabase!');
            console.log(`   - Total rates: ${deduplicatedRecords.length}`);
            console.log(`   - Banks: ${[...new Set(allRates.map(r => r.bank))].join(', ')}`);
            process.exit(0);
        }
    } catch (error) {
        console.error('❌ Error during save process:', error);
        process.exit(1);
    }
})();
