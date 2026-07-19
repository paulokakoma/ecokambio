const supabase = require('../../../src/config/supabase');
const { smsQueue } = require('./sms_queue.service');
const smsService = require('./sms.service');
const websocket = require('../../../src/websocket');
const stockMonitor = require('./stock-monitor.service');
const { redisClient } = require('../../../src/config/redis');

// In-memory guard for SMS idempotency (Redis-backed when available)
const smsSentGuard = new Set();

// ============================================================================
// Helpers
// ============================================================================

const profileTypeForPlan = (planType) => {
    const map = { ECONOMICO: 'MOBILE', ULTRA: 'TV', FAMILIA: 'EXCLUSIVE', COMPLETA: 'EXCLUSIVE', INTEIRA: 'EXCLUSIVE' };
    return map[planType] || 'TV';
};

const sendCredentialsSms = async (phone, credentials, orderId) => {
    // IDEMPOTENCY GUARD: Prevent sending duplicate SMS for the same order
    const guardKey = `sms_sent:${orderId || phone}`;
    
    // Check Redis first
    if (redisClient && redisClient.status === 'ready') {
        const alreadySent = await redisClient.get(guardKey);
        if (alreadySent) {
            console.log(`[SMS] Duplicado prevenido para order=${orderId}`);
            return { success: true, duplicate: true };
        }
        await redisClient.set(guardKey, '1', 'EX', 3600); // 1 hour TTL
    } else {
        // Fallback to in-memory guard
        if (smsSentGuard.has(guardKey)) {
            console.log(`[SMS] Duplicado prevenido (memória) para order=${orderId}, phone=${phone}`);
            return { success: true, duplicate: true };
        }
        smsSentGuard.add(guardKey);
        // Clean up after 1 hour
        setTimeout(() => smsSentGuard.delete(guardKey), 3600000);
    }

    console.log(`[SMS] A enviar credenciais para order=${orderId}`);

    if (smsQueue) {
        await smsQueue.add('enviar-credencial', { phone, credentials }, {
            attempts: 3,
            backoff: { type: 'exponential', delay: 5000 }
        });
    } else {
        const result = await smsService.sendDeliverySms(phone, credentials);
        console.log(`[SMS] Resultado: success=${result.success} ${result.error || ''}`);
    }
};

const handleOutOfStock = async (order) => {
    await supabase.from('ecoflix_orders').update({ status: 'STOCK_OUT' }).eq('id', order.id);
    websocket.broadcastToOrder(order.id, { type: 'payment_update', status: 'STOCK_OUT' });

    // Notificar o cliente por SMS que o stock está esgotado
    await smsService.sendStockOutSms(order.phone, order.plan_type).catch(err => {
        console.error(`[SMS] Falha ao enviar SMS de stock esgotado: ${err.message}`);
    });

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
const syncAfterPayment = async ({ orderId, profileId, masterAccountId, subscriptionId, phone, expiresAt, amount, credentials }) => {
    console.log(`[Sync] Executando sincronização pós-pagamento para order=${orderId}`);

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
            console.error(`[Sync] Atualização #${i} falhou:`, r.reason?.message);
            syncSuccess = false;
        }
    });

    if (syncSuccess) {
        websocket.broadcastToOrder(orderId, { type: 'payment_update', status: 'PAID' });
    }

    console.log(`[Sync] Concluído para order=${orderId}`);
};

