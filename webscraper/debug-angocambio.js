const { chromium } = require('playwright');

(async () => {
    console.log('🔍 Debugging Angocambio.ao structure...\n');

    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();

    try {
        console.log('📡 Navigating to angocambio.ao/home...');
        await page.goto('https://angocambio.ao/home', { waitUntil: 'networkidle', timeout: 30000 });

        console.log('⏳ Waiting for content to load...');
        await page.waitForTimeout(8000);

        console.log('\n📄 Getting page HTML structure...');
        const bodyHTML = await page.evaluate(() => document.body.innerHTML);

        console.log('\n🔍 Searching for "Casa de Câmbio" and "Kinguila"...');
        const textContent = await page.evaluate(() => document.body.innerText);

        // Log relevant sections
        if (textContent.includes('Casa de Câmbio')) {
            console.log('✅ Found "Casa de Câmbio" in page');
        }
        if (textContent.includes('Kinguila')) {
            console.log('✅ Found "Kinguila" in page');
        }

        // Try to find specific elements
        console.log('\n🎯 Looking for rate elements...');

        // Look for all divs containing numbers that look like exchange rates
        const rateElements = await page.evaluate(() => {
            const elements = [];
            const allDivs = document.querySelectorAll('div, span, p, td, th');

            allDivs.forEach((el, index) => {
                const text = el.textContent.trim();
                // Look for numbers with format like 1203.983 or 1,203.98
                if (/\d{3,4}[.,]\d{2,3}/.test(text) && text.length < 50) {
                    elements.push({
                        index,
                        tagName: el.tagName,
                        className: el.className,
                        id: el.id,
                        text: text,
                        innerHTML: el.innerHTML.substring(0, 200)
                    });
                }
            });
            return elements.slice(0, 20); // Return first 20 matches
        });

        console.log('\n📊 Found potential rate elements:');
        console.log(JSON.stringify(rateElements, null, 2));

        // Get full page text to understand structure
        console.log('\n📝 Full page text (first 2000 chars):');
        console.log(textContent.substring(0, 2000));

        // Take screenshot
        await page.screenshot({ path: './public/angocambio_structure_debug.png', fullPage: true });
        console.log('\n📸 Screenshot saved to public/angocambio_structure_debug.png');

        console.log('\n⏸️  Browser will stay open for 30 seconds for manual inspection...');
        await page.waitForTimeout(30000);

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await browser.close();
        console.log('\n✅ Done!');
    }
})();
