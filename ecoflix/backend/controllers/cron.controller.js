/**
 * Cron Controller
 * Handles background tasks (Expiry warnings, Cleanup)
 */

const supabase = require('../../../src/config/supabase');
const smsService = require('../services/sms.service');

// Helper: Verify Cron Auth
const verifyCronAuth = (req) => {
    const { token } = req.query;
    const secret = process.env.CRON_SECRET || process.env.SHEETS_SYNC_TOKEN;
    if (!token || token !== secret) {
        throw new Error('Unauthorized Cron Access');
    }
};

const cronExpiryWarning = async (req, res) => {
    try {
        verifyCronAuth(req);

        // Group 1: 5 Days Warning
        const target5Days = new Date();
        target5Days.setDate(target5Days.getDate() + 5);
        const str5Days = target5Days.toISOString().split('T')[0];

        // Group 2: 0 Days (Today) Warning
        const targetToday = new Date();
        const strToday = targetToday.toISOString().split('T')[0];

        // 5 Days Query
        const { data: subs5Days, error: err5 } = await supabase
            .from('ecoflix_subscriptions')
            .select('id, expires_at, ecoflix_users!inner ( phone )')
            .eq('status', 'ACTIVE')
            .gte('expires_at', `${str5Days}T00:00:00`)
            .lte('expires_at', `${str5Days}T23:59:59`);

        if (err5) throw err5;

        // 0 Days Query
        const { data: subsToday, error: err0 } = await supabase
            .from('ecoflix_subscriptions')
            .select('id, expires_at, ecoflix_users!inner ( phone )')
            .eq('status', 'ACTIVE')
            .gte('expires_at', `${strToday}T00:00:00`)
            .lte('expires_at', `${strToday}T23:59:59`);

        if (err0) throw err0;

        console.log(`[Cron] Found ${subs5Days.length} expiring in 5 days, ${subsToday.length} expiring today.`);

        let sent5 = 0;
        let sent0 = 0;

        // Process 5 Days
        for (const sub of subs5Days) {
            try {
                const phone = sub.ecoflix_users.phone;
                const msg = `EcoFlix: A sua conta expira em 5 dias (${new Date(sub.expires_at).toLocaleDateString('pt-PT')}). Renove agora para manter o historico.`;
                await smsService.sendSms(phone, msg);
                sent5++;
            } catch (e) {
                console.error(`[Cron] SMS Failed for 5 Days ${sub.id}`, e);
            }
        }

        // Process 0 Days
        for (const sub of subsToday) {
            try {
                const phone = sub.ecoflix_users.phone;
                const msg = `EcoFlix: O seu prazo de validade termina HOJE! Renove agora mesmo para evitar a interrupcao do servico e perda do perfil.`;
                await smsService.sendSms(phone, msg);
                sent0++;
            } catch (e) {
                console.error(`[Cron] SMS Failed for 0 Days ${sub.id}`, e);
            }
        }

        res.json({ success: true, processed_5_days: subs5Days.length, sent_5_days: sent5, processed_today: subsToday.length, sent_today: sent0 });

    } catch (error) {
        console.error('Cron Warning Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const cronCleanup = async (req, res) => {
    try {
        verifyCronAuth(req);

        // 1. Mark Expired
        const { data: expiredResult, error: expireError } = await supabase
            .from('ecoflix_subscriptions')
            .update({ status: 'EXPIRED' })
            .lt('expires_at', new Date().toISOString())
            .eq('status', 'ACTIVE')
            .select();

        if (expireError) throw expireError;

        // 2. Free Slots
        const released = [];
        for (const sub of expiredResult) {
            const { count } = await supabase
                .from('ecoflix_subscriptions')
                .select('*', { count: 'exact', head: true })
                .eq('profile_id', sub.profile_id)
                .eq('status', 'ACTIVE');

            if (count === 0) {
                await supabase
                    .from('ecoflix_profiles')
                    .update({ status: 'AVAILABLE' })
                    .eq('id', sub.profile_id);
                released.push(sub.profile_id);
            }
        }

        // 3. Cancel Abandoned Pending Orders
        const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
        const { data: cancelledOrders, error: cancelError } = await supabase
            .from('ecoflix_orders')
            .update({ status: 'CANCELLED' })
            .eq('status', 'PENDING')
            .lt('created_at', fifteenMinsAgo)
            .select('id');

        if (cancelError) throw cancelError;

        res.json({
            success: true,
            expired_count: expiredResult.length,
            slots_released: released.length,
            released_ids: released,
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
