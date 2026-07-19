const { redisClient } = require('../../../src/config/redis');
const fs = require('fs');
const path = require('path');

const REDIS_KEY = 'ecoflix:plans';
const FILE_PATH = path.join(__dirname, '../plans.json');

const DEFAULT_PLANS = {
    'ECONOMICO': { price: 5000, paygo_id: '21000741-6784-421c-b2bc-7607518f4419' },
    'ULTRA': { price: 7000, paygo_id: '6f68d941-c1e3-4831-a8e4-a53aa9ae644a' },
    'FAMILIA': { price: 18000, paygo_id: '59f18155-3cff-435d-8ba4-974f91acb5b9' }
};

const parseData = (dataStr) => {
    const parsed = JSON.parse(dataStr);
    const result = {};
    for (const key of Object.keys(DEFAULT_PLANS)) {
        const raw = parsed[key];
        if (raw && typeof raw === 'object') {
            result[key] = { price: raw.price || DEFAULT_PLANS[key].price, paygo_id: raw.paygo_id || DEFAULT_PLANS[key].paygo_id };
        } else if (typeof raw === 'number') {
            result[key] = { price: raw, paygo_id: DEFAULT_PLANS[key].paygo_id };
        } else {
            result[key] = { ...DEFAULT_PLANS[key] };
        }
    }
    return result;
};

/**
 * Retorna os planos atuais. 
 * Busca do Redis. Se não existir, tenta ler o ficheiro local. Se falhar, retorna os predefinidos.
 */
const getPlans = async () => {
    try {
        let plans;
        if (redisClient && redisClient.status === 'ready') {
            const data = await redisClient.get(REDIS_KEY);
            if (data) {
                plans = parseData(data);
            }
        } else {
            if (fs.existsSync(FILE_PATH)) {
                const data = fs.readFileSync(FILE_PATH, 'utf8');
                if (data) plans = parseData(data);
            }
        }
        if (!plans) plans = Object.fromEntries(Object.entries(DEFAULT_PLANS).map(([k, v]) => [k, { ...v }]));
        for (const [k, v] of Object.entries(plans)) {
            console.log(`[Plans] ${k}: price=${v.price} paygo_id=${v.paygo_id || 'MISSING'}`);
        }
        return plans;
    } catch (e) {
        console.error('Erro ao ler planos:', e.message);
    }
    // Fallback para defaults
    return Object.fromEntries(Object.entries(DEFAULT_PLANS).map(([k, v]) => [k, { ...v }]));
};

/**
 * Atualiza os preços dos planos.
 */
const updatePlans = async (newPlans) => {
    try {
        const plansToSave = {
            'ECONOMICO': newPlans.ECONOMICO || DEFAULT_PLANS.ECONOMICO,
            'ULTRA': newPlans.ULTRA || DEFAULT_PLANS.ULTRA,
            'FAMILIA': newPlans.FAMILIA || DEFAULT_PLANS.FAMILIA
        };

        if (redisClient && redisClient.status === 'ready') {
            await redisClient.set(REDIS_KEY, JSON.stringify(plansToSave));
            console.log('[Plans] Redis cache atualizado:', REDIS_KEY);
        } else {
            fs.writeFileSync(FILE_PATH, JSON.stringify(plansToSave, null, 2), 'utf8');
        }
        
        for (const [k, v] of Object.entries(plansToSave)) {
            console.log(`[Plans] Guardado ${k}: price=${v.price} paygo_id=${v.paygo_id}`);
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
