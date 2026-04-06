const { chromium } = require('playwright');

(async () => {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // Stealth mode equivalents
  await page.setExtraHTTPHeaders({
      'Accept-Language': 'pt-PT,pt;q=0.9,en-US;q=0.8,en;q=0.7'
  });

  console.log('Navigating to BAI...');
  page.on('response', response => {
    const url = response.url();
    if (url.includes('api') || url.includes('cambio') || url.includes('json') || url.includes('rate')) {
       console.log('Network XHR/fetch:', url, response.status());
    }
  });

  await page.goto('https://bancobai.ao/pt/cambios-e-valores', { waitUntil: 'networkidle' });
  
  console.log('Taking a screenshot & getting text...');
  // Dump text matching USD if any
  const bodyText = await page.evaluate(() => document.body.innerText);
  console.log("Body text contains USD:", bodyText.includes('USD'));
  console.log("Body text contains Dólar:", bodyText.includes('Dólar'));
  
  if (bodyText.includes('USD') || bodyText.includes('Dólar')) {
    // Try to find the tables or items
    const elements = await page.evaluate(() => {
       const tds = Array.from(document.querySelectorAll('td, div, span'));
       return tds.filter(e => e.innerText.includes('USD') || e.innerText.includes('EUR') || e.innerText.includes('ZAR')).map(e => e.outerHTML).slice(0, 5);
    });
    console.log("Elements wrapping USD/EUR/ZAR:");
    elements.forEach(html => console.log(html.substring(0, 200)));
  } else {
    console.log("Content instead:");
    console.log(bodyText.substring(0, 500));
  }
  
  await browser.close();
})();
