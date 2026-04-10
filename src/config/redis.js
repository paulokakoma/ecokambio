const Redis = require('ioredis');

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

const redisConfig = {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    family: undefined, // Let ioredis handle IPv4/IPv6 detection automatically
    retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        console.log(`[Redis] Reconnecting (#${times})...`);
        return delay;
    }
};

console.log(`[Redis] Connecting to: ${redisUrl.includes('@') ? redisUrl.split('@')[1] : redisUrl}`);
const redisClient = new Redis(redisUrl, redisConfig);

redisClient.on('error', (err) => {
    console.error('Redis Client Error:', err);
});

redisClient.on('connect', () => {
    console.log('Redis Client Connected');
});

module.exports = {
    redisClient,
    redisConfig,
    redisUrl
};
