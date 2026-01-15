const { Queue, Worker } = require('bullmq');
const { redisConfig } = require('../../config/redis');
const smsService = require('./sms.service');

// Define Queue Name
const SMS_QUEUE = 'sms-delivery';

// Create Queue
const smsQueue = new Queue(SMS_QUEUE, {
    connection: redisConfig
});

// Worker Factory (to be called by worker.js)
const startSmsWorker = () => {
    return new Worker(SMS_QUEUE, async (job) => {
        const { phone, credentials } = job.data;
        console.log(`[Queue] Processing SMS Delivery for: ${phone}`);

        try {
            await smsService.sendDeliverySms(phone, credentials);
            console.log(`[Queue] SMS successfully sent to ${phone}`);
        } catch (error) {
            console.error(`[Queue] Failed to send SMS to ${phone}:`, error.message);
            throw error; // Retries according to configuration
        }
    }, {
        connection: redisConfig,
        concurrency: 5, // Process multiple SMS in parallel
        limiter: {
            max: 5,
            duration: 2000 // Limit to 5 per 2s to respect provider limits
        }
    });
};

module.exports = {
    smsQueue,
    startSmsWorker
};
