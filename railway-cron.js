#!/usr/bin/env node

/**
 * Railway Cron Job - EcoKambio Scraper
 * 
 * Este serviço roda como um cron job separado no Railway
 * executa o scraping de taxas de câmbio automaticamente
 */

const cron = require('node-cron');
const { exec } = require('child_process');
const path = require('path');

// Configuração do ambiente
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const logger = {
    info: (msg) => console.log(`[${new Date().toISOString()}] ℹ️  ${msg}`),
    error: (msg) => console.error(`[${new Date().toISOString()}] ❌ ${msg}`),
    success: (msg) => console.log(`[${new Date().toISOString()}] ✅ ${msg}`)
};

// Configuração do cron job
const CRON_SCHEDULE = process.env.CRON_SCHEDULE || '0 */4 * * *'; // A cada 4 horas (padrão)
const SCRAPER_COMMAND = 'npm run scrape:all';

logger.info('🚀 Railway Cron Job iniciado');
logger.info(`📅 Schedule: ${CRON_SCHEDULE}`);
logger.info(`🔧 Command: ${SCRAPER_COMMAND}`);
logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);

// Função para executar o scraper
async function runScraper() {
    const startTime = Date.now();
    logger.info('⏰ Iniciando scraping job...');

    return new Promise((resolve, reject) => {
        exec(SCRAPER_COMMAND, {
            cwd: path.resolve(__dirname, '..'),
            timeout: 600000, // 10 minutos max
            maxBuffer: 1024 * 1024 * 10 // 10MB buffer
        }, (error, stdout, stderr) => {
            const duration = ((Date.now() - startTime) / 1000).toFixed(2);

            if (error) {
                logger.error(`Scraping falhou após ${duration}s: ${error.message}`);
                if (stderr) logger.error(`Stderr: ${stderr}`);
                reject(error);
                return;
            }

            if (stderr) {
                logger.info(`Warnings: ${stderr}`);
            }

            logger.success(`Scraping completado em ${duration}s`);

            // Log resumo do output
            if (stdout) {
                const lines = stdout.trim().split('\n');
                const summary = lines.slice(-5).join('\n'); // Últimas 5 linhas
                logger.info(`Output:\n${summary}`);
            }

            resolve(stdout);
        });
    });
}

// Executar imediatamente ao iniciar (opcional)
if (process.env.RUN_ON_START === 'true') {
    logger.info('🏃 Executando scraping inicial...');
    runScraper().catch(err => {
        logger.error(`Scraping inicial falhou: ${err.message}`);
    });
}

// Agendar cron job
const job = cron.schedule(CRON_SCHEDULE, async () => {
    try {
        await runScraper();
    } catch (error) {
        logger.error(`Erro no cron job: ${error.message}`);
    }
}, {
    timezone: process.env.TZ || 'UTC'
});

job.start();
logger.success(`✅ Cron job agendado e ativo`);
logger.info(`⏰ Próxima execução: ${job.nextDate()}`);

// Graceful shutdown
process.on('SIGTERM', () => {
    logger.info('📴 SIGTERM recebido, parando cron job...');
    job.stop();
    process.exit(0);
});

process.on('SIGINT', () => {
    logger.info('📴 SIGINT recebido, parando cron job...');
    job.stop();
    process.exit(0);
});

// Keep alive
setInterval(() => {
    logger.info('💓 Cron job ativo e aguardando próxima execução');
}, 3600000); // Log a cada hora
