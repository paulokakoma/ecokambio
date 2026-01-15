/**
 * EcoFlix Worker Entry Point
 * Separates queue processing from the main HTTP/API process for better scaling.
 */
require('dotenv').config();
const { startSmsWorker } = require('./src/netflix/services/sms_queue.service');
const { startFamilyPlanWorker } = require('./src/netflix/services/queue.service');

console.log('🚀 [Worker] EcoFlix Background Services Starting...');

// Start SMS Worker
try {
    startSmsWorker();
    console.log('✅ [Worker] SMS Delivery Worker started.');
} catch (error) {
    console.error('❌ [Worker] Failed to start SMS Worker:', error.message);
}

// Start Family Plan Worker
try {
    startFamilyPlanWorker();
    console.log('✅ [Worker] Family Plan Worker started.');
} catch (error) {
    console.error('❌ [Worker] Failed to start Family Plan Worker:', error.message);
}

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 [Worker] SIGTERM received. Shutting down...');
    process.exit(0);
});
