const { chromium } = require('playwright');

(async () => {
    console.log('🔍 Detailed structure analysis...\n');
    const browser = await chromium.launch({ headless: false });

    // --- BNA ---
    console.log('📍 BNA Analysis');
    const pageBNA = await browser.newPage();
    await pageBNA.goto('https://www.bna.ao');
    await pageBNA.waitForTimeout(4000);

    // Try to find exchange rate data
    const bnaData = await pageBNA.evaluate(() => {
        // Look for all tables
        const tables = Array.from(document.querySelectorAll('table'));
        return tables.map((table, idx) => {
            const rows = Array.from(table.querySelectorAll('tr'));
            const preview = rows.slice(0, 3).map(row => {
                const cells = Array.from(row.querySelectorAll('td, th'));
                return cells.map(cell => cell.textContent.trim()).join(' | ');
            }).join('\\n  ');
            return `Table ${idx}: ${rows.length} rows\n  ${preview}`;
        });
    });

    console.log('Tables found:');
    bnaData.forEach(table => console.log(table));

    // --- BCI ---
    console.log('\n📍 BCI Analysis');
    const pageBCI = await browser.newPage();
    await pageBCI.goto('https://www.bci.ao/particular/conversor-de-moeda');
    await pageBCI.waitForTimeout(4000);

    const bciData = await pageBCI.evaluate(() => {
        // Look for all tables
        const tables = Array.from(document.querySelectorAll('table'));
        return tables.map((table, idx) => {
            const rows = Array.from(table.querySelectorAll('tr'));
            const preview = rows.slice(0, 5).map(row => {
                const cells = Array.from(row.querySelectorAll('td, th'));
                return cells.map(cell => cell.textContent.trim()).join(' | ');
            }).join('\\n  ');
            return `Table ${idx}: ${rows.length} rows\n  ${preview}`;
        });
    });

    console.log('Tables found:');
    bciData.forEach(table => console.log(table));

    await browser.close();
    console.log('\n✅ Analysis complete');
})();
