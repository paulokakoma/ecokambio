const { PuppeteerCrawler, Dataset } = require('crawlee');

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
    console.log('🚀 Starting Review Scraper (Dry Run)...');

    const crawler = new PuppeteerCrawler({
        launchContext: {
            launchOptions: {
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            }
        },
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
                console.log(`✅ [${label}] Extracted ${valid.length} rates:`, valid);
            } catch (err) {
                console.error(`❌ [${label}] Error: ${err.message}`);
            }
        },
        failedRequestHandler({ request, log }) {
            console.error(`❌ Request failed for ${request.userData.label}: ${request.url}`);
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
    console.log('✅ Review completed');
})();
