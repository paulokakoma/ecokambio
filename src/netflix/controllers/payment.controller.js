/**
 * Payment Controller
 * Handles HTTP requests for payments (AppyPay, Webhooks, Status Checks)
 */

const supabase = require('../../config/supabase');
const axios = require('axios');
const paymentService = require('../services/payment.service');
const { verifySignature } = require('../../utils/crypto');
const { redisClient } = require('../../config/redis');

const PaymentProviderFactory = require('../services/payment_factory.service');

// ============================================================================
// CUSTOMER: Init Payment (Reference or Push)
// ============================================================================
const initPayment = async (req, res) => {
    try {
        const { phone, plan_type, payment_method, coupon_code } = req.body; // method: REFERENCE, MCX_PUSH, UNITEL_MONEY, EXPRESS

        // Validate plan
        const plans = {
            'ECONOMICO': 4500,
            'ULTRA': 6500,
            'FAMILIA': 18000
        };

        if (!plans[plan_type]) {
            return res.status(400).json({ success: false, message: 'Plano inválido' });
        }

        let amount = plans[plan_type];
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
                payment_method
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
                payment_method,
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
// CUSTOMER: Check Payment Status
// ============================================================================
const checkPaymentStatus = async (req, res) => {
    try {
        const { ref } = req.params;
        const cleanRef = ref.replace(/\s/g, '');

        const { data: order, error } = await supabase
            .from('ecoflix_orders')
            .select(`
                *,
                subscription:ecoflix_subscriptions!ecoflix_subscriptions_order_id_fkey(
                    profile:ecoflix_profiles!ecoflix_profiles_master_account_id_fkey(name, pin),
                    account:ecoflix_master_accounts(email, password)
                )
            `)
            .eq('reference_id', cleanRef)
            .single();

        if (error || !order) {
            return res.status(404).json({ success: false, message: 'Pedido não encontrado' });
        }

        const response = {
            success: true,
            status: order.status,
            plan_type: order.plan_type,
            amount: order.amount
        };

        // If paid, include credentials
        if (order.status === 'PAID' && order.subscription?.[0]) {
            const sub = order.subscription[0];
            response.credentials = {
                email: sub.account?.email,
                password: sub.account?.password,
                profile: sub.profile?.name,
                pin: sub.profile?.pin
            };
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

        const plans = {
            'ECONOMICO': 4500,
            'ULTRA': 6500,
            'FAMILIA': 18000
        };
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
        res.json(result);
    } catch (error) {
        console.error('Confirm payment error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ============================================================================
// WEBHOOK: AppyPay Payment Notification
// ============================================================================
const appyPayWebhook = async (req, res) => {
    try {
        const { reference, transaction_id, amount, status } = req.body;
        const signature = req.headers['x-appypay-signature'];

        console.log(`[Webhook] Received:`, req.body);

        // Security Check
        const secret = process.env.APPYPAY_SECRET;
        if (secret) {
            const rawBody = JSON.stringify(req.body);
            if (!verifySignature(rawBody, signature, secret)) {
                console.warn('[Webhook] Invalid Signature');
                return res.status(401).json({ success: false, message: 'Invalid Signature' });
            }
        } else {
            console.warn('[Webhook] APPYPAY_SECRET not set. Skipping signature verification.');
        }

        if (status === 'success' || status === 'paid') {
            const cleanRef = reference ? reference.toString().replace(/\s/g, '') : null;
            const txId = transaction_id || cleanRef;

            // --- REDIS IDEMPOTENCY ---
            if (txId) {
                const idempotencyKey = `ecoflix:processed_tx:${txId}`;
                const alreadyProcessed = await redisClient.get(idempotencyKey);
                if (alreadyProcessed) {
                    console.warn(`[Webhook] Duplicate detected for TX: ${txId}. skipping.`);
                    return res.status(200).json({ success: true, message: 'Already processed' });
                }
                // Mark as processing (expire in 24h)
                await redisClient.set(idempotencyKey, 'true', 'EX', 86400);
            }

            console.log(`[Webhook] Payment confirmed for Ref: ${cleanRef}`);

            // Find Order
            let query = supabase.from('ecoflix_orders').select('*');

            if (cleanRef) {
                query = query.eq('reference_id', cleanRef);
            } else if (transaction_id) {
                query = query.eq('transaction_id', transaction_id);
            } else {
                return res.status(400).json({ success: false, message: 'Missing reference or transaction_id' });
            }

            const { data: order } = await query.single();

            if (order) {
                if (order.status === 'PENDING') {
                    // Update transaction_id if provided
                    if (transaction_id && !order.transaction_id) {
                        await supabase.from('ecoflix_orders').update({ transaction_id }).eq('id', order.id);
                    }

                    // Atomic Assignment Logic via Service
                    const result = await paymentService.processPayment(order);

                    if (!result.success && result.message.includes('Sem stock')) {
                        // Fallback logic for stock out if needed, but service handles standard logic
                        // Just creating a dummy response here
                        // update status to PAID is handled inside handleOutOfStock if called
                    }
                } else {
                    console.log('[Webhook] Order already processed:', order.id);
                }
            } else {
                console.warn(`[Webhook] Order not found`);
            }
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Webhook Error:', error);
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
            .select('transaction_id')
            .eq('reference_id', reference_id.replace(/\s/g, ''))
            .single();

        if (!order) return res.status(404).json({ message: 'Order not found' });

        const payload = {
            reference: reference_id.replace(/\s/g, ''),
            amount: amount,
            transaction_id: order.transaction_id,
            status: 'paid',
            simulated: true
        };

        const port = process.env.PORT || 3000;
        const localUrl = `http://localhost:${port}/api/ecoflix/webhooks/appypay`;

        try {
            await axios.post(localUrl, payload);
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
    checkPaymentStatus,
    renewSubscription,
    confirmPayment,
    appyPayWebhook,
    simulateWebhook
};
