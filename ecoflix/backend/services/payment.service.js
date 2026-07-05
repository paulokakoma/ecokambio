const supabase = require('../../../src/config/supabase');
const { smsQueue } = require('./sms_queue.service');
const smsService = require('./sms.service');
const websocket = require('../../../src/websocket');

// ============================================================================
// Helpers
// ============================================================================

const profileTypeForPlan = (planType) => {
    const map = { ECONOMICO: 'MOBILE', ULTRA: 'TV', FAMILIA: 'EXCLUSIVE', COMPLETA: 'EXCLUSIVE', INTEIRA: 'EXCLUSIVE' };
    return map[planType] || 'TV';
};

const sendCredentialsSms = async (phone, credentials) => {
    if (smsQueue) {
        await smsQueue.add('enviar-credencial', { phone, credentials }, {
            attempts: 3,
            backoff: { type: 'exponential', delay: 5000 }
        });
    } else {
        const result = await smsService.sendDeliverySms(phone, credentials);
        console.log(`[SMS] Result for ${phone}: success=${result.success} ${result.error || ''}`);
    }
};

const handleOutOfStock = async (order) => {
    await supabase.from('ecoflix_orders').update({ status: 'STOCK_OUT' }).eq('id', order.id);
    websocket.broadcastToOrder(order.id, { type: 'payment_update', status: 'STOCK_OUT' });
    return {
        success: true,
        message: 'Pagamento recebido, mas stock temporariamente esgotado. A sua conta será enviada em breve.',
        stockOut: true
    };
};

// ============================================================================
// Post-payment sync: Guarantees all records are consistent
// Runs after any successful payment assignment.
// ============================================================================
const syncAfterPayment = async ({ orderId, profileId, masterAccountId, subscriptionId, phone, expiresAt, amount }) => {
    console.log(`[Sync] Running post-payment sync for order=${orderId}`);

    const updates = [];

    // 1. Ensure the order is marked PAID
    updates.push(
        supabase.from('ecoflix_orders')
            .update({ status: 'PAID', paid_at: new Date(), updated_at: new Date() })
            .eq('id', orderId)
    );

    // 2. Ensure the subscription is ACTIVE with correct expiry
    if (subscriptionId) {
        updates.push(
            supabase.from('ecoflix_subscriptions')
                .update({ status: 'ACTIVE', expires_at: expiresAt })
                .eq('id', subscriptionId)
        );
    }

    // 3. Ensure the profile has correct client info
    if (profileId) {
        updates.push(
            supabase.from('ecoflix_profiles')
                .update({
                    status: 'SOLD',
                    client_phone: phone,
                    expires_at: expiresAt,
                    updated_at: new Date()
                })
                .eq('id', profileId)
        );
    }

    // 4. Track Revenue
    if (amount && (profileId || masterAccountId)) {
        updates.push(
            supabase.rpc('increment_ecoflix_revenue', { 
                p_profile_id: profileId || null,
                p_master_account_id: masterAccountId || null,
                p_amount: amount 
            })
        );
    }

    const results = await Promise.allSettled(updates);
    let syncSuccess = true;
    results.forEach((r, i) => {
        if (r.status === 'rejected') {
            console.error(`[Sync] Update #${i} failed:`, r.reason?.message);
            syncSuccess = false;
        }
    });

    if (syncSuccess) {
        websocket.broadcastToOrder(orderId, { type: 'payment_update', status: 'PAID' });
    }

    console.log(`[Sync] Done for order=${orderId}`);
};

// ============================================================================
// assignProfile — for ECONOMICO / ULTRA plans (shared profiles)
// ============================================================================
const assignProfile = async (order) => {
    const profileType = profileTypeForPlan(order.plan_type);
    console.log(`[AssignProfile] Seeking AVAILABLE profile type=${profileType} for order=${order.id}`);

    const { data: profile, error: profileError } = await supabase
        .from('ecoflix_profiles')
        .select('*, master_account:ecoflix_master_accounts!ecoflix_profiles_master_account_id_fkey(email, password)')
        .eq('type', profileType)
        .eq('status', 'AVAILABLE')
        .limit(1)
        .single();

    if (profileError || !profile) {
        console.warn(`[AssignProfile] No AVAILABLE profile. Error: ${profileError?.message}`);
        return { success: false, message: 'STOCK_ESGOTADO' };
    }

    const durationMonths = order.duration_months || 1;
    const expiresAt = new Date(Date.now() + durationMonths * 30 * 24 * 60 * 60 * 1000).toISOString();

    // Atomic update — only succeeds if profile is still AVAILABLE (race condition guard)
    const { data: claimed, error: claimError } = await supabase
        .from('ecoflix_profiles')
        .update({
            status: 'SOLD',
            client_phone: order.phone,
            client_name: `${order.plan_type}_${order.phone}`,
            expires_at: expiresAt,
            updated_at: new Date()
        })
        .eq('id', profile.id)
        .eq('status', 'AVAILABLE')
        .select('*, master_account:ecoflix_master_accounts!ecoflix_profiles_master_account_id_fkey(email, password)');

    if (claimError) throw claimError;

    if (!claimed || claimed.length === 0) {
        console.warn(`[AssignProfile] Race condition on profile ${profile.id}. Retrying...`);
        return assignProfile(order);
    }

    const assignedProfile = claimed[0];
    console.log(`[AssignProfile] Claimed profile id=${assignedProfile.id} name="${assignedProfile.name}"`);

    // Create subscription
    const { data: subscription, error: subError } = await supabase
        .from('ecoflix_subscriptions')
        .insert({
            user_id: order.user_id,
            profile_id: assignedProfile.id,
            order_id: order.id,
            plan_type: order.plan_type,
            status: 'ACTIVE',
            expires_at: expiresAt,
            amount_paid: order.amount,
            coupon_code: order.coupon_used || null,
            start_date: new Date()
        })
        .select()
        .single();

    if (subError) throw subError;

    // Sync all records to guarantee consistency
    await syncAfterPayment({
        orderId: order.id,
        profileId: assignedProfile.id,
        subscriptionId: subscription.id,
        phone: order.phone,
        expiresAt,
        amount: order.amount
    });

    const account = assignedProfile.master_account;
    if (!account) throw new Error(`Conta mãe não encontrada para perfil ${assignedProfile.id}`);

    const credentials = {
        email: account.email,
        password: account.password,
        profile: assignedProfile.name,
        pin: assignedProfile.pin
    };

    await sendCredentialsSms(order.phone, credentials);

    return { success: true, credentials };
};

