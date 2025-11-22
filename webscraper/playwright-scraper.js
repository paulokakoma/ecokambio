const { chromium } = require('playwright');

async function scrapeBankNamesWithPlaywright() {
  console.log('Iniciando o navegador (Chromium)...');
  const browser = await chromium.launch();
  const page = await browser.newPage();

  const localFilePath = `file://${process.cwd()}/public/index.html`;
  console.log(`Navegando para: ${localFilePath}`);
  await page.goto(localFilePath);

  console.log('Página carregada. Aguardando e extraindo dados...');

  // O Playwright espera automaticamente pelo seletor.
  // Usamos um "locator" para encontrar os elementos.
  const bankCodesLocator = page.locator('#formal-market-grid .font-bold.text-lg');

  // Espera até que pelo menos um elemento apareça
  await bankCodesLocator.first().waitFor();

  // Pega o texto de todos os elementos correspondentes
  const bankNames = await bankCodesLocator.allTextContents();

  console.log('Nomes dos bancos (Mercado Formal):', bankNames);

  await browser.close();
  console.log('Navegador fechado.');
}

scrapeBankNamesWithPlaywright().catch(error => {
  console.error('Ocorreu um erro durante o scraping com Playwright:', error);
});
