/**
 * Stock Monitor Service
 *
 * Verifica disponibilidade de contas/perfis e saldo SMS.
 * Notifica o admin por SMS quando:
 * - Faltam 2 ou menos contas EXCLUSIVE disponíveis
 * - Faltam 2 ou menos perfis MOBILE ou TV disponíveis
 * - Saldo SMS está baixo (menos de 20 SMS)
 */

const supabase = require('../../../src/config/supabase');
const smsService = require('./sms.service');
const { redisClient } = require('../../../src/config/redis');

const ADMIN_PHONE = process.env.ADMIN_PHONE || '+244938948994';
const STOCK_THRESHOLD = 1;
const SMS_BALANCE_THRESHOLD = 20;

// Cache para evitar spam de notificações (12 horas)
const notificationCache = new Map();
const NOTIFICATION_COOLDOWN_SEC = 12 * 60 * 60; // 12 horas em segundos

/**
 * Verifica se já notificou recentemente para evitar spam
 */
const wasRecentlyNotified = async (key) => {
    try {
        if (redisClient && redisClient.isOpen) {
            const val = await redisClient.get(`ecoflix:stock_alert:${key}`);
            return !!val;
        }
    } catch (e) {
        console.error('[StockMonitor] Erro Redis no get:', e.message);
    }
    const lastNotified = notificationCache.get(key);
    if (!lastNotified) return false;
    return Date.now() - lastNotified < (NOTIFICATION_COOLDOWN_SEC * 1000);
};

const markNotified = async (key) => {
    try {
        if (redisClient && redisClient.isOpen) {
            await redisClient.setEx(`ecoflix:stock_alert:${key}`, NOTIFICATION_COOLDOWN_SEC, '1');
        }
    } catch (e) {
        console.error('[StockMonitor] Erro Redis no set:', e.message);
    }
    notificationCache.set(key, Date.now());
};

/**
 * Conta contas EXCLUSIVE disponíveis (sem subscrição ativa)
 */
const getExclusiveAvailable = async () => {
    const { data: accounts } = await supabase
        .from('ecoflix_master_accounts')
        .select('id, subscriptions:ecoflix_subscriptions(status)')
        .eq('type', 'EXCLUSIVE')
        .eq('status', 'ACTIVE');

    if (!accounts) return 0;

    return accounts.filter(acc =>
        !acc.subscriptions ||
        acc.subscriptions.filter(s => ['ACTIVE', 'SUSPENDED'].includes(s.status)).length === 0
    ).length;
};

/**
 * Conta perfis disponíveis por tipo
 */
const getProfilesAvailable = async (type) => {
    const { count } = await supabase
        .from('ecoflix_profiles')
        .select('*', { count: 'exact', head: true })
        .eq('type', type)
        .eq('status', 'AVAILABLE');

    return count || 0;
};

/**
 * Verifica saldo SMS na TelcoSMS
 */
const getSmsBalance = async () => {
    const result = await smsService.checkBalance();
    if (result.success && result.data?.company_info?.sms_available !== undefined) {
        return result.data.company_info.sms_available;
    }
    return null;
};

/**
 * Envia alerta ao admin
 */
const notifyAdmin = async (message) => {
    try {
        await smsService.sendSms(ADMIN_PHONE, message);
        console.log('[StockMonitor] Alerta enviado ao admin:', message.substring(0, 50));
    } catch (error) {
        console.error('[StockMonitor] Erro ao notificar admin:', error.message);
    }
};

/**
 * Função principal: verifica stock e notifica admin se necessário
 * Deve ser chamada após cada pagamento confirmado
 */
const checkAndNotify = async () => {
    console.log('[StockMonitor] Verificando stock...');

    const alerts = [];
    const keysToMark = [];

    // 1. Verificar contas EXCLUSIVE
    const exclusiveAvailable = await getExclusiveAvailable();
    if (exclusiveAvailable <= STOCK_THRESHOLD) {
        const key = 'exclusive_stock';
        if (!(await wasRecentlyNotified(key))) {
            alerts.push(`EXCLUSIVE: ${exclusiveAvailable} disp.`);
            keysToMark.push(key);
        }
    }

    // 2. Verificar perfis MOBILE
    const mobileAvailable = await getProfilesAvailable('MOBILE');
    if (mobileAvailable <= STOCK_THRESHOLD) {
        const key = 'mobile_stock';
        if (!(await wasRecentlyNotified(key))) {
            alerts.push(`MOBILE: ${mobileAvailable} disp.`);
            keysToMark.push(key);
        }
    }

    // 3. Verificar perfis TV
    const tvAvailable = await getProfilesAvailable('TV');
    if (tvAvailable <= STOCK_THRESHOLD) {
        const key = 'tv_stock';
        if (!(await wasRecentlyNotified(key))) {
            alerts.push(`TV: ${tvAvailable} disp.`);
            keysToMark.push(key);
        }
    }

    // 4. Verificar saldo SMS
    const smsBalance = await getSmsBalance();
    if (smsBalance !== null && smsBalance <= SMS_BALANCE_THRESHOLD) {
        const key = 'sms_balance';
        if (!(await wasRecentlyNotified(key))) {
            alerts.push(`SMS: ${smsBalance} restantes.`);
            keysToMark.push(key);
        }
    }

    if (alerts.length > 0) {
        const message = `🚨 ALERTA ECOFLIX - BAIXO STOCK:\n${alerts.map(a => '- ' + a).join('\n')}\nRecarregue no painel admin!`;
        await notifyAdmin(message);

        for (const k of keysToMark) {
            await markNotified(k);
        }
    }

    return {
        exclusive: exclusiveAvailable,
        mobile: mobileAvailable,
        tv: tvAvailable,
        smsBalance
    };
};

module.exports = {
    checkAndNotify,
    getExclusiveAvailable,
    getProfilesAvailable,
    getSmsBalance
};