// ============================================================================
// assignExclusiveAccount — for FAMILIA / COMPLETA plans (exclusive accounts)
// ============================================================================
const assignExclusiveAccount = async (order) => {
    const { data: accounts, error: accError } = await supabase
        .from('ecoflix_master_accounts')
        .select('*, subscriptions:ecoflix_subscriptions(id, status)')
        .eq('type', 'EXCLUSIVE')
        .eq('status', 'ACTIVE');

    if (accError) return { success: false, message: 'STOCK_ESGOTADO' };

    const availableAccount = accounts.find(acc =>
        !acc.subscriptions || acc.subscriptions.filter(s => s.status === 'ACTIVE').length === 0
    );

    if (!availableAccount) return { success: false, message: 'STOCK_ESGOTADO' };

    const durationMonths = order.duration_months || 1;
    const expiresAt = new Date(Date.now() + durationMonths * 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: subscription, error: subError } = await supabase
        .from('ecoflix_subscriptions')
        .insert({
            user_id: order.user_id,
            master_account_id: availableAccount.id,
            profile_id: null,
            order_id: order.id,
            plan_type: order.plan_type,
            status: 'ACTIVE',
            expires_at: expiresAt,
            amount_paid: order.amount,
            coupon_code: order.coupon_used || null,
            start_date: new Date()
        })
        .select()
        .single();

    if (subError) throw subError;

    // Sync — no profile for exclusive, but order and subscription must be consistent
    await syncAfterPayment({
        orderId: order.id,
        profileId: null,
        subscriptionId: subscription.id,
        phone: order.phone,
        expiresAt,
        amount: order.amount
    });

    const credentials = {
        email: availableAccount.email,
        password: availableAccount.password,
        profile: 'Conta Exclusiva (Todos os Perfis)',
        pin: 'N/A'
    };

    await sendCredentialsSms(order.phone, credentials);

    return { success: true, credentials };
};

// ============================================================================
// extendSubscription — for renewals
// ============================================================================
const extendSubscription = async (order) => {
    const { data: sub, error: subError } = await supabase
        .from('ecoflix_subscriptions')
        .select('*, profile:ecoflix_profiles!fk_subscriptions_profile(id)')
        .eq('id', order.target_subscription_id)
        .single();

    if (subError || !sub) return { success: false, message: 'Assinatura não encontrada' };

    const currentExpiry = new Date(sub.expires_at);
    const now = new Date();
    const baseDate = currentExpiry > now ? currentExpiry : now;
    const durationMonths = order.duration_months || 1;
    const newExpiry = new Date(baseDate.getTime() + durationMonths * 30 * 24 * 60 * 60 * 1000).toISOString();

    // Sync all records
    await syncAfterPayment({
        orderId: order.id,
        profileId: sub.profile?.id || null,
        subscriptionId: sub.id,
        phone: order.phone,
        expiresAt: newExpiry
    });

    await smsService.sendRenewalSms(order.phone, newExpiry);

    return { success: true, new_expires_at: newExpiry };
};

// ============================================================================
// addPartnerCommission
// ============================================================================
const addPartnerCommission = async (couponCode, planType) => {
    try {
        const { data: coupon } = await supabase
            .from('ecoflix_coupons')
            .select('commission_mobile, commission_tv')
            .eq('code', couponCode)
            .single();

        if (!coupon) return;

        const amount = planType === 'ECONOMICO'
            ? (coupon.commission_mobile || 500)
            : (coupon.commission_tv || 700);

        await supabase
            .from('ecoflix_coupons')
            .update({
                usage_count: supabase.raw('COALESCE(usage_count, 0) + 1'),
                total_commission_due: supabase.raw(`COALESCE(total_commission_due, 0) + ${amount}`)
            })
            .eq('code', couponCode);
    } catch (err) {
        console.warn('[Commission] Error:', err.message);
    }
};

// ============================================================================
// processPayment — main entry point
// ============================================================================
const processPayment = async (order) => {
    try {
        console.log(`[ProcessPayment] order=${order.id} plan=${order.plan_type} action=${order.subscription_action || 'NEW'}`);

        if (order.subscription_action === 'RENEWAL' && order.target_subscription_id) {
            return await extendSubscription(order);
        }

        const isExclusive = ['FAMILIA', 'COMPLETA', 'INTEIRA'].includes(order.plan_type);

        const result = isExclusive
            ? await assignExclusiveAccount(order)
            : await assignProfile(order);

        if (!result.success) {
            return result.message === 'STOCK_ESGOTADO'
                ? handleOutOfStock(order)
                : result;
        }

        if (order.coupon_used) {
            await addPartnerCommission(order.coupon_used, order.plan_type);
        }

        return { success: true, credentials: result.credentials };

    } catch (error) {
        console.error('[ProcessPayment] Error:', error.message);
        return { success: false, message: error.message };
    }
};

module.exports = { processPayment, handleOutOfStock, syncAfterPayment };
