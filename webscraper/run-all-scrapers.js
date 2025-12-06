#!/usr/bin/env node
/**
 * Master Scraper Runner
 * Executa todos os scrapers em sequência:
 * 1. Mercado Formal (Bancos)
 * 2. Mercado Informal (Angocambio)
 * 3. USDT Formal (Coinbase/Binance)
 * 4. USDT Informal (Binance × Informal)
 */

const { spawn } = require('child_process');
const path = require('path');

const scrapers = [
    {
        name: 'Mercado Formal (Bancos)',
        script: 'cron-scraping.js',
        emoji: '🏦'
    },
    {
        name: 'Mercado Informal (Angocambio)',
        script: 'angocambio-scraper.js',
        emoji: '🏪'
    },
    {
        name: 'USDT Formal',
        script: 'usdt-formal-scraper.js',
        emoji: '💰'
    },
    {
        name: 'USDT Informal',
        script: 'usdt-informal-scraper.js',
        emoji: '💱'
    }
];

async function runScraper(scraper) {
    return new Promise((resolve, reject) => {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`${scraper.emoji} Executando: ${scraper.name}`);
        console.log(`${'='.repeat(60)}\n`);

        const scriptPath = path.join(__dirname, scraper.script);
        const child = spawn('node', [scriptPath], {
            stdio: 'inherit',
            cwd: process.cwd()
        });

        child.on('close', (code) => {
            if (code === 0) {
                console.log(`\n✅ ${scraper.name} concluído com sucesso!\n`);
                resolve();
            } else {
                console.error(`\n❌ ${scraper.name} falhou com código ${code}\n`);
                reject(new Error(`${scraper.name} falhou`));
            }
        });

        child.on('error', (err) => {
            console.error(`\n❌ Erro ao executar ${scraper.name}:`, err);
            reject(err);
        });
    });
}

async function runAllScrapers() {
    const startTime = Date.now();
    console.log('\n🚀 Iniciando execução de todos os scrapers...\n');

    let successCount = 0;
    let failureCount = 0;

    for (const scraper of scrapers) {
        try {
            await runScraper(scraper);
            successCount++;
        } catch (error) {
            failureCount++;
            console.error(`Continuando para o próximo scraper...\n`);
            // Continua mesmo se um scraper falhar
        }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMO DA EXECUÇÃO');
    console.log('='.repeat(60));
    console.log(`✅ Sucesso: ${successCount}/${scrapers.length}`);
    console.log(`❌ Falhas: ${failureCount}/${scrapers.length}`);
    console.log(`⏱️  Tempo total: ${duration}s`);
    console.log('='.repeat(60) + '\n');

    if (failureCount > 0) {
        console.log('⚠️  Alguns scrapers falharam. Verifique os logs acima para mais detalhes.\n');
        process.exit(1);
    } else {
        console.log('🎉 Todos os scrapers foram executados com sucesso!\n');
        process.exit(0);
    }
}

// Executar
runAllScrapers().catch((error) => {
    console.error('\n❌ Erro fatal:', error);
    process.exit(1);
});
