const { PuppeteerCrawler, Dataset } = require('crawlee');
const { writeFile } = require('fs/promises');
const path = require('path');

// Rotate user agents to avoid detection
const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
];

const getRandomUserAgent = () => userAgents[Math.floor(Math.random() * userAgents.length)];

// Targets – same as Crawlee scraper
const targets = [
    { url: 'https://bancobai.ao/pt/cambios-e-valores', label: 'BAI' },
    { url: 'https://www.bfa.ao/pt/particulares/', label: 'BFA' },
    { url: 'https://www.bancobic.ao/inicio/particulares/index', label: 'BIC' },
    { url: 'https://www.bna.ao', label: 'BNA' },
    // BCI: Use homepage and navigate to rates (more reliable than direct URL)
    { url: 'https://www.bci.ao/', label: 'BCI' },
    { url: 'https://www.bancoyetu.ao', label: 'YETU' },
];

(async () => {
    console.log('🚀 Starting Cron Scraper...');

    const crawler = new PuppeteerCrawler({
        // Critical for Docker environments + stealth options
        launchContext: {
            launchOptions: {
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-blink-features=AutomationControlled',
                    '--disable-infobars',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--window-size=1920,1080'
                ],
                ignoreHTTPSErrors: true
            }
        },
        // Retry configuration for failed requests
        maxRequestRetries: 5, // Increased retries
        requestHandlerTimeoutSecs: 240, // Increased timeout
        navigationTimeoutSecs: 90, // Default navigation timeout

        // Add delay between retries to avoid rate limiting
        retryOnBlocked: true,

        preNavigationHooks: [async ({ page, request }) => {
            const userAgent = getRandomUserAgent();

            // Set user agent
            await page.setUserAgent(userAgent);

            // Set realistic viewport
            await page.setViewport({ width: 1920, height: 1080 });

            // Set extra HTTP headers to look more like a real browser
            await page.setExtraHTTPHeaders({
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'pt-PT,pt;q=0.9,en-US;q=0.8,en;q=0.7',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Sec-Fetch-User': '?1',
                'Cache-Control': 'max-age=0'
            });

            // Hide webdriver flag
            await page.evaluateOnNewDocument(() => {
                Object.defineProperty(navigator, 'webdriver', { get: () => false });
                Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
                Object.defineProperty(navigator, 'languages', { get: () => ['pt-PT', 'pt', 'en-US', 'en'] });
            });
        }],

        async requestHandler({ request, page, log }) {
            const { label } = request.userData;
            log.info(`Processing ${label} – ${request.url}`);
            let rates = [];
            try {
                if (label === 'BAI') {
                    // Try to wait for page load fully
                    await page.waitForNetworkIdle({ timeout: 15000 }).catch(() => { });
                    
                    const selectors = ['table.table-striped', 'table', '.cambio', '.taxas', '[class*="rate"]', '[class*="cambio"]'];
                    let foundSelector = null;

                    for (const selector of selectors) {
                        try {
                            await page.waitForSelector(selector, { timeout: 5000 });
                            foundSelector = selector;
                            log.info(`BAI: Found selector: ${selector}`);
                            break;
                        } catch (e) {}
                    }

                    rates = await page.evaluate(() => {
                        const results = [];
                        // Strategy 1: Find tables
                        document.querySelectorAll('table').forEach(table => {
                            const rows = table.querySelectorAll('tr');
                            rows.forEach(row => {
                                const cols = row.querySelectorAll('td, th');
                                if (cols.length >= 2) {
                                    const currency = cols[0]?.innerText.trim().replace(/\n/g, ' ').split(' ')[0];
                                    let sell = null;
                                    // BAI usually has: Moeda | Compra Notas | Venda Notas | Compra Transf | Venda Transf
                                    if (cols.length >= 4) sell = cols[3]?.innerText.trim();
                                    else if (cols.length >= 2) sell = cols[cols.length-1]?.innerText.trim();
                                    
                                    if (currency && ['USD', 'EUR', 'ZAR', 'GBP'].includes(currency) && sell) {
                                        results.push({ bank: 'BAI', currency, sell });
                                    }
                                }
                            });
                        });

                        // Strategy 2: Text fallback (Regex) if tables didn't yield
                        if (results.length === 0) {
                            const allText = document.body.innerText;
                            const usdMatch = allText.match(/USD[^\d]*?(\d{2,}[,.]\d{2,})/i);
                            const eurMatch = allText.match(/EUR[^\d]*?(\d{2,}[,.]\d{2,})/i);
                            
                            if (usdMatch) results.push({ bank: 'BAI', currency: 'USD', sell: usdMatch[1] });
                            if (eurMatch) results.push({ bank: 'BAI', currency: 'EUR', sell: eurMatch[1] });
                        }
                        
                        return results;
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
                    // BCI: Wait longer and try to find rates on homepage
                    log.info('BCI: Waiting for page to fully load...');

                    // Wait for page load
                    await page.waitForNetworkIdle({ timeout: 30000 }).catch(() => { });

                    // Try multiple selectors for BCI rates
                    const selectors = ['table', '.exchange-rates', '.cambio', '.taxas', '[class*="rate"]', '[class*="cambio"]'];
                    let foundSelector = null;

                    for (const selector of selectors) {
                        try {
                            await page.waitForSelector(selector, { timeout: 5000 });
                            foundSelector = selector;
                            log.info(`BCI: Found selector: ${selector}`);
                            break;
                        } catch (e) {
                            // Continue trying
                        }
                    }

                    if (foundSelector) {
                        rates = await page.evaluate(() => {
                            const results = [];

                            // Try to find exchange rate information in tables
                            const tables = document.querySelectorAll('table');
                            tables.forEach(table => {
                                const rows = table.querySelectorAll('tr');
                                rows.forEach(row => {
                                    const cols = row.querySelectorAll('td');
                                    if (cols.length >= 3) {
                                        const currency = cols[0]?.innerText.trim();
                                        const sell = cols[2]?.innerText.trim();
                                        if (currency && sell && ['USD', 'EUR', 'ZAR', 'GBP'].some(c => currency.includes(c))) {
                                            results.push({
                                                bank: 'BCI',
                                                currency: currency.split(' ')[0], // Get just the currency code
                                                sell: sell
                                            });
                                        }
                                    }
                                });
                            });

                            // Also try to find rates in text elements
                            const allText = document.body.innerText;
                            const usdMatch = allText.match(/USD[^\d]*(\d+[,.]\d+)/i);
                            const eurMatch = allText.match(/EUR[^\d]*(\d+[,.]\d+)/i);

                            if (usdMatch && results.length === 0) {
                                results.push({ bank: 'BCI', currency: 'USD', sell: usdMatch[1] });
                            }
                            if (eurMatch && results.length === 0) {
                                results.push({ bank: 'BCI', currency: 'EUR', sell: eurMatch[1] });
                            }

                            return results;
                        });
                    } else {
                        log.warn('BCI: No exchange rate selectors found, skipping');
                    }
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
            ...(t.label === 'BCI' && { navigationTimeoutSecs: 180 }), // Extra time for BCI
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
