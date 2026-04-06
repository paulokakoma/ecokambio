const { chromium } = require('playwright');
(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto('https://bancobai.ao/pt/cambios-e-valores', { waitUntil: 'load' });
    
    // Wait an extra 8 seconds to allow React/Angular to mount fully
    await page.waitForTimeout(8000);
    
    const textData = await page.evaluate(() => {
        // Find elements with "compra" or "venda", or "taxa"
        const elements = Array.from(document.querySelectorAll('*'));
        let snippets = [];
        for (let el of elements) {
            if (el.children.length === 0 && el.innerText) {
                const txt = el.innerText.toLowerCase();
                if (txt.includes('venda') || txt.includes('compra') || txt.includes('eur') || txt.includes('dolar') || txt.includes('cambio')) {
                    snippets.push(txt);
                }
            }
        }
        return snippets;
    });
    
    console.log("Snippets containing relevant keywords:");
    console.log(textData);
    await browser.close();
})();
