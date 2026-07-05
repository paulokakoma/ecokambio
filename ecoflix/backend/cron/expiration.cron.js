const cron = require('node-cron');
const supabase = require('../../../src/config/supabase');
const { send5DaysExpirySms, sendFinalDayExpirySms } = require('../services/sms.service');
const logger = require('../../../src/config/logger');

const initializeCron = () => {
    // Run every day at 09:00 AM for Notifications
    cron.schedule('0 9 * * *', async () => {
        logger.info('[CRON] A iniciar verificação de assinaturas a expirar...');
        try {
            await notify5DaysExpiry();
            await notifyFinalDayExpiry();
        } catch (error) {
            logger.error(`[CRON] Erro na verificação de assinaturas: ${error.message}`);
        }
    });

    // Run every day at 00:01 AM for Expirations
    cron.schedule('1 0 * * *', async () => {
        logger.info('[CRON] A executar processamento de assinaturas expiradas...');
        try {
            await processExpirations();
        } catch (error) {
            logger.error(`[CRON] Erro no processamento de expiracoes: ${error.message}`);
        }
    });

    logger.info('✅ SMS & Expiration Cron jobs initialized');
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

const processExpirations = async () => {
    const today = new Date().toISOString().split('T')[0];
    
    // Busca assinaturas que deveriam expirar
    const { data: expiredSubs, error } = await supabase
        .from('ecoflix_subscriptions')
        .select(`
            id, 
            profile_id,
            profile:ecoflix_profiles ( name, master_account:ecoflix_master_accounts(email) )
        `)
        .eq('status', 'ACTIVE')
        .lt('end_date', today);

    if (error) {
        logger.error(`[CRON] Erro ao processar expirações: ${error.message}`);
        return;
    }

    if (!expiredSubs || expiredSubs.length === 0) {
        logger.info('[CRON] Nenhuma assinatura para expirar/reciclar hoje.');
        return;
    }

    let count = 0;
    const adminPhone = process.env.ADMIN_PHONE || '+244927862935'; // Fallback admin phone

    for (const sub of expiredSubs) {
        // 1. Marcar assinatura como EXPIRED
        await supabase.from('ecoflix_subscriptions').update({ status: 'EXPIRED' }).eq('id', sub.id);
        
        // 2. Se for perfil partilhado, recicla o perfil
        if (sub.profile_id) {
            const newPin = Math.floor(Math.random() * 9000 + 1000).toString();
            await supabase.from('ecoflix_profiles').update({
                status: 'AVAILABLE',
                client_phone: null,
                client_name: null,
                expires_at: null,
                pin: newPin
            }).eq('id', sub.profile_id);

            // 3. Notificar Admin
            const email = sub.profile?.master_account?.email || 'Desconhecido';
            const profileName = sub.profile?.name || 'Desconhecido';
            
            const { sendAdminPinExpiredSms } = require('../services/sms.service');
            await sendAdminPinExpiredSms(adminPhone, email, profileName, newPin);
            count++;
        }
    }
    logger.info(`[CRON] Expirações processadas e Admin notificado: ${count}`);
};

module.exports = {
    initializeCron,
    notify5DaysExpiry,
    notifyFinalDayExpiry,
    processExpirations
};
