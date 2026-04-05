const { spawn } = require('child_process');
const path = require('path');
const supabase = require('../config/supabase');

/**
 * Obter o estado de saúde (health status) do scraper
 * Determina se o scraper está a correr corretamente através da última data e hora de atualização.
 */
const getHealth = async (req, res) => {
    try {
        // Obter a última atualização da tabela exchange_rates
        // Nota: A usar a coluna updated_at como timestamp de referência
        const { data, error } = await supabase
            .from('exchange_rates')
            .select('updated_at')
            .order('updated_at', { ascending: false })
            .limit(1)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
            throw error;
        }

        const lastUpdate = data?.updated_at ? new Date(data.updated_at) : null;
        const now = new Date();
        const hoursSinceLastRun = lastUpdate
            ? (now - lastUpdate) / (1000 * 60 * 60)
            : null;

        // Conta quantas taxas por banco existem para a última execução
        // Filtramos pelas taxas que foram atualizadas na janela temporal de +/- 5 minutos da última data
        let totalRates = 0;
        if (lastUpdate) {
            const timeWindowStart = new Date(lastUpdate.getTime() - 5 * 60000).toISOString(); // 5 min antes
            const timeWindowEnd = new Date(lastUpdate.getTime() + 5 * 60000).toISOString(); // 5 min depois

            const { count, error: countError } = await supabase
                .from('exchange_rates')
                .select('*', { count: 'exact', head: true })
                .gte('updated_at', timeWindowStart)
                .lte('updated_at', timeWindowEnd);

            totalRates = count || 0;
        }

        // Determinar o estado de saúde do sistema de scraping
        let status = 'unknown';
        if (!lastUpdate) {
            status = 'never_run';
        } else if (hoursSinceLastRun < 5) {
            status = 'healthy';
        } else if (hoursSinceLastRun < 24) {
            status = 'stale';
        } else {
            status = 'error';
        }

        res.json({
            status,
            lastRun: lastUpdate?.toISOString() || null,
            hoursSinceLastRun: hoursSinceLastRun ? parseFloat(hoursSinceLastRun.toFixed(2)) : null,
            totalRates,
            message: getStatusMessage(status, hoursSinceLastRun)
        });
    } catch (error) {
        console.error('Error getting scraper health:', error);
        console.error('Error details:', JSON.stringify(error, null, 2));
        res.status(500).json({
            status: 'error',
            message: 'Failed to get scraper health status',
            details: error.message
        });
    }
};

/**
 * Despoletar execução manual do scraper (Restrito a Admin)
 */
const triggerScraper = async (req, res) => {
    try {
        const fs = require('fs');
        const projectRoot = path.resolve(__dirname, '../..');
        console.log('📂 Project root:', projectRoot);

        // Criar a diretoria de logs caso não exista
        const logsDir = path.join(projectRoot, 'logs');
        if (!fs.existsSync(logsDir)) {
            fs.mkdirSync(logsDir, { recursive: true });
        }

        // Definir e criar os ficheiros de texto para os logs (stdout e stderr)
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const stdoutLog = path.join(logsDir, `scraper-${timestamp}.log`);
        const stderrLog = path.join(logsDir, `scraper-${timestamp}.error.log`);

        // Abrir descritores de base para que o filho possa herdar os logs
        const stdoutFd = fs.openSync(stdoutLog, 'a');
        const stderrFd = fs.openSync(stderrLog, 'a');

        // Usa o método spawn em "detached mode". Assim o processo de extração não morre se este servidor reiniciar ou for cancelado.
        const scriptPath = path.join(projectRoot, 'webscraper', 'run-all-scrapers.js');
        console.log('🚀 A acionar processo secundário scraper:', scriptPath);
        console.log(`📝 Logs vão ser registados em: ${stdoutLog}`);

        const child = spawn('node', [scriptPath], {
            cwd: projectRoot,
            detached: true,
            stdio: ['ignore', stdoutFd, stderrFd]  // Usa os ficheiros em vez da consola principal
        });

        // "Desanexa" o processo para suportar continuação independente
        child.unref();

        // Fechar os ficheiros no proceso originário
        fs.close(stdoutFd, () => { });
        fs.close(stderrFd, () => { });

        console.log(`✅ Scraper process started with PID: ${child.pid}`);
        console.log(`📁 Check logs at: ${stdoutLog}`);

        // Send immediate response
        res.json({
            success: true,
            message: 'Todos os scrapers foram iniciados (Formal, Informal, USDT Formal e USDT Informal).',
            pid: child.pid,
            logFile: stdoutLog
        });
    } catch (error) {
        console.error('❌ Error triggering scrapers:', error);
        res.status(500).json({ success: false, message: 'Failed to start scrapers', error: error.message });
    }
};

