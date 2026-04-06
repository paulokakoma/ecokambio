const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('https://bancobai.ao/pt/cambios-e-valores', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000); // wait for dynamic content
  const html = await page.content();
  const fs = require('fs');
  fs.writeFileSync('bai.html', html);
  console.log('Saved BAI HTML to bai.html');
  await browser.close();
})();
