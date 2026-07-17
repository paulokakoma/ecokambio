
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('http://localhost:3000/adminflix');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: '/tmp/partners-before.png', fullPage: false });
  console.log('Screenshot saved');
  await browser.close();
})();
