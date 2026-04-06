const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('https://angocambio.ao/home', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(5000);
  const text = await page.innerText('body');
  console.log(text);
  await browser.close();
})();