// ============================================================================
// fetchCredentials — buscar credenciais completas da DB
// ============================================================================
const fetchCredentials = async (orderId, profileId, masterAccountId) => {
    try {
        // 1. Via profile_id
        if (profileId) {
            const { data } = await supabase
                .from('ecoflix_profiles')
                .select('name, pin, master_account:ecoflix_master_accounts!ecoflix_profiles_master_account_id_fkey(email, password)')
                .eq('id', profileId)
                .single();

            if (data?.master_account) {
                return {
                    email: data.master_account.email,
                    password: data.master_account.password,
                    profile: data.name,
                    pin: data.pin
                };
            }
        }

        // 2. Via master_account_id (contas exclusivas)
        if (masterAccountId) {
            const { data } = await supabase
                .from('ecoflix_master_accounts')
                .select('email, password')
                .eq('id', masterAccountId)
                .single();

            if (data) {
                return { email: data.email, password: data.password, profile: null, pin: null };
            }
        }

        // 3. Via subscription → order_id
        if (orderId) {
            const { data } = await supabase
                .from('ecoflix_subscriptions')
                .select(`
                    profile:ecoflix_profiles!fk_subscriptions_profile(
                        name, pin,
                        master_account:ecoflix_master_accounts!ecoflix_profiles_master_account_id_fkey(email, password)
                    ),
                    account:ecoflix_master_accounts(email, password)
                `)
                .eq('order_id', orderId)
                .single();

            if (data) {
                const master = data.account || data.profile?.master_account;
                if (master) {
                    return {
                        email: master.email,
                        password: master.password,
                        profile: data.profile?.name || null,
                        pin: data.profile?.pin || null
                    };
                }
            }
        }
    } catch (err) {
        console.error(`[FetchCreds] Erro:`, err.message);
    }
    return null;
};

// ============================================================================
// assignProfile — for ECONOMICO / ULTRA plans (shared profiles)
// ============================================================================
const assignProfile = async (order, attempt = 1) => {
    const profileType = profileTypeForPlan(order.plan_type);
    console.log(`[AssignProfile] Executando RPC Atómica para order=${order.id} (Tentativa ${attempt})`);

    const durationMonths = order.duration_months || 1;

    // Chamada à transação atómica RPC
    const { data: result, error } = await supabase.rpc('assign_profile_atomic', {
        p_order_id: order.id,
        p_type: profileType,
        p_phone: order.phone,
        p_duration_months: durationMonths
    });

    if (error) {
        console.error('[AssignProfile] Erro Fatal no RPC:', error.message);
        throw error;
    }

    if (!result.success) {
        if (result.message === 'CONCURRENCY_LOCKED') {
            if (attempt <= 3) {
                console.warn(`[AssignProfile] Bloqueio transacional detetado para order=${order.id}. Tentando novamente em 200ms...`);
                await new Promise(res => setTimeout(res, 200));
                return assignProfile(order, attempt + 1);
            }
            console.warn(`[AssignProfile] Máximo de retries atingido para order=${order.id}.`);
            return { success: false, message: 'STOCK_ESGOTADO' };
        }
        return { success: false, message: result.message }; // e.g. STOCK_ESGOTADO
    }

    console.log(`[AssignProfile] Perfil atribuído com sucesso via RPC para order=${order.id}.`);

    const expiresAt = new Date(Date.now() + durationMonths * 30 * 24 * 60 * 60 * 1000).toISOString();

    // Buscar credenciais completas da DB (o RPC pode retornar só o email)
    let credentials = await fetchCredentials(order.id, result.profile_id, null);
    if (!credentials) {
        // Fallback: usar o que o RPC retornou
        credentials = result.credentials || {};
    }
    credentials.plan_type = order.plan_type;
    credentials.expires_at = expiresAt;

    // Sincronização pós-pagamento (Garante métricas de faturação e Websockets)
    await syncAfterPayment({
        orderId: order.id,
        profileId: result.profile_id,
        subscriptionId: result.subscription_id,
        phone: order.phone,
        expiresAt,
        amount: order.amount,
        credentials: credentials
    });

    await sendCredentialsSms(order.phone, credentials, order.id);

    return { success: true, credentials: credentials };
};

