/**
 * Payment Controller
 * Handles HTTP requests for payments (PayGo, Webhooks, Status Checks)
 */

const crypto = require('crypto');
const supabase = require('../../../src/config/supabase');
const axios = require('axios');
const planService = require('../services/plan.service');
const websocket = require('../../../src/websocket');
const paymentService = require('../services/payment.service');
const { redisClient } = require('../../../src/config/redis');
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'ecoflix-super-secret-key';

// Helper: Verify HMAC Signature (inline to avoid circular dependency)
const verifySignature = (payload, signature, secret) => {
    if (!signature || !secret) return false;
    const hmac = crypto.createHmac('sha256', secret);
    const digest = hmac.update(payload).digest('hex');
    const signatureBuffer = Buffer.from(signature);
    const digestBuffer = Buffer.from(digest);
    if (signatureBuffer.length !== digestBuffer.length) return false;
    return crypto.timingSafeEqual(signatureBuffer, digestBuffer);
};

const PaymentProviderFactory = require('../services/payment_factory.service');
const { broadcast: sseBroadcast } = require('./sse.controller');

// ============================================================================
// CUSTOMER: Init Payment (Reference or Push)
// ============================================================================
const initPayment = async (req, res) => {
    try {
        const { phone, plan_type, payment_method, coupon_code } = req.body; // method: REFERENCE, MCX_PUSH, UNITEL_MONEY, EXPRESS

        // Validate plan
        const plans = await planService.getPlans();

        if (!plans[plan_type]) {
            return res.status(400).json({ success: false, message: 'Plano inválido' });
        }

        let amount = plans[plan_type].price;
        let couponUsed = null;

        // --- COUPON VALIDATION ---
        if (coupon_code) {
            const { data: coupon } = await supabase
                .from('ecoflix_coupons')
                .select('*')
                .eq('code', coupon_code.toUpperCase())
                .eq('status', 'ACTIVE')
                .single();

            if (coupon) {
                // Check inventory tag if exists
                if (coupon.inventory_tag) {
                    const { data: stockCount } = await supabase.rpc('check_tagged_stock', { tag_name: coupon.inventory_tag });
                    if (stockCount <= 0) {
                        return res.status(400).json({ success: false, message: 'O lote deste código esgotou.' });
                    }
                }

                // Apply Discount
                if (coupon.discount_amount > 0) {
                    amount = Math.max(0, amount - coupon.discount_amount);
                }

                couponUsed = coupon.code;
            }
        }

        // Get User
        const { data: user } = await supabase.from('ecoflix_users').select('id').eq('phone', phone).single();

        // --- PAIMENT GATEWAY INTEGRATION ---
        let paymentResult;
        try {
            const provider = PaymentProviderFactory.getProvider(payment_method);
            paymentResult = await provider.initiatePayment({
                amount,
                phone,
                plan_type,
                payment_method,
                paygo_id: plans[plan_type].paygo_id
            });
        } catch (error) {
            return res.status(502).json({ success: false, message: error.message });
        }

        // Create order
        const { data: order, error } = await supabase
            .from('ecoflix_orders')
            .insert({
                user_id: user.id,
                reference_id: paymentResult.reference,
                transaction_id: paymentResult.transaction_id,
                entity: paymentResult.entity,
                plan_type,
                amount,
                phone,
                payment_method: payment_method === 'EXPRESS' ? 'MCX_PUSH' : 'REFERENCE',
                coupon_used: couponUsed
            })
            .select()
            .single();

        if (error) throw error;

        res.status(201).json({
            success: true,
            data: {
                order_id: order.id,
                entity: paymentResult.entity,
                reference: paymentResult.reference ? paymentResult.reference.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3') : null,
                amount: amount,
                transaction_id: paymentResult.transaction_id,
                expires_at: order.expires_at,
                message: paymentResult.message
            }
        });
    } catch (error) {
        console.error('Create order error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ============================================================================
// PUBLIC: Quick Order (no auth, just HMAC)
// ============================================================================
const quickOrder = async (req, res) => {
    try {
        const { phone, plan_type, payment_method, is_renewal, target_subscription_id, duration } = req.body;

        const plans = await planService.getPlans();

        if (!plans[plan_type]) {
            return res.status(400).json({ success: false, message: 'Plano inválido' });
        }

        const durationMonths = parseInt(duration) || 1;
        const totalAmount = plans[plan_type].price * durationMonths;

        // Pré-validação de Stock antes de gerar a cobrança (não aplicável para renovações)
        if (!is_renewal) {
            const isExclusive = ['FAMILIA', 'COMPLETA', 'INTEIRA'].includes(plan_type);
            if (isExclusive) {
                const { data: accounts } = await supabase
                    .from('ecoflix_master_accounts')
                    .select('id, subscriptions:ecoflix_subscriptions(status)')
                    .eq('type', 'EXCLUSIVE')
                    .eq('status', 'ACTIVE');
                const hasStock = accounts && accounts.some(acc => !acc.subscriptions || acc.subscriptions.filter(s => ['ACTIVE', 'SUSPENDED'].includes(s.status)).length === 0);
                if (!hasStock) {
                    return res.status(400).json({ success: false, message: 'Stock esgotado para este plano no momento. Tente novamente mais tarde.' });
                }
            } else {
                const { count } = await supabase
                    .from('ecoflix_profiles')
                    .select('*', { count: 'exact', head: true })
                    .eq('type', plan_type === 'ECONOMICO' ? 'MOBILE' : 'TV')
                    .eq('status', 'AVAILABLE');
                if (!count || count === 0) {
                    return res.status(400).json({ success: false, message: 'Stock esgotado para este plano no momento. Tente novamente mais tarde.' });
                }
            }
        }

        let { data: userData, error: userError } = await supabase.from('ecoflix_users').select('id, phone').eq('phone', phone).maybeSingle();

        let user = userData;
        if (!user) {
            const { data: newUser, error: insertError } = await supabase
                .from('ecoflix_users')
                .insert({ phone, verified_at: new Date() })
                .select('id, phone')
                .single();
            
            if (insertError) {
                console.error("Erro ao inserir novo utilizador:", insertError);
                return res.status(500).json({ success: false, message: 'Falha ao registar cliente no sistema' });
            }
            user = newUser;
        }

        // Cancela qualquer pedido pendente anterior deste utilizador
        // para garantir que ele possa iniciar um novo fluxo sem bloqueios
        await supabase
            .from('ecoflix_orders')
            .update({ status: 'CANCELLED' })
            .eq('user_id', user.id)
            .eq('status', 'PENDING');

        const provider = PaymentProviderFactory.getProvider(payment_method);
        const paymentResult = await provider.initiatePayment({
            amount: totalAmount,
            phone,
            plan_type,
            payment_method,
            paygo_id: plans[plan_type].paygo_id
        });

        const dbPaymentMethod = payment_method === 'EXPRESS' ? 'MCX_PUSH' : 'REFERENCE';

        const { data: order, error } = await supabase
            .from('ecoflix_orders')
            .insert({
                user_id: user.id,
                reference_id: paymentResult.reference,
                transaction_id: paymentResult.transaction_id,
                entity: paymentResult.entity,
                plan_type,
                amount: totalAmount,
                phone,
                payment_method: dbPaymentMethod,
                subscription_action: is_renewal ? 'RENEWAL' : 'NEW',
                target_subscription_id: is_renewal ? target_subscription_id : null,
                duration_months: durationMonths
            })
            .select()
            .single();

        if (error) throw error;

        res.status(201).json({
            success: true,
            data: {
                order_id: order.id,
                entity: paymentResult.entity,
                reference: paymentResult.reference ? String(paymentResult.reference).replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3') : null,
                amount: plans[plan_type].price,
                transaction_id: paymentResult.transaction_id,
                payment_method: payment_method,
                expires_at: order.expires_at,
                message: paymentResult.message
            }
        });
    } catch (error) {
        console.error('Quick order error:', error);
        res.status(400).json({ success: false, message: error.message });
    }
};

// ============================================================================
// CUSTOMER: Check Payment Status
// ============================================================================
const checkPaymentStatus = async (req, res) => {
    try {
        const { ref } = req.params;
        const cleanRef = ref.replace(/\s/g, '');

        let { data: order, error } = await supabase
            .from('ecoflix_orders')
            .select(`
                *,
                subscription:ecoflix_subscriptions!ecoflix_subscriptions_order_id_fkey(
                    id,
                    profile_id,
                    profile:ecoflix_profiles!fk_subscriptions_profile(
                        name, 
                        pin,
                        master_account:ecoflix_master_accounts!ecoflix_profiles_master_account_id_fkey(
                            email, 
                            password
                        )
                    )
                )
            `)
            .or(`reference_id.eq.${cleanRef},transaction_id.eq.${cleanRef}`)
            .single();

        if (error || !order) {
            return res.status(404).json({ success: false, message: 'Pedido não encontrado' });
        }

        let response = {
            success: true,
            status: order.status,
            plan_type: order.plan_type,
            amount: order.amount,
            rejection_reason: order.rejection_reason
        };

        // Fallback: Active Polling
        // Se a ordem ainda está PENDING no banco local, consultamos directamente o
        // provedor (PayGo) para ver se o webhook falhou ou atrasou.
        if (order.status === 'PENDING') {
            const paymentFactory = require('../services/payment_factory.service');
            const provider = paymentFactory.getProvider(order.payment_method);
            if (provider && provider.checkStatus) {
                const txId = order.transaction_id || order.reference_id;
                if (txId) {
                    console.log(`[Status] Polling provider for txId=${txId} method=${order.payment_method}`);
                    const providerStatus = await provider.checkStatus(txId);
                    console.log(`[Status] Provider returned: ${providerStatus.status}`);

                    if (providerStatus.status === 'PAID') {
                        const paymentService = require('../services/payment.service');
                        const result = await paymentService.processPayment(order);
                        console.log(`[Status] processPayment result: success=${result.success}`);

                        // Re-fetch order now with credentials via subscription join
                        const { data: updatedOrder, error: refetchErr } = await supabase
                            .from('ecoflix_orders')
                            .select(`
                                *,
                                subscription:ecoflix_subscriptions!ecoflix_subscriptions_order_id_fkey(
                                    id,
                                    profile_id,
                                    profile:ecoflix_profiles!fk_subscriptions_profile(
                                        name,
                                        pin,
                                        master_account:ecoflix_master_accounts!ecoflix_profiles_master_account_id_fkey(
                                            email,
                                            password
                                        )
                                    )
                                )
                            `)
                            .eq('id', order.id)
                            .single();

                        if (refetchErr) {
                            console.error(`[Status] Re-fetch error after processPayment:`, refetchErr.message);
                        } else if (updatedOrder) {
                            order = updatedOrder;
                        }
                    } else if (providerStatus.status === 'FAILED') {
                        await supabase
                            .from('ecoflix_orders')
                            .update({ status: 'CANCELLED', rejection_reason: 'Recusado na verificação' })
                            .eq('id', order.id);
                        order.status = 'FAILED';
                    }
                }
            }
        }

        // Sync response status from latest order state
        response.status = order.status;

        // If paid, fetch credentials
        if (order.status === 'PAID') {
            let email, password, profileName, profilePin;

            // --- Tentativa 1: via JOIN na ordem (dados já carregados acima) ---
            const sub = order.subscription?.[0];
            if (sub?.profile?.master_account) {
                email = sub.profile.master_account.email;
                password = sub.profile.master_account.password;
                profileName = sub.profile.name;
                profilePin = sub.profile.pin;
                console.log(`[Status] Credentials via JOIN for order ${order.id}: email=${email}`);
            }

            // --- Tentativa 2: query directa à subscrição (fallback robusto) ---
            if (!email) {
                console.log(`[Status] JOIN miss for order ${order.id}, trying direct subscription query...`);
                const { data: subData, error: subErr } = await supabase
                    .from('ecoflix_subscriptions')
                    .select(`
                        profile:ecoflix_profiles!fk_subscriptions_profile(
                            name,
                            pin,
                            master_account:ecoflix_master_accounts!ecoflix_profiles_master_account_id_fkey(
                                email,
                                password
                            )
                        )
                    `)
                    .eq('order_id', order.id)
                    .single();

                if (subErr) {
                    console.error(`[Status] Subscription query error for order ${order.id}:`, subErr.message);
                } else if (subData?.profile) {
                    profileName = subData.profile.name;
                    profilePin = subData.profile.pin;
                    if (subData.profile.master_account) {
                        email = subData.profile.master_account.email;
                        password = subData.profile.master_account.password;
                        console.log(`[Status] Credentials via fallback query: email=${email}`);
                    } else {
                        console.warn(`[Status] Profile found but master_account is null for order ${order.id}`);
                    }
                } else {
                    console.warn(`[Status] No subscription found for order ${order.id}`);
                }
            }

            response.credentials = {
                email,
                password,
                profile: profileName,
                pin: profilePin
            };

            // Generate Token for Auto-Login
            if (order.user_id && order.phone) {
                response.token = jwt.sign(
                    { id: order.user_id, phone: order.phone },
                    JWT_SECRET,
                    { expiresIn: '1h' }
                );
            }
        }

        res.json(response);
    } catch (error) {
        console.error('Check status error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ============================================================================
// CUSTOMER: Renew Subscription
// ============================================================================
const renewSubscription = async (req, res) => {
    try {
        const { payment_method } = req.body;
        const userId = req.user.id;

        // Check Existing Sub
        const { data: sub } = await supabase
            .from('ecoflix_subscriptions')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (!sub) {
            return res.status(400).json({ success: false, message: 'Nenhuma assinatura anterior encontrada para renovar.' });
        }

        const isExpired = new Date(sub.expires_at) < new Date();
        const action = isExpired ? 'NEW' : 'RENEWAL';
        const targetSubId = isExpired ? null : sub.id;

        const plans = await planService.getPlans();
        const amount = plans[sub.plan_type];

        // --- PAYMENT PROVIDER ---
        let paymentResult;
        try {
            const provider = PaymentProviderFactory.getProvider(payment_method);
            paymentResult = await provider.initiatePayment({
                amount,
                phone: req.user.phone,
                plan_type: sub.plan_type,
                payment_method
            });
        } catch (e) {
            return res.status(502).json({ success: false, message: e.message });
        }

        // Create Order
        const { data: order, error } = await supabase
            .from('ecoflix_orders')
            .insert({
                user_id: userId,
                reference_id: paymentResult.reference,
                transaction_id: paymentResult.transaction_id,
                entity: paymentResult.entity,
                plan_type: sub.plan_type,
                amount,
                phone: req.user.phone,
                payment_method,
                subscription_action: action,
                target_subscription_id: targetSubId
            })
            .select()
            .single();

        if (error) throw error;

        res.status(201).json({
            success: true,
            data: {
                order_id: order.id,
                action: action,
                reference: paymentResult.reference,
                amount: amount,
                entity: paymentResult.entity
            }
        });

    } catch (error) {
        console.error('Renew error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ============================================================================
// ADMIN: Confirm Payment Manually
// ============================================================================
const confirmPayment = async (req, res) => {
    try {
        const { id } = req.params;

        // Get the order
        const { data: order, error: orderError } = await supabase
            .from('ecoflix_orders')
            .select('*')
            .eq('id', id)
            .single();

        if (orderError || !order) {
            return res.status(404).json({ success: false, message: 'Pedido não encontrado' });
        }

        if (order.status === 'PAID') {
            return res.status(400).json({ success: false, message: 'Pedido já está pago' });
        }

        // Process the payment via Service
        const result = await paymentService.processPayment(order);
        if (result.success) {
            websocket.broadcastToOrder(order.id, { type: 'payment_update', status: 'PAID' });
            websocket.broadcast({ type: 'stock_update' }, 'all');
            websocket.broadcast({ type: 'new_order', message: `Pagamento confirmado para o pedido ${order.id}` }, 'admin');
            sseBroadcast('order_paid', {
                order_id: order.id,
                phone:    order.phone,
                plan:     order.plan_type,
                amount:   order.amount,
                ts:       Date.now(),
            });
        }
        res.json(result);
    } catch (error) {
        console.error('Confirm payment error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ============================================================================
// CUSTOMER: Cancel Pending Order
// ============================================================================
const cancelOrder = async (req, res) => {
    try {
        const { id } = req.params;

        const { data: order, error } = await supabase
            .from('ecoflix_orders')
            .select('id, status, phone')
            .eq('id', id)
            .single();

        if (error || !order) {
            return res.status(404).json({ success: false, message: 'Pedido não encontrado' });
        }

        if (order.status !== 'PENDING') {
            return res.status(400).json({ success: false, message: 'Pedido já foi processado' });
        }

        if (!req.admin) {
            const { phone } = req.body;
            const cleanPhone = order.phone.replace(/[^0-9]/g, '');
            const cleanInput = (phone || '').replace(/[^0-9]/g, '');
            if (!cleanInput || !cleanPhone.endsWith(cleanInput.slice(-9))) {
                return res.status(403).json({ success: false, message: 'Número de telemóvel não corresponde ao pedido' });
            }
        }

        await supabase
            .from('ecoflix_orders')
            .update({ status: 'CANCELLED', rejection_reason: 'Cancelado pelo utilizador', updated_at: new Date() })
            .eq('id', id);

        res.json({ success: true, message: 'Pedido cancelado' });
    } catch (error) {
        console.error('Cancel order error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ============================================================================
// WEBHOOK: PayGo Payment Notification
// ============================================================================
const paygoWebhook = async (req, res) => {
    try {
        const payload = req.body;
        const signature = req.headers['x-webhook-signature'];

        console.log(`[PayGo Webhook] Received:`, payload);

        // Security Check
        const secret = process.env.PAYGOOO_WEBHOOK_SECRET;
        if (secret) {
            const rawBody = JSON.stringify(req.body);
            if (!verifySignature(rawBody, signature, secret)) {
                console.warn('[PayGo Webhook] Invalid Signature');
                return res.status(401).json({ success: false, message: 'Invalid Signature' });
            }
        } else {
            console.warn('[PayGo Webhook] PAYGOOO_WEBHOOK_SECRET not set. Skipping signature verification.');
        }

        const status = payload.status || (payload.payment && payload.payment.status);
        const transaction_id = payload.payment_id || (payload.payment && payload.payment.id) || payload.id;
        const event = payload.event || status;

        if (event === 'success' || event === 'paid' || status === 'completed') {
            if (!transaction_id) {
                return res.status(400).json({ success: false, message: 'Missing transaction_id in webhook' });
            }

            // --- REDIS IDEMPOTENCY ---
            if (redisClient) {
                const idempotencyKey = `ecoflix:processed_paygo_tx:${transaction_id}`;
                const alreadyProcessed = await redisClient.get(idempotencyKey);
                if (alreadyProcessed) {
                    console.warn(`[PayGo Webhook] Duplicate detected for TX: ${transaction_id}. skipping.`);
                    return res.status(200).json({ success: true, message: 'Already processed' });
                }
                // Mark as processing (expire in 24h)
                await redisClient.set(idempotencyKey, 'true', 'EX', 86400);
            }

            console.log(`[PayGo Webhook] Payment confirmed for TX: ${transaction_id}`);

            // Find Order
            const { data: order } = await supabase
                .from('ecoflix_orders')
                .select('*')
                .eq('transaction_id', transaction_id.toString())
                .single();

            if (order) {
                if (order.status === 'PENDING') {
                    // Atomic Assignment Logic via Service
                    const result = await paymentService.processPayment(order);
                    if (result.success) {
                        websocket.broadcastToOrder(order.id, { type: 'payment_update', status: 'PAID' });
                        websocket.broadcast({ type: 'stock_update' }, 'all');
                        websocket.broadcast({ type: 'new_order', message: `Pagamento recebido via PayGo: ${order.amount} Kz` }, 'admin');
                        sseBroadcast('order_paid', {
                            order_id: order.id,
                            phone:    order.phone,
                            plan:     order.plan_type,
                            amount:   order.amount,
                            ts:       Date.now(),
                        });
                    } else if (!result.success && result.message.includes('Sem stock')) {
                        console.warn(`[PayGo Webhook] Stock issue for order ${order.id}`);
                    }
                } else {
                    console.log('[PayGo Webhook] Order already processed:', order.id);
                }
            } else {
                console.warn(`[PayGo Webhook] Order not found for tx: ${transaction_id}`);
            }
        } else if (['failed', 'payment_failed', 'cancelled', 'canceled'].includes(event) || ['failed', 'cancelled', 'canceled'].includes(status)) {
            if (transaction_id) {
                console.log(`[PayGo Webhook] Payment failed or cancelled for TX: ${transaction_id}`);
                const rejectionReason = payload.reason || payload.message || 'Cancelado pelo utilizador ou falha na rede';

                const { data: order } = await supabase
                    .from('ecoflix_orders')
                    .update({ status: 'CANCELLED', rejection_reason: rejectionReason, updated_at: new Date() })
                    .eq('transaction_id', transaction_id.toString())
                    .eq('status', 'PENDING')
                    .select()
                    .single();

                if (order) {
                    const websocket = require('../../../src/websocket');
                    websocket.broadcastToOrder(order.id, { type: 'payment_update', status: 'CANCELLED' });
                }
            }
        }

        res.json({ success: true });
    } catch (error) {
        console.error('PayGo Webhook Error:', error);
        res.status(500).send('Erro no servidor');
    }
};

// ============================================================================
// TEST: Simulate Webhook (Manual Trigger)
// ============================================================================
const simulateWebhook = async (req, res) => {
    try {
        const { reference_id, amount } = req.body;

        const { data: order } = await supabase
            .from('ecoflix_orders')
            .select('transaction_id, payment_method')
            .eq('reference_id', reference_id.replace(/\s/g, ''))
            .single();

        if (!order) return res.status(404).json({ message: 'Order not found' });

        const payload = {
            reference: reference_id.replace(/\s/g, ''),
            amount: amount,
            transaction_id: order.transaction_id,
            payment_id: order.transaction_id,
            status: 'paid',
            simulated: true
        };

        const port = process.env.PORT || 3000;
        const endpoint = 'paygooo';
        const localUrl = `http://localhost:${port}/api/ecoflix/webhooks/${endpoint}`;

        try {
            const secret = process.env.PAYGOOO_WEBHOOK_SECRET;
            let headers = {};
            if (secret) {
                const hmac = crypto.createHmac('sha256', secret);
                const signature = hmac.update(JSON.stringify(payload)).digest('hex');
                headers['x-webhook-signature'] = signature;
            }
            await axios.post(localUrl, payload, { headers });
            res.json({ success: true, message: 'Webhook triggered successfully' });
        } catch (e) {
            res.status(500).json({ success: false, message: 'Failed to trigger webhook: ' + e.message });
        }

    } catch (error) {
        console.error('Simulation error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    initPayment,
    quickOrder,
    checkPaymentStatus,
    renewSubscription,
    confirmPayment,
    paygoWebhook,
    simulateWebhook,
    cancelOrder
};
