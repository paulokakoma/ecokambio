const cron = require('node-cron');
const supabase = require('../../../src/config/supabase');
const { send5DaysExpirySms, sendFinalDayExpirySms, sendAdminPinExpiredSms } = require('../services/sms.service');
const logger = require('../../../src/config/logger');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const SMS_BATCH_SIZE = 5;
const SMS_BATCH_DELAY_MS = 2100;

const initializeCron = () => {
    // Notifications: every day at 09:00 AM
    cron.schedule('0 9 * * *', async () => {
        logger.info('[CRON] A iniciar verificação de assinaturas a expirar...');
        try {
            await notify5DaysExpiry();
            await notifyFinalDayExpiry();
        } catch (error) {
            logger.error(`[CRON] Erro na verificação de assinaturas: ${error.message}`);
        }
    });

    // Expirations: every day at 00:01 AM
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
    const targetDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const today = new Date().toISOString().split('T')[0];

    const { data: subs, error } = await supabase
        .from('ecoflix_subscriptions')
        .select(`
            id, 
            end_date,
            sms_notified_at,
            user:ecoflix_users(phone, name)
        `)
        .eq('status', 'ACTIVE')
        .eq('end_date', targetDate)
        .or(`sms_notified_at.is.null,sms_notified_at.lt.${today}`);

    if (error) {
        logger.error(`[CRON] Erro ao buscar assinaturas 5 dias: ${error.message}`);
        return;
    }

    if (!subs || subs.length === 0) {
        logger.info('[CRON] Nenhuma assinatura a expirar em 5 dias.');
        return;
    }

    let sent = 0;
    let failed = 0;
    for (let i = 0; i < subs.length; i += SMS_BATCH_SIZE) {
        const batch = subs.slice(i, i + SMS_BATCH_SIZE);
        await Promise.all(batch.map(async (sub) => {
            if (!sub.user?.phone) return;
            try {
                await send5DaysExpirySms(sub.user.phone);
                await supabase
                    .from('ecoflix_subscriptions')
                    .update({ sms_notified_at: new Date().toISOString() })
                    .eq('id', sub.id);
                sent++;
            } catch (e) {
                failed++;
                logger.warn(`[CRON] Falha SMS 5d sub ${sub.id}: ${e.message}`);
            }
        }));
        if (i + SMS_BATCH_SIZE < subs.length) {
            await sleep(SMS_BATCH_DELAY_MS);
        }
    }
    logger.info(`[CRON] Notificações 5 dias: ${sent} enviadas, ${failed} falhadas`);
};

const notifyFinalDayExpiry = async () => {
    const today = new Date().toISOString().split('T')[0];

    const { data: subs, error } = await supabase
        .from('ecoflix_subscriptions')
        .select(`
            id, 
            end_date,
            sms_notified_at,
            user:ecoflix_users(phone, name)
        `)
        .eq('status', 'ACTIVE')
        .eq('end_date', today)
        .or(`sms_notified_at.is.null,sms_notified_at.lt.${today}`);

    if (error) {
        logger.error(`[CRON] Erro ao buscar assinaturas 1 dia: ${error.message}`);
        return;
    }

    if (!subs || subs.length === 0) {
        logger.info('[CRON] Nenhuma assinatura a expirar hoje.');
        return;
    }

    let sent = 0;
    let failed = 0;
    for (let i = 0; i < subs.length; i += SMS_BATCH_SIZE) {
        const batch = subs.slice(i, i + SMS_BATCH_SIZE);
        await Promise.all(batch.map(async (sub) => {
            if (!sub.user?.phone) return;
            try {
                await sendFinalDayExpirySms(sub.user.phone);
                await supabase
                    .from('ecoflix_subscriptions')
                    .update({ sms_notified_at: new Date().toISOString() })
                    .eq('id', sub.id);
                sent++;
            } catch (e) {
                failed++;
                logger.warn(`[CRON] Falha SMS 1d sub ${sub.id}: ${e.message}`);
            }
        }));
        if (i + SMS_BATCH_SIZE < subs.length) {
            await sleep(SMS_BATCH_DELAY_MS);
        }
    }
    logger.info(`[CRON] Notificações Último Dia: ${sent} enviadas, ${failed} falhadas`);
};

const processExpirations = async () => {
    const today = new Date().toISOString().split('T')[0];

    // Atomic: mark as EXPIRED in one shot to avoid re-processing on restart
    const { data: expiredSubs, error } = await supabase
        .from('ecoflix_subscriptions')
        .update({ status: 'EXPIRED', updated_at: new Date().toISOString() })
        .eq('status', 'ACTIVE')
        .lt('end_date', today)
        .select(`
            id, 
            profile_id,
            master_account_id,
            profile:ecoflix_profiles ( name, master_account:ecoflix_master_accounts(email) )
        `);

    if (error) {
        logger.error(`[CRON] Erro ao processar expirações: ${error.message}`);
        return;
    }

    if (!expiredSubs || expiredSubs.length === 0) {
        logger.info('[CRON] Nenhuma assinatura para expirar/reciclar hoje.');
        return;
    }

    const adminPhone = process.env.ADMIN_PHONE;
    if (!adminPhone) {
        logger.warn('[CRON] ADMIN_PHONE não definido. Notificações admin desactivadas.');
    }

    let recycled = 0;
    let exclusiveFreed = 0;

    for (const sub of expiredSubs) {
        if (sub.profile_id) {
            // Shared profile: recycle
            const newPin = Math.floor(Math.random() * 9000 + 1000).toString();
            await supabase.from('ecoflix_profiles').update({
                status: 'AVAILABLE',
                client_phone: null,
                client_name: null,
                expires_at: null,
                pin: newPin
            }).eq('id', sub.profile_id);

            if (adminPhone) {
                try {
                    const email = sub.profile?.master_account?.email || 'Desconhecido';
                    const profileName = sub.profile?.name || 'Desconhecido';
                    await sendAdminPinExpiredSms(adminPhone, email, profileName, newPin);
                } catch (e) {
                    logger.warn(`[CRON] Falha SMS admin sub ${sub.id}: ${e.message}`);
                }
            }
            recycled++;
        } else if (sub.master_account_id) {
            // Exclusive account: free the slot
            await supabase
                .from('ecoflix_master_accounts')
                .update({ status: 'INACTIVE' })
                .eq('id', sub.master_account_id);
            exclusiveFreed++;
        }
    }

    logger.info(`[CRON] Expirações: ${recycled} perfis reciclados, ${exclusiveFreed} contas exclusivas libertadas`);
};

module.exports = {
    initializeCron,
    notify5DaysExpiry,
    notifyFinalDayExpiry,
    processExpirations
};
