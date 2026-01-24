/**
 * Cron Controller
 * Handles background tasks (Expiry warnings, Cleanup)
 */

const supabase = require('../../config/supabase');
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

        // Find subscriptions expiring in 3 days
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + 3);
        const targetStr = targetDate.toISOString().split('T')[0];

        const { data: subs, error } = await supabase
            .from('ecoflix_subscriptions')
            .select(`
                id, expires_at,
                ecoflix_users!inner ( phone )
            `)
            .eq('status', 'ACTIVE')
            .gte('expires_at', `${targetStr}T00:00:00`)
            .lte('expires_at', `${targetStr}T23:59:59`);

        if (error) throw error;

        console.log(`[Cron] Found ${subs.length} expiring in 3 days.`);

        let sent = 0;
        for (const sub of subs) {
            try {
                const phone = sub.ecoflix_users.phone;
                const msg = `EcoFlix: A sua conta expira em 3 dias (${new Date(sub.expires_at).toLocaleDateString()}). Renove agora para manter o historico.`;
                await smsService.sendSms(phone, msg);
                sent++;
            } catch (e) {
                console.error(`[Cron] SMS Failed for ${sub.id}`, e);
            }
        }

        res.json({ success: true, processed: subs.length, sent });

    } catch (error) {
        console.error('Cron Warning Error:', error);
        res.status(401).json({ success: false, message: error.message });
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

        res.json({
            success: true,
            expired_count: expiredResult.length,
            slots_released: released.length,
            released_ids: released
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