/**
 * Manually trigger informal market scraper (angocambio.ao)
 */
const triggerInformalScraper = async (req, res) => {
    try {
        const projectRoot = path.resolve(__dirname, '../..');

        // Run angocambio scraper in background
        exec('node webscraper/angocambio-scraper.js', { cwd: projectRoot }, (error, stdout, stderr) => {
            if (error) {
                console.error(`Informal scraper execution error: ${error.message}`);
                return;
            }
            if (stderr) {
                console.error(`Informal scraper stderr: ${stderr}`);
            }
            console.log(`Informal scraper output: ${stdout}`);
        });

        res.json({
            success: true,
            message: 'Informal market scraper started. Check logs for progress.'
        });
    } catch (error) {
        console.error('Error triggering informal scraper:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to trigger informal scraper'
        });
    }
};


/**
 * Obter os resultados do último scraper completo
 * Fornece um resumo de estatísticas de moedas atualizadas.
 */
const getLastResults = async (req, res) => {
    try {
        // Get latest timestamp
        const { data: latest, error: latestError } = await supabase
            .from('exchange_rates')
            .select('updated_at')
            .order('updated_at', { ascending: false })
            .limit(1)
            .single();

        if (latestError && latestError.code !== 'PGRST116') {
            throw latestError;
        }

        if (!latest) {
            return res.json({
                timestamp: null,
                banks: [],
                message: 'No scraper data found'
            });
        }

        // Identificar todos os pares obtidos no mesmo intervalo da última extração detetada
        const timeWindowStart = new Date(new Date(latest.updated_at).getTime() - 5 * 60000).toISOString();
        const timeWindowEnd = new Date(new Date(latest.updated_at).getTime() + 5 * 60000).toISOString();

        const { data: rates, error: ratesError } = await supabase
            .from('exchange_rates')
            .select(`
                currency_pair,
                sell_rate,
                rate_providers!inner(code, name)
            `)
            .gte('updated_at', timeWindowStart)
            .lte('updated_at', timeWindowEnd);

        if (ratesError) throw ratesError;

        // Agrupar contagem de taxas por cada banco/fornecedor
        const bankResults = {};
        rates.forEach(rate => {
            const bankCode = rate.rate_providers.code;
            const bankName = rate.rate_providers.name;

            if (!bankResults[bankCode]) {
                bankResults[bankCode] = {
                    code: bankCode,
                    name: bankName,
                    status: 'success',
                    ratesCount: 0
                };
            }
            bankResults[bankCode].ratesCount++;
        });

        res.json({
            timestamp: latest.updated_at,
            banks: Object.values(bankResults)
        });
    } catch (error) {
        console.error('Error getting last results:', error);
        res.status(500).json({
            error: 'Failed to get last scraper results'
        });
    }
};

// Função auxiliar para traduzir o estado da saúde e calcular as mensagens de frontend
function getStatusMessage(status, hours) {
    switch (status) {
        case 'healthy':
            return `O sistema de extração corre habitualmente normal. Última corrida há ${hours.toFixed(1)} horas.`;
        case 'stale':
            return `Atenção: Os dados parecem desatualizados. Última corrida há ${hours.toFixed(1)} horas.`;
        case 'error':
            return `Alerta: Scraper não atualiza há mais de 24 horas. Reveja os relatórios de logs.`;
        case 'never_run':
            return 'O integrador do scraper não reportou sucesso ao arrancar ainda.';
        default:
            return 'Estado misterioso/desconhecido.';
    }
}

module.exports = {
    getHealth,
    triggerScraper,
    triggerInformalScraper,
    getLastResults
};
