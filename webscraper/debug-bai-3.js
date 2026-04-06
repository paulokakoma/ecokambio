const { chromium } = require('playwright');
(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto('https://bancobai.ao/pt/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5000);
    const html = await page.content();
    const hasUSD = html.includes('USD') || html.includes('Dólar');
    console.log("Homepage has USD:", hasUSD);
    if(hasUSD){
       const fs = require('fs');
       fs.writeFileSync('bai-home.html', html);
    }
    await browser.close();
})();
