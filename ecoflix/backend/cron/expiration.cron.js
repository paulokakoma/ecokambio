const cron = require('node-cron');
const supabase = require('../../../src/config/supabase');
const { send5DaysExpirySms, sendFinalDayExpirySms } = require('../services/sms.service');
const logger = require('../../../src/config/logger');

const initializeCron = () => {
    // Run every day at 09:00 AM
    cron.schedule('0 9 * * *', async () => {
        logger.info('[CRON] A iniciar verificação de assinaturas a expirar...');
        try {
            await notify5DaysExpiry();
            await notifyFinalDayExpiry();
        } catch (error) {
            logger.error(`[CRON] Erro na verificação de assinaturas: ${error.message}`);
        }
    });
    logger.info('✅ SMS Cron jobs initialized (Daily at 09:00 AM)');
};

const notify5DaysExpiry = async () => {
    // Busca assinaturas ativas cujo end_date é exatamente hoje + 5 dias
    const { data: subs, error } = await supabase
        .from('ecoflix_subscriptions')
        .select(`
            id, 
            end_date, 
            user:ecoflix_users(phone, name)
        `)
        .eq('status', 'ACTIVE')
        .eq('end_date', new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

    if (error) {
        logger.error(`[CRON] Erro ao buscar assinaturas 5 dias: ${error.message}`);
        return;
    }

    if (!subs || subs.length === 0) {
        logger.info('[CRON] Nenhuma assinatura a expirar em 5 dias.');
        return;
    }

    let count = 0;
    for (const sub of subs) {
        if (sub.user?.phone) {
            await send5DaysExpirySms(sub.user.phone);
            count++;
        }
    }
    logger.info(`[CRON] Notificações 5 dias enviadas: ${count}`);
};

const notifyFinalDayExpiry = async () => {
    // Busca assinaturas ativas cujo end_date é exatamente hoje
    const { data: subs, error } = await supabase
        .from('ecoflix_subscriptions')
        .select(`
            id, 
            end_date, 
            user:ecoflix_users(phone, name)
        `)
        .eq('status', 'ACTIVE')
        .eq('end_date', new Date().toISOString().split('T')[0]);

    if (error) {
        logger.error(`[CRON] Erro ao buscar assinaturas 1 dia: ${error.message}`);
        return;
    }

    if (!subs || subs.length === 0) {
        logger.info('[CRON] Nenhuma assinatura a expirar hoje.');
        return;
    }

    let count = 0;
    for (const sub of subs) {
        if (sub.user?.phone) {
            await sendFinalDayExpirySms(sub.user.phone);
            count++;
        }
    }
    logger.info(`[CRON] Notificações Último Dia enviadas: ${count}`);
};

module.exports = {
    initializeCron,
    notify5DaysExpiry, // Exported for manual testing
    notifyFinalDayExpiry // Exported for manual testing
};
