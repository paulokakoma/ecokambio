const { chromium } = require('playwright');
(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto('https://www.bna.ao/#/', { waitUntil: 'networkidle' });
    
    const tables = await page.evaluate(() => {
        const results = [];
        document.querySelectorAll('table').forEach(t => {
            if (t.innerText.includes('BAI')) {
                results.push(t.innerText);
            }
        });
        return results;
    });
    
    console.log("Tables containing BAI on BNA page:");
    console.log(tables.join('\n\n'));
    await browser.close();
})();