// ============================================================================
// assignExclusiveAccount — for FAMILIA / COMPLETA plans (exclusive accounts)
// ============================================================================
const assignExclusiveAccount = async (order, attempt = 1) => {
    console.log(`[AssignExclusive] Executando RPC Atómica para order=${order.id} (Tentativa ${attempt})`);
    
    const durationMonths = order.duration_months || 1;

    // Chamada à transação atómica RPC
    const { data: result, error } = await supabase.rpc('assign_exclusive_account_atomic', {
        p_order_id: order.id,
        p_phone: order.phone,
        p_duration_months: durationMonths
    });

    if (error) {
        console.error('[AssignExclusive] Erro Fatal no RPC:', error.message);
        throw error;
    }

    if (!result.success) {
        if (result.message === 'CONCURRENCY_LOCKED') {
            if (attempt <= 3) {
                console.warn(`[AssignExclusive] Bloqueio transacional detetado para order=${order.id}. A tentar novamente em 200ms...`);
                await new Promise(res => setTimeout(res, 200));
                return assignExclusiveAccount(order, attempt + 1);
            }
            return { success: false, message: 'STOCK_ESGOTADO' };
        }
        return { success: false, message: result.message };
    }

    console.log(`[AssignExclusive] Conta Exclusiva atribuída com sucesso via RPC para order=${order.id}.`);

    const expiresAt = new Date(Date.now() + durationMonths * 30 * 24 * 60 * 60 * 1000).toISOString();

    // Buscar credenciais completas da DB
    let credentials = await fetchCredentials(order.id, null, result.master_account_id);
    if (!credentials) {
        credentials = result.credentials || {};
    }
    credentials.plan_type = order.plan_type;
    credentials.expires_at = expiresAt;

    // Sync — no profile for exclusive, mas order e faturação atualizam
    await syncAfterPayment({
        orderId: order.id,
        profileId: null,
        masterAccountId: result.master_account_id,
        subscriptionId: result.subscription_id,
        phone: order.phone,
        expiresAt,
        amount: order.amount,
        credentials: credentials
    });

    await sendCredentialsSms(order.phone, credentials, order.id);

    return { success: true, credentials: credentials };
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
        console.warn('[Commission] Erro:', err.message);
    }
};

// ============================================================================
// processPayment — main entry point
// ============================================================================
const processPayment = async (order) => {
    try {
        console.log(`[ProcessPayment] order=${order.id} plano=${order.plan_type} ação=${order.subscription_action || 'NOVA'}`);

        // IDEMPOTENCY: Only process PENDING orders. Check + mark atomically.
        const { data: locked, error: lockErr } = await supabase
            .from('ecoflix_orders')
            .update({ paid_at: new Date(), updated_at: new Date() })
            .eq('id', order.id)
            .eq('status', 'PENDING')
            .is('paid_at', null)
            .select('id')
            .single();

        if (lockErr || !locked) {
            console.log(`[ProcessPayment] Order ${order.id} já processado ou bloqueado. A ignorar.`);
            return { success: false, message: 'Pedido já processado' };
        }

        if (order.subscription_action === 'RENEWAL' && order.target_subscription_id) {
            return await extendSubscription(order);
        }

        const isExclusive = ['FAMILIA', 'COMPLETA', 'INTEIRA'].includes(order.plan_type);

        const result = isExclusive
            ? await assignExclusiveAccount(order)
            : await assignProfile(order);

        if (!result.success) {
            // Revert to PENDING so it can be retried
            await supabase
                .from('ecoflix_orders')
                .update({ status: 'PENDING', updated_at: new Date() })
                .eq('id', order.id);
            return result.message === 'STOCK_ESGOTADO'
                ? handleOutOfStock(order)
                : result;
        }

        if (order.coupon_used) {
            await addPartnerCommission(order.coupon_used, order.plan_type);
        }

        // Verificar stock e notificar admin se necessário (throttled internally)
        stockMonitor.checkAndNotify().catch(err => {
            console.error('[StockMonitor] Erro na verificação:', err.message);
        });

        return { success: true, credentials: result.credentials };

    } catch (error) {
        console.error('[ProcessPayment] Erro:', error.message);
        // Revert to PENDING on unexpected error
        await supabase
            .from('ecoflix_orders')
            .update({ status: 'PENDING', updated_at: new Date() })
            .eq('id', order.id)
            .eq('status', 'PROCESSING');
        return { success: false, message: 'Erro ao processar pagamento' };
    }
};

module.exports = { processPayment, handleOutOfStock, syncAfterPayment };
