const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
    console.log('Launching browser...');
    // Add realistic headers and stealth flags
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 }
    });
    
    const page = await context.newPage();
    
    console.log('Navigating to BAI...');
    await page.goto('https://bancobai.ao/pt/cambios-e-valores', { waitUntil: 'domcontentloaded' });
    
    console.log('Waiting for USD to appear on the page...');
    let found = false;
    for (let i = 0; i < 30; i++) {
        await page.waitForTimeout(1000);
        const hasUSD = await page.evaluate(() => document.body.innerText.includes('USD'));
        if (hasUSD) {
            console.log(`Found USD after ${i} seconds!`);
            found = true;
            break;
        }
    }
    
    if (found) {
        // Evaluate the DOM and find the table
        const tableHtml = await page.evaluate(() => {
            // Find the element containing 'USD' that has children that look like rates
            const tables = Array.from(document.querySelectorAll('table'));
            if (tables.length > 0) return tables.map(t => t.outerHTML).join('\n');
            
            // If no table, find the closest container
            const elementsWithUSD = Array.from(document.querySelectorAll('div, span, li')).filter(e => e.innerText.includes('USD'));
            for (let el of elementsWithUSD) {
                // Return the html of a parent that has some size
                if (el.parentElement && el.parentElement.innerText.includes('EUR')) {
                    return el.parentElement.parentElement.outerHTML;
                }
            }
            return 'Could not find parent table/container for USD';
        });
        fs.writeFileSync('bai-table.html', tableHtml);
        console.log('Saved table structure to bai-table.html');
    } else {
        console.log('USD did not appear on the page within 30 seconds.');
        const html = await page.content();
        fs.writeFileSync('bai-dump.html', html);
    }
    
    await browser.close();
})();
