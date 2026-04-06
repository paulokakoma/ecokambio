const { chromium } = require('playwright');
(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto('https://www.bna.ao/#/', { waitUntil: 'networkidle' });
    const html = await page.content();
    console.log("BNA page fetched. Does it contain BAI?", html.includes('BAI'));
    await browser.close();
})();
