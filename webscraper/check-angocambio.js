const { chromium } = require('playwright');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto('https://angocambio.ao/home', { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(8000);
    const data = await page.evaluate(() => {
        const text = document.body.innerText;
        return text;
    });
    console.log("Extracted body text fragment:");
    // Print lines containing Casa de Câmbio and Kinguila and the 20 lines after them
    const lines = data.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    for(let i=0; i<lines.length; i++) {
        if(lines[i].includes('Casa de Câmbio') || lines[i].includes('Kinguila')) {
            console.log("---- FOUND SECTION ----");
            console.log(lines.slice(i, i+30).join('\n'));
        }
    }
    await browser.close();
})();
