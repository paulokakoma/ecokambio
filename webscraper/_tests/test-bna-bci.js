const { chromium } = require('playwright');

(async () => {
    console.log('🔍 Investigating BNA and BCI pages...');
    const browser = await chromium.launch({ headless: false });

    // --- BNA Investigation ---
    console.log('\n📍 BNA (Banco Nacional de Angola)');
    const page1 = await browser.newPage();
    await page1.goto('https://www.bna.ao');
    await page1.waitForTimeout(3000);

    // Search for exchange rate tables
    const bnaTables = await page1.$$('table');
    console.log(`  Found ${bnaTables.length} tables`);

    // Look for elements with "taxa" or "cambio"
    const html1 = await page1.content();
    const taxaMatches = html1.match(/taxa/gi);
    console.log(`  Found ${taxaMatches ? taxaMatches.length : 0} occurrences of "taxa"`);

    // Check for currency codes
    const currencies = ['USD', 'EUR', 'ZAR', 'GBP', 'JPY'];
    for (const currency of currencies) {
        const matches = html1.match(new RegExp(currency, 'g'));
        if (matches) {
            console.log(`  ✓ Found ${matches.length} occurrences of ${currency}`);
        }
    }

    await page1.screenshot({ path: 'bna-investigation.png', fullPage: true });
    console.log('  📸 Screenshot saved: bna-investigation.png');

    // --- BCI Investigation ---
    console.log('\n📍 BCI (Banco de Comércio e Indústria)');
    const page2 = await browser.newPage();
    await page2.goto('https://www.bci.ao/particular/conversor-de-moeda');
    await page2.waitForTimeout(3000);

    const bciTables = await page2.$$('table');
    console.log(`  Found ${bciTables.length} tables`);

    // Look for forms or converters
    const forms = await page2.$$('form');
    console.log(`  Found ${forms.length} forms`);

    const html2 = await page2.content();
    for (const currency of currencies) {
        const matches = html2.match(new RegExp(currency, 'g'));
        if (matches) {
            console.log(`  ✓ Found ${matches.length} occurrences of ${currency}`);
        }
    }

    await page2.screenshot({ path: 'bci-investigation.png', fullPage: true });
    console.log('  📸 Screenshot saved: bci-investigation.png');

    await browser.close();
    console.log('\n✅ Investigation complete');
})();
