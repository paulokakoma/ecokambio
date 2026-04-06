const cron = require('node-cron');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

// Agenda o verificador (scraper) para correr a cada 4 horas
// Formato cron: Minuto Hora Dia Mês DiaDaSemana
const SCHEDULE = '0 */4 * * *';

console.log(`📅 Agendador inicializado. O Scraper irá correr a cada 4 horas (${SCHEDULE})`);

// Garante que a pasta de logs existe
const logDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

const logToFile = (message) => {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    const logPath = path.join(logDir, 'scraper.log');

    try {
        fs.appendFileSync(logPath, logMessage);
    } catch (error) {
        console.error('Falha ao escrever no ficheiro de log:', error);
    }
};

const runScraper = () => {
    const startTime = new Date();
    console.log('⏰ A iniciar execução agendada do scraper...');
    logToFile('⏰ A iniciar execução agendada do scraper...');

    // Executar o comando 'npm run scrape:all' para iniciar todos os scrapers
    const projectRoot = path.resolve(__dirname, '..');

    // Define um tempo limite de 10 minutos (600000ms) para a extração
    const scraperProcess = exec('npm run scrape:all', {
        cwd: projectRoot,
        timeout: 600000, // 10 minutos
        maxBuffer: 1024 * 1024 * 10 // buffer de 10MB
    }, (error, stdout, stderr) => {
        const endTime = new Date();
        const duration = ((endTime - startTime) / 1000).toFixed(2);

        if (error) {
            const errorMsg = `❌ Execução do Scraper falhou após ${duration}s: ${error.message}`;
            console.error(errorMsg);
            logToFile(errorMsg);

            if (stderr) {
                logToFile(`❌ Stderr: ${stderr}`);
            }

            // Regista sempre o stdout (saída padrão) mesmo havendo erro para facilitar a depuração
            if (stdout) {
                logToFile(`📋 Stdout (no erro): ${stdout.substring(0, 500)}`);
            }
            return;
        }

        if (stderr) {
            console.warn(`⚠️ Avisos do Scraper: ${stderr}`);
            logToFile(`⚠️ Stderr: ${stderr}`);
        }

        const successMsg = `✅ Execução do Scraper concluída com sucesso em ${duration}s`;
        console.log(successMsg);
        logToFile(successMsg);

        // Regista um resumo da saída
        if (stdout) {
            const lines = stdout.split('\n');
            const summary = lines.slice(-10).join('\n'); // Últimas 10 linhas
            logToFile(`📊 Resumo: ${summary}`);
        }
    });

    // Regista o arranque do processo
    logToFile(`🚀 Processo iniciado com PID: ${scraperProcess.pid}`);
};

// Inicializar a tarefa (cron job)
const job = cron.schedule(SCHEDULE, runScraper, {
    scheduled: false, // Não avança automaticamente (arranque manual através do start)
    timezone: "UTC"
});

console.log('✅ Agendador configurado e pronto a rodar');
logToFile('✅ Agendador configurado e pronto a rodar');

// Exportar para utilizar no server.js
module.exports = {
    start: () => {
        job.start();
        const msg = `🚀 Agendador iniciado às ${new Date().toISOString()}`;
        console.log(msg);
        logToFile(msg);
        return job;
    },
    stop: () => {
        job.stop();
        const msg = `⏸️ Agendador pausado às ${new Date().toISOString()}`;
        console.log(msg);
        logToFile(msg);
    },
    runNow: runScraper // Exportado caso se deseje forçar um teste manual
};

// O auto-start em produção foi removido pois o server.js já o invoca na inicialização,
// unificando o controlo do agendador.
