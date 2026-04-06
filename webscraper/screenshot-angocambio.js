const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('https://angocambio.ao/home', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(8000);
  await page.screenshot({ path: '/tmp/angocambio.png', fullPage: true });
  await browser.close();
})();
