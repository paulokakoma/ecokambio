const redisUrl = process.env.REDIS_URL;

let redisClient = null;
let redisConfig = {};

if (redisUrl) {
    const Redis = require('ioredis');

    redisConfig = {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        family: undefined,
        retryStrategy(times) {
            const delay = Math.min(times * 50, 2000);
            console.log(`[Redis] Reconnecting (#${times})...`);
            return delay;
        }
    };

    console.log(`[Redis] Connecting to: ${redisUrl.includes('@') ? redisUrl.split('@')[1] : redisUrl}`);
    redisClient = new Redis(redisUrl, redisConfig);

    redisClient.on('error', (err) => {
        console.error('Redis Client Error:', err);
    });

    redisClient.on('connect', () => {
        console.log('Redis Client Connected');
    });
} else {
    console.log('[Redis] REDIS_URL not set. Redis disabled.');
}

module.exports = {
    redisClient,
    redisConfig,
    redisUrl
};
