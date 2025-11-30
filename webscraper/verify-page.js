const { chromium } = require('playwright');

(async () => {
    console.log('🔍 Verificando a exibição dos 5 bancos na página...\n');
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();

    await page.goto('http://localhost:3000/');
    await page.waitForTimeout(4000);

    // Verificar quais bancos estão sendo exibidos
    const banksDisplayed = await page.evaluate(() => {
        const headers = Array.from(document.querySelectorAll('h2'));
        return headers.map(h => h.textContent.trim());
    });

    console.log('📊 Bancos exibidos na página:');
    banksDisplayed.forEach((bank, idx) => {
        console.log(`  ${idx + 1}. ${bank}`);
    });

    // Verificar se "Dados não encontrados" aparece
    const notFoundMessages = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('p')).filter(p =>
            p.textContent.includes('Dados não encontrados')
        ).map(p => p.textContent.trim());
    });

    if (notFoundMessages.length > 0) {
        console.log('\n⚠️  Mensagens de "Dados não encontrados":');
        notFoundMessages.forEach(msg => console.log(`  - ${msg}`));
    } else {
        console.log('\n✅ Não há mensagens de "Dados não encontrados"');
    }

    // Capturar screenshot
    await page.screenshot({ path: 'verification-5-banks.png', fullPage: true });
    console.log('\n📸 Screenshot salvo: verification-5-banks.png');

    await browser.close();
    console.log('✅ Verificação completa');
})();
