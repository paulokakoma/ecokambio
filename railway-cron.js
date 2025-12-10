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
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const logger = {
    info: (msg) => console.log(`[${new Date().toISOString()}] ℹ️  ${msg}`),
    error: (msg) => console.error(`[${new Date().toISOString()}] ❌ ${msg}`),
    success: (msg) => console.log(`[${new Date().toISOString()}] ✅ ${msg}`),
    warn: (msg) => console.warn(`[${new Date().toISOString()}] ⚠️  ${msg}`)
};

// Validar variáveis de ambiente obrigatórias
function validateEnvironment() {
    const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY'];
    const missing = required.filter(key => !process.env[key]);

    if (missing.length > 0) {
        logger.error(`Variáveis de ambiente faltando: ${missing.join(', ')}`);
        logger.error('Os scrapers NÃO conseguirão salvar no banco de dados!');
        process.exit(1);
    }

    logger.success('Variáveis de ambiente validadas');
    logger.info(`SUPABASE_URL: ${process.env.SUPABASE_URL?.substring(0, 30)}...`);
}

// Testar conexão com Supabase
async function testSupabaseConnection() {
    try {
        const { createClient } = require('@supabase/supabase-js');
        const supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_KEY
        );

        logger.info('🔍 Testando conexão com Supabase...');

        const { data, error } = await supabase
            .from('rate_providers')
            .select('count')
            .limit(1);

        if (error) {
            logger.error(`Erro ao conectar com Supabase: ${error.message}`);
            logger.error('Os scrapers NÃO conseguirão salvar dados!');
            return false;
        }

        logger.success('Conexão com Supabase OK! ✓');
        return true;
    } catch (error) {
        logger.error(`Erro ao testar Supabase: ${error.message}`);
        return false;
    }
}

// Configuração do cron job
const CRON_SCHEDULE = process.env.CRON_SCHEDULE || '0 */4 * * *'; // A cada 4 horas (padrão)
const SCRAPER_COMMAND = 'npm run scrape:all';

logger.info('🚀 Railway Cron Job iniciado');
logger.info(`📅 Schedule: ${CRON_SCHEDULE}`);
logger.info(`🔧 Command: ${SCRAPER_COMMAND}`);
logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);

// Validar ambiente
validateEnvironment();

// Função para executar o scraper
async function runScraper() {
    const startTime = Date.now();
    logger.info('⏰ Iniciando scraping job...');

    // Testar conexão antes de executar
    const connectionOk = await testSupabaseConnection();
    if (!connectionOk) {
        logger.warn('Continuando mesmo com falha na conexão (dados podem não ser salvos)');
    }

    return new Promise((resolve, reject) => {
        const child = exec(SCRAPER_COMMAND, {
            cwd: path.resolve(__dirname),
            timeout: 600000, // 10 minutos max
            maxBuffer: 1024 * 1024 * 10, // 10MB buffer
            env: {
                ...process.env,
                // Garantir que variáveis sejam passadas
                SUPABASE_URL: process.env.SUPABASE_URL,
                SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY,
                SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
                NODE_ENV: process.env.NODE_ENV || 'production'
            }
        }, (error, stdout, stderr) => {
            const duration = ((Date.now() - startTime) / 1000).toFixed(2);

            if (error) {
                logger.error(`Scraping falhou após ${duration}s: ${error.message}`);
                if (stderr) {
                    logger.error(`Stderr: ${stderr}`);
                }
                if (stdout) {
                    logger.info(`Stdout (antes do erro):\n${stdout}`);
                }
                reject(error);
                return;
            }

            if (stderr) {
                logger.warn(`Warnings: ${stderr}`);
            }

            logger.success(`Scraping completado em ${duration}s`);

            // Log completo do output para debug
            if (stdout) {
                logger.info('📋 Output completo:');
                console.log(stdout);

                // Verificar se salvou no Supabase
                if (stdout.includes('✅ Data successfully saved to Supabase')) {
                    logger.success('🎉 Dados salvos no Supabase com sucesso!');
                } else if (stdout.includes('Error upserting into Supabase')) {
                    logger.error('❌ ERRO ao salvar no Supabase - verifique credenciais!');
                } else {
                    logger.warn('⚠️  Não foi possível confirmar se dados foram salvos no Supabase');
                }
            }

            resolve(stdout);
        });

        // Log stderr em tempo real para debug
        child.stderr.on('data', (data) => {
            logger.warn(`stderr: ${data}`);
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
logger.info(`⏰ Próxima execução será às: ${job.nextDate()}`);

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

// Keep alive com status report
setInterval(() => {
    logger.info('💓 Cron job ativo e aguardando próxima execução');
    logger.info(`   Próxima execução: ${job.nextDate()}`);
}, 3600000); // Log a cada hora
