const Redis = require('ioredis');

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

const redisConfig = {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    family: process.env.NODE_ENV === 'production' ? 6 : undefined, // IPv6 for Fly.io internal network
    retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
    }
};

// Create a singleton connection for general caching
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
