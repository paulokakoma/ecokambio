const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
    console.log('Launching browser to capture all JSON requests...');
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    // Stealth options
    await page.setExtraHTTPHeaders({
        'Accept-Language': 'pt-PT,pt;q=0.9,en-US;q=0.8,en;q=0.7',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    const responses = [];

    page.on('response', async (response) => {
        const url = response.url();
        const type = response.request().resourceType();
        if (type === 'xhr' || type === 'fetch' || url.includes('.json')) {
            try {
                const text = await response.text();
                if (text.includes('USD') || text.includes('EUR') || text.includes('venda') || text.includes('cambio')) {
                    responses.push({ url, text: text.substring(0, 1000) });
                }
            } catch (e) {
                // Ignore bodies we can't read
            }
        }
    });

    try {
        await page.goto('https://bancobai.ao/pt/cambios-e-valores', { waitUntil: 'networkidle', timeout: 30000 });
        await page.waitForTimeout(5000); // Give it extra time
    } catch(e) {
        console.log("Navigation timeout or error:", e.message);
    }
    
    console.log(`Captured ${responses.length} relevant XHR/Fetch JSON responses.`);
    responses.forEach((r, i) => {
        console.log(`\n=== API RESPONSE ${i+1} === `);
        console.log(`URL: ${r.url}`);
        console.log(`BODY: ${r.text}`);
    });
    
    // Also check local storage / session storage
    const storage = await page.evaluate(() => JSON.stringify(window.localStorage));
    if (storage.includes('USD') || storage.includes('cambio')) {
        console.log("\nFound in localStorage:", storage.substring(0, 500));
    }
    
    await browser.close();
})();
