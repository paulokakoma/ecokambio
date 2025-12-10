const cron = require('node-cron');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

// Schedule the scraper to run every 4 hours
// Cron format: Minute Hour Day Month DayOfWeek
const SCHEDULE = '0 */4 * * *';

console.log(`📅 Scheduler initialized. Scraper will run every 4 hours (${SCHEDULE})`);

// Ensure logs directory exists
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
        console.error('Failed to write to log file:', error);
    }
};

const runScraper = () => {
    const startTime = new Date();
    console.log('⏰ Starting scheduled scraper execution...');
    logToFile('⏰ Starting scheduled scraper execution...');

    // Execute 'npm run scrape:all' command to run all scrapers
    const projectRoot = path.resolve(__dirname, '..');

    // Set a timeout of 10 minutes (600000ms) for the scraper
    const scraperProcess = exec('npm run scrape:all', {
        cwd: projectRoot,
        timeout: 600000, // 10 minutes
        maxBuffer: 1024 * 1024 * 10 // 10MB buffer
    }, (error, stdout, stderr) => {
        const endTime = new Date();
        const duration = ((endTime - startTime) / 1000).toFixed(2);

        if (error) {
            const errorMsg = `❌ Scraper execution failed after ${duration}s: ${error.message}`;
            console.error(errorMsg);
            logToFile(errorMsg);

            if (stderr) {
                logToFile(`❌ Stderr: ${stderr}`);
            }

            // Log stdout even on error for debugging
            if (stdout) {
                logToFile(`📋 Stdout (on error): ${stdout.substring(0, 500)}`);
            }
            return;
        }

        if (stderr) {
            console.warn(`⚠️ Scraper warnings: ${stderr}`);
            logToFile(`⚠️ Stderr: ${stderr}`);
        }

        const successMsg = `✅ Scraper execution completed successfully in ${duration}s`;
        console.log(successMsg);
        logToFile(successMsg);

        // Log a summary of the output
        if (stdout) {
            const lines = stdout.split('\n');
            const summary = lines.slice(-10).join('\n'); // Last 10 lines
            logToFile(`📊 Summary: ${summary}`);
        }
    });

    // Log process start
    logToFile(`🚀 Process started with PID: ${scraperProcess.pid}`);
};

// Initialize the cron job
const job = cron.schedule(SCHEDULE, runScraper, {
    scheduled: false, // Don't start immediately
    timezone: "UTC"
});

console.log('✅ Scheduler configured and ready');
logToFile('✅ Scheduler configured and ready');

// Export for use in server.js
module.exports = {
    start: () => {
        job.start();
        const msg = `🚀 Scheduler started at ${new Date().toISOString()}`;
        console.log(msg);
        logToFile(msg);
        return job;
    },
    stop: () => {
        job.stop();
        const msg = `⏸️ Scheduler stopped at ${new Date().toISOString()}`;
        console.log(msg);
        logToFile(msg);
    },
    runNow: runScraper // Export for testing purposes
};
