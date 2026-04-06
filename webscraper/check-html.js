const { chromium } = require('playwright');
(async () => {
  try {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto('https://angocambio.ao/home', { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(8000);
    const html = await page.content();
    console.log("HTML length:", html.length);
    console.log("Has ZAR?", html.toUpperCase().includes('ZAR'));
    console.log("Has BRL?", html.toUpperCase().includes('BRL'));
    console.log("Has REAL?", html.toUpperCase().includes('REAL'));
    console.log("Has RAND?", html.toUpperCase().includes('RAND'));
    console.log("Has GBP?", html.toUpperCase().includes('GBP'));
    console.log("Has LIBRA?", html.toUpperCase().includes('LIBRA'));
    await browser.close();
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
