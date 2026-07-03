const { redisClient } = require('../../../src/config/redis');
const fs = require('fs');
const path = require('path');

const REDIS_KEY = 'ecoflix:plans';
const FILE_PATH = path.join(__dirname, '../plans.json');

const DEFAULT_PLANS = {
    'ECONOMICO': { price: 4500, paygo_id: 'd13a142b-9d1f-4788-b227-a41235d04e85' },
    'ULTRA': { price: 6500, paygo_id: '2d8240df-e851-4b10-aeaf-8054145a4de4' },
    'FAMILIA': { price: 18000, paygo_id: 'f88a0f69-03ba-432e-b6b7-ed30f96fc7e2' }
};

const parseData = (dataStr) => {
    const parsed = JSON.parse(dataStr);
    if (parsed.ECONOMICO && typeof parsed.ECONOMICO === 'number') {
        return {
            'ECONOMICO': { price: parsed.ECONOMICO, paygo_id: DEFAULT_PLANS.ECONOMICO.paygo_id },
            'ULTRA': { price: parsed.ULTRA, paygo_id: DEFAULT_PLANS.ULTRA.paygo_id },
            'FAMILIA': { price: parsed.FAMILIA, paygo_id: DEFAULT_PLANS.FAMILIA.paygo_id }
        };
    }
    return parsed;
};

/**
 * Retorna os planos atuais. 
 * Busca do Redis. Se não existir, tenta ler o ficheiro local. Se falhar, retorna os predefinidos.
 */
const getPlans = async () => {
    try {
        if (redisClient && redisClient.status === 'ready') {
            const data = await redisClient.get(REDIS_KEY);
            if (data) {
                return parseData(data);
            }
        } else {
            if (fs.existsSync(FILE_PATH)) {
                const data = fs.readFileSync(FILE_PATH, 'utf8');
                if (data) return parseData(data);
            }
        }
    } catch (e) {
        console.error('Erro ao ler planos:', e.message);
    }
    // Fallback para defaults
    return { ...DEFAULT_PLANS };
};

/**
 * Atualiza os preços dos planos.
 */
const updatePlans = async (newPlans) => {
    try {
        // Validação
        const plansToSave = {
            'ECONOMICO': newPlans.ECONOMICO || DEFAULT_PLANS.ECONOMICO,
            'ULTRA': newPlans.ULTRA || DEFAULT_PLANS.ULTRA,
            'FAMILIA': newPlans.FAMILIA || DEFAULT_PLANS.FAMILIA
        };

        if (redisClient && redisClient.status === 'ready') {
            await redisClient.set(REDIS_KEY, JSON.stringify(plansToSave));
        } else {
            fs.writeFileSync(FILE_PATH, JSON.stringify(plansToSave, null, 2), 'utf8');
        }
        
        return plansToSave;
    } catch (e) {
        console.error('Erro ao guardar planos:', e.message);
        throw e;
    }
};

module.exports = {
    getPlans,
    updatePlans,
    DEFAULT_PLANS
};
