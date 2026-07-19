/**
 * Cron Controller
 * Handles background tasks (Expiry warnings, Cleanup)
 */

const supabase = require('../../../src/config/supabase');
const smsService = require('../services/sms.service');

// Helper: Verify Cron Auth (header ou query)
const verifyCronAuth = (req) => {
    const token = req.headers['x-cron-secret'] || req.query.token;
    const secret = process.env.CRON_SECRET;
    if (!secret) {
        console.error('[Cron] CRON_SECRET não definido no .env');
        throw new Error('Cron não configurado');
    }
    if (!token || token !== secret) {
        throw new Error('Unauthorized Cron Access');
    }
};

// Helper: delay entre SMS para respeitar rate limit (5/2s)
const smsDelay = (ms = 500) => new Promise(resolve => setTimeout(resolve, ms));

// Helper: chunk array para processamento em lotes
const chunk = (arr, size) => {
    const chunks = [];
    for (let i = 0; i < arr.length; i += size) {
        chunks.push(arr.slice(i, i + size));
    }
    return chunks;
};

// ============================================================================
// CRON: Expiry Warnings (5 dias + hoje)
// ============================================================================
const cronExpiryWarning = async (req, res) => {
    try {
        verifyCronAuth(req);

        // 5 Dias: qualquer subscription que expira entre agora e 5 dias
        const now = new Date();
        const in5Days = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);

        const { data: subs5Days, error: err5 } = await supabase
            .from('ecoflix_subscriptions')
            .select('id, expires_at, notified_5day, ecoflix_users!inner(phone)')
            .eq('status', 'ACTIVE')
            .gte('expires_at', now.toISOString())
            .lte('expires_at', in5Days.toISOString())
            .is('notified_5day', false);

        if (err5) throw err5;

        // Hoje: qualquer subscription que expira hoje
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

        const { data: subsToday, error: err0 } = await supabase
            .from('ecoflix_subscriptions')
            .select('id, expires_at, notified_today, ecoflix_users!inner(phone)')
            .eq('status', 'ACTIVE')
            .gte('expires_at', startOfDay.toISOString())
            .lt('expires_at', endOfDay.toISOString())
            .is('notified_today', false);

        if (err0) throw err0;

        console.log(`[Cron] Found ${subs5Days.length} expiring in 5 days, ${subsToday.length} expiring today.`);

        let sent5 = 0;
        let sent0 = 0;
        const notifiedIds5 = [];
        const notifiedIds0 = [];

        // Process 5 Days — em lotes de 5 com delay
        const batches5 = chunk(subs5Days, 5);
        for (const batch of batches5) {
            const results = await Promise.allSettled(batch.map(async (sub) => {
                const phone = sub.ecoflix_users.phone;
                const dateStr = new Date(sub.expires_at).toLocaleDateString('pt-PT');
                const msg = `EcoFlix: A sua conta expira em 5 dias (${dateStr}). Renove agora para manter o acesso.`;
                await smsService.sendSms(phone, msg);
                return sub.id;
            }));

            results.forEach((r) => {
                if (r.status === 'fulfilled') {
                    sent5++;
                    notifiedIds5.push(r.value);
                } else {
                    console.error(`[Cron] SMS 5-day failed:`, r.reason?.message);
                }
            });

            if (batches5.indexOf(batch) < batches5.length - 1) {
                await smsDelay(2100); // 2s entre lotes (rate limit: 5/2s)
            }
        }

        // Process Today — em lotes de 5 com delay
        const batches0 = chunk(subsToday, 5);
        for (const batch of batches0) {
            const results = await Promise.allSettled(batch.map(async (sub) => {
                const phone = sub.ecoflix_users.phone;
                const msg = `EcoFlix: O seu prazo de validade termina HOJE! Renove agora mesmo para evitar a interrupcao do servico.`;
                await smsService.sendSms(phone, msg);
                return sub.id;
            }));

            results.forEach((r) => {
                if (r.status === 'fulfilled') {
                    sent0++;
                    notifiedIds0.push(r.value);
                } else {
                    console.error(`[Cron] SMS today failed:`, r.reason?.message);
                }
            });

            if (batches0.indexOf(batch) < batches0.length - 1) {
                await smsDelay(2100);
            }
        }

        // Marcar como notificados para evitar duplicados
        if (notifiedIds5.length > 0) {
            await supabase
                .from('ecoflix_subscriptions')
                .update({ notified_5day: true })
                .in('id', notifiedIds5);
        }

        if (notifiedIds0.length > 0) {
            await supabase
                .from('ecoflix_subscriptions')
                .update({ notified_today: true })
                .in('id', notifiedIds0);
        }

        res.json({
            success: true,
            processed_5_days: subs5Days.length,
            sent_5_days: sent5,
            processed_today: subsToday.length,
            sent_today: sent0
        });

    } catch (error) {
        console.error('Cron Warning Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ============================================================================
// CRON: Cleanup (expired subs, free slots, cancel abandoned orders)
// ============================================================================
const cronCleanup = async (req, res) => {
    try {
        verifyCronAuth(req);

        // 1. Mark Expired
        const { data: expiredResult, error: expireError } = await supabase
            .from('ecoflix_subscriptions')
            .update({ status: 'EXPIRED', updated_at: new Date() })
            .lt('expires_at', new Date().toISOString())
            .eq('status', 'ACTIVE')
            .select('id, profile_id, master_account_id');

        if (expireError) throw expireError;

        // 2. Free Slots — Shared profiles (profile_id not null)
        const released = [];
        const sharedExpired = expiredResult.filter(s => s.profile_id);

        for (const sub of sharedExpired) {
            const { count } = await supabase
                .from('ecoflix_subscriptions')
                .select('*', { count: 'exact', head: true })
                .eq('profile_id', sub.profile_id)
                .eq('status', 'ACTIVE');

            if (count === 0) {
                await supabase
                    .from('ecoflix_profiles')
                    .update({ status: 'AVAILABLE', updated_at: new Date() })
                    .eq('id', sub.profile_id);
                released.push(sub.profile_id);
            }
        }

        // 3. Free Slots — Exclusive accounts (master_account_id, no profile_id)
        const releasedExclusive = [];
        const exclusiveExpired = expiredResult.filter(s => !s.profile_id && s.master_account_id);

        for (const sub of exclusiveExpired) {
            const { count } = await supabase
                .from('ecoflix_subscriptions')
                .select('*', { count: 'exact', head: true })
                .eq('master_account_id', sub.master_account_id)
                .is('profile_id', null)
                .eq('status', 'ACTIVE');

            if (count === 0) {
                // No more active subscriptions — mark account as available
                await supabase
                    .from('ecoflix_master_accounts')
                    .update({ status: 'ACTIVE', updated_at: new Date() })
                    .eq('id', sub.master_account_id);
                releasedExclusive.push(sub.master_account_id);
            }
        }

        // 4. Cancel Abandoned Pending Orders (>15 min)
        const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
        const { data: cancelledOrders, error: cancelError } = await supabase
            .from('ecoflix_orders')
            .update({ status: 'CANCELLED', updated_at: new Date() })
            .eq('status', 'PENDING')
            .lt('created_at', fifteenMinsAgo)
            .select('id');

        if (cancelError) throw cancelError;

        // 5. Clean up old OTP codes (>24h)
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { error: otpCleanupErr } = await supabase
            .from('ecoflix_otp_codes')
            .delete()
            .lt('created_at', oneDayAgo);

        if (otpCleanupErr) console.warn('[Cron] OTP cleanup error:', otpCleanupErr.message);

        res.json({
            success: true,
            expired_count: expiredResult.length,
            slots_released: released.length,
            released_ids: released,
            exclusive_accounts_freed: releasedExclusive.length,
            released_exclusive_ids: releasedExclusive,
            abandoned_orders_cancelled: cancelledOrders.length
        });

    } catch (error) {
        console.error('Cron Cleanup Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    cronExpiryWarning,
    cronCleanup
};
