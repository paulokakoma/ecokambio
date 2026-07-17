const { redisClient } = require('../../src/config/redis');
const planService = require('./services/plan.service');
const fs = require('fs');
const path = require('path');

const run = async () => {
    try {
        console.log('Connecting to Redis...');
        // Need to wait for redis client to be ready if it's connecting
        setTimeout(async () => {
            if (redisClient && redisClient.status === 'ready') {
                const FILE_PATH = path.join(__dirname, 'plans.json');
                if (fs.existsSync(FILE_PATH)) {
                    const data = JSON.parse(fs.readFileSync(FILE_PATH, 'utf8'));
                    await redisClient.set('ecoflix:plans', JSON.stringify(data));
                    console.log('✅ Redis updated with plans.json content!');
                }
            } else {
                console.log('Redis is not active. Using file fallback.');
            }
            process.exit(0);
        }, 2000);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
};

run();
