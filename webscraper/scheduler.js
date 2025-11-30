const cron = require('node-cron');
const { exec } = require('child_process');
const path = require('path');

// Schedule the scraper to run every 4 hours
// Cron format: Minute Hour Day Month DayOfWeek
const SCHEDULE = '0 */4 * * *';

console.log(`📅 Scheduler initialized. Scraper will run every 4 hours (${SCHEDULE})`);

const fs = require('fs');

// Ensure logs directory exists
const logDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir);
}

const logToFile = (message) => {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    fs.appendFileSync(path.join(logDir, 'scraper.log'), logMessage);
};

const runScraper = () => {
    console.log('⏰ Starting scheduled scraper execution...');
    logToFile('⏰ Starting scheduled scraper execution...');

    // Execute 'npm run scrape' command
    // We use the full path to ensure it runs in the correct directory
    const projectRoot = path.resolve(__dirname, '..');

    exec('npm run scrape', { cwd: projectRoot }, (error, stdout, stderr) => {
        if (error) {
            const errorMsg = `❌ Scraper execution failed: ${error.message}`;
            console.error(errorMsg);
            logToFile(errorMsg);
            return;
        }
        if (stderr) {
            console.error(`⚠️ Scraper stderr: ${stderr}`);
        }
        console.log(`✅ Scraper execution completed:\n${stdout}`);
        logToFile(`✅ Scraper execution completed successfully.`);
    });
};

// Initialize the cron job
const job = cron.schedule(SCHEDULE, runScraper);

// Export for use in server.js
module.exports = {
    start: () => job.start(),
    stop: () => job.stop(),
    runNow: runScraper // Export for testing purposes
};
