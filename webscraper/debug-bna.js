const puppeteer = require('puppeteer');

(async () => {
    console.log('🔍 Debugging BNA Puppeteer Extraction...');
    const browser = await puppeteer.launch({ headless: false }); // Use headless: false to see what's happening
    const page = await browser.newPage();

    try {
        await page.goto('https://www.bna.ao', { waitUntil: 'networkidle2' });
        console.log('✅ Page loaded');

        await page.waitForSelector('table', { timeout: 15000 });
        console.log('✅ Table selector found');

        const data = await page.evaluate(() => {
            const tables = Array.from(document.querySelectorAll('table'));
            return tables.map((t, i) => {
                const rows = t.querySelectorAll('tr');
                const firstRow = rows[0] ? rows[0].innerText : 'No rows';
                return {
                    index: i,
                    rowCount: rows.length,
                    firstRowText: firstRow,
                    html: t.outerHTML.substring(0, 200) + '...'
                };
            });
        });

        console.log('📊 Tables found:', data);

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await browser.close();
    }
})();
