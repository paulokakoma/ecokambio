const { spawn } = require('child_process');
const path = require('path');
const supabase = require('../config/supabase');

/**
 * Get scraper health status
 */
const getHealth = async (req, res) => {
    try {
        // Get last update from exchange_rates table
        // Note: Using updated_at as timestamp column
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

        // Get count of rates per bank for the latest run
        // We filter by rates updated in the last 1 hour of the last run
        let totalRates = 0;
        if (lastUpdate) {
            const timeWindowStart = new Date(lastUpdate.getTime() - 5 * 60000).toISOString(); // 5 mins before
            const timeWindowEnd = new Date(lastUpdate.getTime() + 5 * 60000).toISOString(); // 5 mins after

            const { count, error: countError } = await supabase
                .from('exchange_rates')
                .select('*', { count: 'exact', head: true })
                .gte('updated_at', timeWindowStart)
                .lte('updated_at', timeWindowEnd);

            totalRates = count || 0;
        }

        // Determine status
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
 * Manually trigger scraper (admin only)
 */
const triggerScraper = async (req, res) => {
    try {
        const fs = require('fs');
        const projectRoot = path.resolve(__dirname, '../..');
        console.log('📂 Project root:', projectRoot);

        // Create logs directory if it doesn't exist
        const logsDir = path.join(projectRoot, 'logs');
        if (!fs.existsSync(logsDir)) {
            fs.mkdirSync(logsDir, { recursive: true });
        }

        // Create log files for stdout and stderr
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const stdoutLog = path.join(logsDir, `scraper-${timestamp}.log`);
        const stderrLog = path.join(logsDir, `scraper-${timestamp}.error.log`);

        // Open file descriptors for logs
        const stdoutFd = fs.openSync(stdoutLog, 'a');
        const stderrFd = fs.openSync(stderrLog, 'a');

        // Use spawn with detached mode so the process survives server restarts
        const scriptPath = path.join(projectRoot, 'webscraper', 'run-all-scrapers.js');
        console.log('🚀 Spawning scraper:', scriptPath);
        console.log(`📝 Logs will be written to: ${stdoutLog}`);

        const child = spawn('node', [scriptPath], {
            cwd: projectRoot,
            detached: true,
            stdio: ['ignore', stdoutFd, stderrFd]  // Use file descriptors
        });

        //  Unreference so parent can exit
        child.unref();

        // Close file descriptors in parent process
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
 * Get last scraper results
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

        // Get all rates from that timestamp (approximate window)
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

        // Group by bank
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

// Helper function
function getStatusMessage(status, hours) {
    switch (status) {
        case 'healthy':
            return `Scraper running normally. Last run ${hours.toFixed(1)} hours ago.`;
        case 'stale':
            return `Scraper data is stale. Last run ${hours.toFixed(1)} hours ago.`;
        case 'error':
            return `Scraper hasn't run in over 24 hours. Check logs.`;
        case 'never_run':
            return 'Scraper has never run successfully.';
        default:
            return 'Unknown status';
    }
}

module.exports = {
    getHealth,
    triggerScraper,
    triggerInformalScraper,
    getLastResults
};
