/**
 * Subscription Controller
 * Handles customer subscription logic (Coupons, Credentials, Issues)
 */

const supabase = require('../../../src/config/supabase');
const smsService = require('../services/sms.service');
const planService = require('../services/plan.service');
const { broadcast: sseBroadcast } = require('./sse.controller');
const axios = require('axios');
const { redisClient } = require('../../../src/config/redis');
const eventService = require('../services/event.service');

const emitEvent = (promise) => promise.catch(err => console.warn('[EcoFlix Events]', err.message));

// ============================================================================
// CUSTOMER: Validate Coupon
// ============================================================================
const validateCoupon = async (req, res) => {
    try {
        const { code, plan_type, duration } = req.body;
        if (!code) return res.status(400).json({ success: false, message: 'Código obrigatório' });

        const { data: coupon, error } = await supabase
            .from('ecoflix_coupons')
            .select('*')
            .eq('code', code.toUpperCase())
            .single();

        if (error || !coupon) {
            return res.status(404).json({ success: false, message: 'Código inválido' });
        }

        if (coupon.status !== 'ACTIVE') {
            return res.status(400).json({ success: false, message: 'Este código expirou' });
        }

        // Check Inventory Tag
        if (coupon.inventory_tag) {
            const { data: stockCount, error: rpcError } = await supabase
                .rpc('check_tagged_stock', { tag_name: coupon.inventory_tag });

            if (rpcError) throw rpcError;

            if (stockCount <= 0) {
                return res.status(400).json({ success: false, message: 'Esgotado! O lote deste influenciador terminou.' });
            }
        }

        // Calculate discounted price and create PayGo product
        const plans = await planService.getPlans();
        const durationMonths = parseInt(duration) || 1;

        if (plan_type && plans[plan_type]) {
            const basePrice = plans[plan_type].price * durationMonths;

            let discount = 0;
            const discType = coupon.discount_type || 'flat';
            const discValue = parseFloat(coupon.discount_value) || 0;
            if (discType === 'percent' && discValue > 0) {
                discount = basePrice * (discValue / 100);
            } else if (discType === 'flat' && discValue > 0) {
                discount = discValue;
            } else if (coupon.discount_amount > 0) {
                discount = coupon.discount_amount;
            }

            discount = Math.min(discount, basePrice - (plans.ECONOMICO.price * durationMonths));
            const finalPrice = basePrice - discount;

            // Create PayGo product with discounted price
            const PAYGO_API_KEY = process.env.PAYGOOO_API_KEY;
            const PAYGO_BASE_URL = process.env.PAYGO_BASE_URL || 'https://rouxavcvorjiwhpjhsye.supabase.co/functions/v1/api-v1';

            if (PAYGO_API_KEY && finalPrice !== basePrice) {
                // Check cache first to avoid creating duplicate products
                let newPaygoId = null;
                if (redisClient) {
                    const cacheKey = `ecoflix:coupon_paygo:${coupon.code}:${plan_type}:${durationMonths}`;
                    newPaygoId = await redisClient.get(cacheKey);
                }

                if (!newPaygoId) {
                    try {
                        const { data: prod } = await axios.post(
                            `${PAYGO_BASE_URL}/products`,
                            {
                                name: `EcoFlix ${plan_type} CUPOM`,
                                price: finalPrice,
                                thank_you_url: 'https://ecokambio.com',
                                description: `Acesso EcoFlix ${plan_type} (${durationMonths}m) - Desconto ${coupon.code}`
                            },
                            { headers: { 'x-api-key': PAYGO_API_KEY, 'Content-Type': 'application/json' } }
                        );
                        newPaygoId = prod?.product?.id || prod?.id;

                        // Cache for 24h
                        if (newPaygoId && redisClient) {
                            const cacheKey = `ecoflix:coupon_paygo:${coupon.code}:${plan_type}:${durationMonths}`;
                            await redisClient.set(cacheKey, newPaygoId, 'EX', 86400);
                        }
                    } catch (paygoErr) {
                        console.error('[Coupon] Erro ao criar produto PayGo:', paygoErr.message);
                    }
                }

                if (newPaygoId) {
                    res.json({
                        success: true,
                        data: {
                            code: coupon.code,
                            discount_type: discType,
                            discount_value: discValue,
                            discount: discount,
                            final_price: finalPrice,
                            paygo_id: newPaygoId,
                            message: `Código ${coupon.code} aplicado com sucesso!`
                        }
                    });
                    return;
                }
            }

            // Fallback: return without paygo_id (frontend calculates locally)
            res.json({
                success: true,
                data: {
                    code: coupon.code,
                    discount_type: discType,
                    discount_value: discValue,
                    discount: discount,
                    final_price: finalPrice,
                    paygo_id: null,
                    message: `Código ${coupon.code} aplicado com sucesso!`
                }
            });
            return;
        }

        // Fallback: no plan_type provided (backward compatibility)
        res.json({
            success: true,
            data: {
                code: coupon.code,
                discount_type: coupon.discount_type || 'flat',
                discount_value: parseFloat(coupon.discount_value) || 0,
                discount: coupon.discount_amount,
                final_price: null,
                paygo_id: null,
                message: `Código ${coupon.code} aplicado com sucesso!`
            }
        });

    } catch (error) {
        console.error('Validate coupon error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ============================================================================
// CUSTOMER: Get Subscription Credentials
// ============================================================================
const getSubscriptionCredentials = async (req, res) => {
    try {
        const userId = req.user.id; // From Auth Middleware

        // Get all Active Subscriptions
        const { data: subs, error } = await supabase
            .from('ecoflix_subscriptions')
            .select(`
                *,
                order:ecoflix_orders!ecoflix_subscriptions_order_id_fkey(plan_type),
                profile:ecoflix_profiles!fk_subscriptions_profile (
                    pin,
                    name,
                    master_account:ecoflix_master_accounts!ecoflix_profiles_master_account_id_fkey(
                        email,
                        password
                    )
                ),
                account:ecoflix_master_accounts(
                    email,
                    password
                )
            `)
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) {
            return res.status(500).json({ success: false, message: 'Erro ao buscar assinaturas.' });
        }

        let allSubs = [];

        // FALLBACK: check if admin manually assigned a profile to this user's phone
        const userPhone = req.user.phone || '';
        const cleanPhone = smsService.normalizePhone(userPhone);

        const { data: manualProfiles } = await supabase
            .from('ecoflix_profiles')
            .select(`
                id, name, pin, expires_at, status, type,
                master_account:ecoflix_master_accounts!ecoflix_profiles_master_account_id_fkey (email, password)
            `)
            .or(`client_phone.eq.${cleanPhone},client_phone.eq.+244${cleanPhone},client_phone.eq.244${cleanPhone}`)
            .eq('status', 'SOLD')
            .order('updated_at', { ascending: false });

        if (manualProfiles && manualProfiles.length > 0) {
            manualProfiles.forEach(mp => {
                if (mp.master_account) {
                    allSubs.push({
                        id: 'manual-' + mp.id,
                        plan: mp.type === 'TV' ? 'ULTRA' : 'ECONOMICO',
                        expires_at: mp.expires_at,
                        profile_name: mp.name,
                        pin: mp.pin || 'N/A',
                        email: mp.master_account.email,
                        password: mp.master_account.password,
                        is_manual: true
                    });
                }
            });
        }

        if (subs && subs.length > 0) {
            subs.forEach(sub => {
                if (sub.status !== 'ACTIVE') return; // Skip suspended or pending subscriptions

                const profile = sub.profile;
                const master = sub.account || profile?.master_account;
                
                if (master) {
                    allSubs.push({
                        id: sub.id,
                        plan: sub.order?.plan_type || sub.plan_type || (sub.account ? 'FAMILIA' : 'ECONOMICO'),
                        expires_at: sub.expires_at,
                        profile_name: profile ? profile.name : 'Exclusiva',
                        pin: profile ? profile.pin : 'N/A',
                        email: master.email,
                        password: master.password,
                        is_manual: false
                    });
                }
            });
        }

        // Remove duplicates if a manual profile is already tracked in a formal subscription
        const formalProfileIds = new Set(subs ? subs.map(s => s.profile_id).filter(id => id) : []);
        
        let uniqueSubs = allSubs.filter(s => {
            if (s.is_manual) {
                const rawProfileId = s.id.replace('manual-', '');
                if (formalProfileIds.has(rawProfileId)) return false;
            }
            return true;
        });

        if (uniqueSubs.length === 0) {
            return res.status(404).json({ success: false, message: 'Nenhuma assinatura ativa encontrada.' });
        }

        res.json({
            success: true,
            data: uniqueSubs,
            phone: userPhone || ''
        });

    } catch (error) {
        console.error('Get creds error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ============================================================================
// SECURITY & RECOVERY
// ============================================================================
const reportIssue = async (req, res) => {
    try {
        // Rate limiting: max 3 issues per 10 minutes per user
        if (redisClient) {
            const rlKey = `ecoflix:issue_rl:${req.user.id}`;
            const count = await redisClient.incr(rlKey);
            if (count === 1) await redisClient.expire(rlKey, 600);
            if (count > 3) {
                return res.status(429).json({ success: false, message: 'Demasiados pedidos. Aguarde alguns minutos.' });
            }
        }

        const { subscription_id, issue_type, description } = req.body;
        // issue_type: 'PASSWORD_INCORRECT', 'SCREEN_LIMIT', 'LOCKED', 'OTHER'

        let finalSubId = subscription_id;
        let finalDesc = description || '';

        if (subscription_id && subscription_id.startsWith('manual-')) {
            finalSubId = null; // Cannot use foreign key for manual profiles
            finalDesc = `[Manual Profile: ${subscription_id}] ` + finalDesc;
        }

        const { data, error } = await supabase
            .from('ecoflix_issues')
            .insert([{
                subscription_id: finalSubId,
                issue_type,
                description: finalDesc,
                status: 'OPEN'
            }])
            .select()
            .single();

        if (error) throw error;

        sseBroadcast('new_issue', { issue: data });
        sseBroadcast('refresh_admin', { reason: 'new_issue' });
        emitEvent(eventService.emitAdmin('issue_created', {
            issue_id: data.id,
            issue_type,
            subscription_id: finalSubId
        }));

        res.json({ success: true, message: 'Problema reportado. A nossa equipa irá verificar em breve.' });

    } catch (error) {
        console.error('Report error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ============================================================================
// CUSTOMER: Recover Credentials via SMS
// ============================================================================
const recoverCredentials = async (req, res) => {
    try {
        const { phone } = req.body;
        if (!phone) {
            return res.status(400).json({ success: false, message: 'Número de telemóvel obrigatório' });
        }

        const cleanPhone = smsService.normalizePhone(phone);

        // Rate limiting: max 3 SMS per 10 minutes per phone
        if (redisClient) {
            const rlKey = `ecoflix:recover_rl:${cleanPhone}`;
            const count = await redisClient.incr(rlKey);
            if (count === 1) {
                await redisClient.expire(rlKey, 600);
            }
            if (count > 3) {
                return res.status(429).json({ success: false, message: 'Demasiados pedidos. Aguarde alguns minutos e tente novamente.' });
            }
        }

        const { data: user } = await supabase
            .from('ecoflix_users')
            .select('id')
            .eq('phone', cleanPhone)
            .single();

        if (!user) {
            return res.status(404).json({ success: false, message: 'Nenhuma conta encontrada com este número.' });
        }

        const { data: sub, error } = await supabase
            .from('ecoflix_subscriptions')
            .select(`
                id, profile_id, plan_type, expires_at, status,
                profile:ecoflix_profiles!fk_subscriptions_profile (
                    pin,
                    name,
                    master_account:ecoflix_master_accounts!ecoflix_profiles_master_account_id_fkey(email, password)
                ),
                account:ecoflix_master_accounts(email, password)
            `)
            .eq('user_id', user.id)
            .eq('status', 'ACTIVE')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (error || !sub) {
            // FALLBACK: check if admin manually assigned a profile to this phone
            const { data: manualProfile } = await supabase
                .from('ecoflix_profiles')
                .select(`
                    id, name, pin, expires_at, status, type,
                    master_account:ecoflix_master_accounts!ecoflix_profiles_master_account_id_fkey (email, password)
                `)
                .or(`client_phone.eq.${cleanPhone},client_phone.eq.+244${cleanPhone},client_phone.eq.244${cleanPhone}`)
                .eq('status', 'SOLD')
                .single();

            if (!manualProfile) {
                return res.status(404).json({ success: false, message: 'Nenhuma assinatura ativa encontrada. Faça uma nova compra.' });
            }

            if (!manualProfile.master_account) {
                 return res.status(500).json({ success: false, message: 'Erro ao recuperar dados da conta associada.' });
            }

            const creds = {
                email: manualProfile.master_account.email,
                password: manualProfile.master_account.password,
                profile: manualProfile.name,
                pin: manualProfile.pin || 'N/A'
            };

            await smsService.sendDeliverySms(cleanPhone, creds);
            emitEvent(eventService.emitUser(cleanPhone, 'credentials_recovered', { sent: true }));

            return res.json({
                success: true,
                message: 'Credenciais enviadas por SMS!',
                data: {
                    sent: true,
                    phone: '+244' + cleanPhone
                }
            });
        }

        const profile = sub.profile;
        const account = sub.account || profile?.master_account;

        if (!account) {
            return res.status(500).json({ success: false, message: 'Erro ao recuperar dados da conta.' });
        }

        const creds = {
            email: account.email,
            password: account.password,
            profile: profile ? profile.name : 'Exclusiva',
            pin: profile ? profile.pin : 'N/A'
        };

        await smsService.sendDeliverySms(cleanPhone, creds);
        emitEvent(eventService.emitUser(cleanPhone, 'credentials_recovered', { sent: true }));

        res.json({
            success: true,
            message: 'Credenciais enviadas por SMS!'
        });

    } catch (error) {
        console.error('Recover credentials error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};



// ============================================================================
// PUBLIC SUPPORT (NO AUTH)
// ============================================================================
const publicReportIssue = async (req, res) => {
    try {
        const { phone, issue_type, description } = req.body;
        
        if (!phone) {
            return res.status(400).json({ success: false, message: 'Telefone obrigatório.' });
        }

        const cleanPhone = smsService.normalizePhone(phone);

        // Rate limiting: max 3 issues per 10 minutes per phone
        if (redisClient) {
            const rlKey = `ecoflix:issue_rl:pub:${cleanPhone}`;
            const count = await redisClient.incr(rlKey);
            if (count === 1) await redisClient.expire(rlKey, 600);
            if (count > 3) {
                return res.status(429).json({ success: false, message: 'Demasiados pedidos. Aguarde alguns minutos.' });
            }
        }

        const finalDesc = `[Suporte Público | Tel: ${cleanPhone}] ` + (description || '');

        const { data, error } = await supabase
            .from('ecoflix_issues')
            .insert([{
                subscription_id: null,
                issue_type,
                description: finalDesc,
                status: 'OPEN'
            }])
            .select()
            .single();

        if (error) throw error;

        sseBroadcast('new_issue', { issue: data });
        sseBroadcast('refresh_admin', { reason: 'public_issue' });
        emitEvent(eventService.emitAdmin('issue_created', {
            issue_id: data.id,
            issue_type,
            phone: cleanPhone,
            source: 'public'
        }));

        res.json({ success: true, message: 'Pedido de suporte enviado com sucesso.' });

    } catch (error) {
        console.error('Public Report error:', error);
        res.status(500).json({ success: false, message: 'Erro ao enviar pedido.' });
    }
};

module.exports = {
    publicReportIssue,
    validateCoupon,
    getSubscriptionCredentials,
    reportIssue,
    recoverCredentials
};
