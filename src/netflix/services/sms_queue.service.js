const smsService = require('./sms.service');

const { redisConfig, redisUrl } = require('../../config/redis');

let smsQueue = null;
let queueConnection = null;
let startSmsWorker = null;

if (redisUrl) {
    const { Queue, Worker } = require('bullmq');
    const Redis = require('ioredis');

    const SMS_QUEUE = 'sms-delivery';

    queueConnection = new Redis(redisUrl, { ...redisConfig, maxRetriesPerRequest: null });

    smsQueue = new Queue(SMS_QUEUE, {
        connection: queueConnection
    });

    startSmsWorker = () => {
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
        connection: queueConnection,
        concurrency: 5, // Process multiple SMS in parallel
        limiter: {
            max: 5,
            duration: 2000 // Limit to 5 per 2s to respect provider limits
        }
    });
};
} else {
    console.log('[SMS Queue] Redis not configured. SMS queue disabled.');
}

module.exports = {
    smsQueue,
    startSmsWorker
};
