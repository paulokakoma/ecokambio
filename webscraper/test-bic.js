const { chromium } = require('playwright');

(async () => {
    console.log('🔍 Investigating Banco BIC page...');
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();

    await page.goto('https://www.bancobic.ao/inicio/particulares/index');
    await page.waitForTimeout(3000);

    // Search for elements containing "câmbio", "taxa", or currency codes
    const html = await page.content();

    // Check for common exchange rate patterns
    const patterns = [
        'table',
        '[class*="cambio"]',
        '[class*="exchange"]',
        '[class*="taxa"]',
        '[class*="rate"]',
    ];

    for (const pattern of patterns) {
        const elements = await page.$$(pattern);
        if (elements.length > 0) {
            console.log(`\n✓ Found ${elements.length} elements matching: ${pattern}`);
            for (let i = 0; i < Math.min(elements.length, 3); i++) {
                const text = await elements[i].textContent();
                const shortText = text.substring(0, 200);
                console.log(`  [${i}] ${shortText}...`);
            }
        }
    }

    // Look for specific currency codes
    console.log('\n🔍 Searching for currency codes in page...');
    const currencies = ['USD', 'EUR', 'GBP', 'JPY', 'NAD', 'NOK', 'SEK'];
    for (const currency of currencies) {
        const matches = html.match(new RegExp(currency, 'g'));
        if (matches) {
            console.log(`  ✓ Found ${matches.length} occurrences of ${currency}`);
        }
    }

    // Take screenshot
    await page.screenshot({ path: 'bic-investigation.png', fullPage: true });
    console.log('\n📸 Screenshot saved as bic-investigation.png');

    await browser.close();
    console.log('✅ Investigation complete');
})();
