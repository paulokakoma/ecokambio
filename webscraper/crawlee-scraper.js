const { PlaywrightCrawler, Dataset } = require('crawlee');
const { writeFile } = require('fs/promises');
const path = require('path');

// Define os alvos do nosso scraper.
// Cada objeto contém a URL e uma "etiqueta" para identificar o banco.
const targets = [
    { url: 'https://bancobai.ao/pt/cambios-e-valores', label: 'BAI' },
    { url: 'https://www.bfa.ao/pt/particulares/', label: 'BFA' },
    { url: 'https://www.bancobic.ao/inicio/particulares/index', label: 'BIC' },
    { url: 'https://www.bna.ao', label: 'BNA' },
    { url: 'https://www.bci.ao/particular/conversor-de-moeda', label: 'BCI' },
    { url: 'https://www.bancoyetu.ao', label: 'YETU' },
];



(async () => {
    console.log('🚀 Iniciando o scraper com Crawlee...');

    // O Crawlee v3 limpa o armazenamento padrão (em memória) a cada execução,
    // então a limpeza manual não é mais necessária para este caso de uso.
    // const dataset = await Dataset.open();
    // await dataset.drop();

    // Cria uma instância do PlaywrightCrawler.
    // Para usar Puppeteer, bastaria trocar para "new PuppeteerCrawler".
    const crawler = new PlaywrightCrawler({
        // Emula um navegador Chrome real para evitar ser bloqueado
        preNavigationHooks: [async ({ page }) => {
            await page.setExtraHTTPHeaders({
                'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0.4844.82 Safari/537.36',
            });
        }],

        // Esta função será executada para cada URL na fila.
        async requestHandler({ request, page, log }) {
            const { label } = request.userData;
            log.info(`Processando ${label} - ${request.url}`);

            let rates = [];

            try {
                if (label === 'BAI') {
                    // Lógica de extração para o Banco BAI
                    await page.waitForSelector('table.table-striped', { timeout: 15000 });
                    rates = await page.evaluate(() => {
                        const rows = document.querySelectorAll('table.table-striped tbody tr');
                        return Array.from(rows, (row) => {
                            const columns = row.querySelectorAll('td');
                            const currencyCode = columns[0]?.innerText.trim().split('\\n')[0];
                            return {
                                bank: 'BAI',
                                currency: currencyCode,
                                sell: columns[3]?.innerText.trim(),
                            };
                        });
                    });
                } else if (label === 'BFA') {
                    // Lógica de extração para o Banco BFA
                    try {
                        await page.waitForSelector('.exchangeTaxes-table table', { timeout: 30000 });
                    } catch (e) {
                        const screenshotPath = path.join(process.cwd(), 'bfa_error_screenshot.png');
                        await page.screenshot({ path: screenshotPath, fullPage: true });
                        log.error(`A tabela do BFA não foi encontrada. Um screenshot foi salvo em: ${screenshotPath}`);
                        throw e;
                    }

                    rates = await page.evaluate(() => {
                        const rows = document.querySelectorAll('.exchangeTaxes-table table tbody tr:not(:first-child)');
                        return Array.from(rows, (row) => ({
                            bank: 'BFA',
                            currency: row.querySelector('td.exchange-currency')?.innerText.trim(),
                            sell: row.querySelector('td.exchange-sell')?.innerText.trim(),
                        }));
                    });
                } else if (label === 'BIC') {
                    // Lógica de extração para o Banco BIC
                    await page.waitForSelector('table', { timeout: 15000 });
                    rates = await page.evaluate(() => {
                        const rows = document.querySelectorAll('table tbody tr');
                        return Array.from(rows, (row) => {
                            const columns = row.querySelectorAll('td');
                            // Coin | Compra | Venda
                            const currency = columns[0]?.innerText.trim();
                            const sell = columns[2]?.innerText.trim();
                            return {
                                bank: 'BIC',
                                currency,
                                sell,
                            };
                        });
                    });
                } else if (label === 'BNA') {
                    // Lógica de extração para o Banco BNA
                    await page.waitForSelector('table', { timeout: 15000 });
                    rates = await page.evaluate(() => {
                        // BNA: First table has currency exchange rates (USD | 912,085)
                        const table = document.querySelector('table');
                        const rows = table.querySelectorAll('tr');
                        return Array.from(rows, (row) => {
                            const columns = row.querySelectorAll('td');
                            if (columns.length >= 2) {
                                const currency = columns[0]?.innerText.trim();
                                const sell = columns[1]?.innerText.trim();
                                return {
                                    bank: 'BNA',
                                    currency,
                                    sell,
                                };
                            }
                            return null;
                        }).filter(rate => rate !== null);
                    });
                } else if (label === 'BCI') {
                    // Lógica de extração para o Banco BCI
                    await page.waitForSelector('table', { timeout: 15000 });
                    rates = await page.evaluate(() => {
                        // BCI: Table with Moeda | Compra | Venda
                        const table = document.querySelector('table');
                        const rows = table.querySelectorAll('tr');
                        return Array.from(rows, (row) => {
                            const columns = row.querySelectorAll('td');
                            if (columns.length >= 3) {
                                const currency = columns[0]?.innerText.trim();
                                const sell = columns[2]?.innerText.trim();
                                return {
                                    bank: 'BCI',
                                    currency,
                                    sell,
                                };
                            }
                            return null;
                        }).filter(rate => rate !== null);
                    });
                } else if (label === 'YETU') {
                    // Lógica de extração para o Banco YETU
                    await page.waitForSelector('span.text-white', { timeout: 15000 });
                    rates = await page.evaluate(() => {
                        // Yetu: Rates in spans like "EUR - VENDA -1148.36000"
                        const spans = Array.from(document.querySelectorAll('span.text-white'));
                        return spans.map(span => {
                            const text = span.innerText.trim();
                            // Regex to capture Currency and Rate from "EUR - VENDA -1148.36000"
                            // Handling potential variations in spacing or negative signs
                            const match = text.match(/^([A-Z]{3})\s*-\s*VENDA\s*-?([\d.,]+)/i);
                            if (match) {
                                return {
                                    bank: 'YETU',
                                    currency: match[1].toUpperCase(),
                                    sell: match[2].replace('-', '').trim() // Remove negative sign if captured
                                };
                            }
                            return null;
                        }).filter(rate => rate !== null);
                    });
                }

                // Filtra resultados inválidos e adiciona ao Dataset do Crawlee
                const validRates = rates.filter((rate) => rate.currency && rate.sell);
                await Dataset.pushData(validRates);
                log.info(`✅ Sucesso! Extraídas ${validRates.length} cotações do ${label}.`);
            } catch (error) {
                log.error(`❌ Falha ao processar ${label}: ${error.message}`);
            }
        },

        // Função para lidar com falhas de navegação ou timeouts
        failedRequestHandler({ request, log }) {
            log.error(`Request para ${request.userData.label} falhou: ${request.url}`);
        },
    });

    // Adiciona as URLs alvo à fila do crawler, passando a etiqueta de cada uma.
    await crawler.addRequests(
        targets.map((target) => ({
            url: target.url,
            userData: { label: target.label },
            ...(target.label === 'BFA' && {
                // Para o BFA, usamos uma estratégia de navegação mais paciente.
                navigationTimeoutSecs: 120, // Aumenta o timeout de navegação para 2 minutos
            }),
        }))
    );

    // Inicia o processo de scraping
    await crawler.run();

    console.log('✅ Scraping concluído.');

    // --- Processamento Final: Salvar os dados em um arquivo JSON e no Supabase ---

    console.log('💾 Salvando dados consolidados...');

    // Pega todos os dados coletados de todos os scrapers
    const { items } = await Dataset.getData();
    const allRates = items.flat();

    // Caminho para salvar o arquivo JSON dentro da pasta public
    const outputPath = path.join(process.cwd(), 'public', 'exchange_rates.json');

    const dataToSave = {
        lastUpdated: new Date().toISOString(),
        rates: allRates,
    };

    try {
        await writeFile(outputPath, JSON.stringify(dataToSave, null, 2));
        console.log(`\nDados de ${allRates.length} cotações salvos com sucesso em: ${outputPath}`);
    } catch (error) {
        console.error('Erro ao salvar o arquivo JSON:', error);
    }

    // --- Salvar no Supabase ---
    try {
        const supabase = require('../src/config/supabase');
        console.log('📡 Enviando dados para o Supabase...');

        // Preparar dados para inserção (mapear para colunas da tabela)
        const records = allRates.map(rate => ({
            bank: rate.bank,
            currency: rate.currency,
            sell: rate.sell,
            // buy: rate.buy // Adicionar se/quando extrairmos taxa de compra
        }));

        const { error } = await supabase
            .from('scraper')
            .insert(records);

        if (error) {
            console.error('❌ Erro ao inserir no Supabase:', error);
        } else {
            console.log('✅ Dados salvos com sucesso no Supabase!');
        }

    } catch (error) {
        console.error('❌ Erro na integração com Supabase:', error);
    }

    console.log('✨ Processo finalizado.');
})();