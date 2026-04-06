const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    console.log("Loading BNA...");
    await page.goto('https://www.bna.ao/#/', { waitUntil: 'load' });
    await page.waitForTimeout(5000);
    
    // some angular sites need to click a menu, or wait for tables
    const tableTexts = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('table')).map(t => t.innerText);
    });
    
    console.log(`Found ${tableTexts.length} tables.`);
    tableTexts.forEach((t, i) => {
        console.log(`\nTable ${i+1}:\n${t.substring(0, 300)}`);
    });
    
    await browser.close();
})();
