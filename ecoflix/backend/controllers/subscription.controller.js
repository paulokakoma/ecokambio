/**
 * Subscription Controller
 * Handles customer subscription logic (Coupons, Credentials, Issues)
 */

const supabase = require('../../../src/config/supabase');
const smsService = require('../services/sms.service');

// ============================================================================
// CUSTOMER: Validate Coupon
// ============================================================================
const validateCoupon = async (req, res) => {
    try {
        const { code } = req.body;
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

        res.json({
            success: true,
            data: {
                code: coupon.code,
                discount: coupon.discount_amount,
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

        // Get Active Subscription
        const { data: sub, error } = await supabase
            .from('ecoflix_subscriptions')
            .select(`
                *,
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
            .eq('status', 'ACTIVE')
            .single();

        if (error || !sub) {
            // FALLBACK: check if admin manually assigned a profile to this user's phone
            const userPhone = req.user.phone || '';
            const cleanPhone = userPhone.replace(/[^0-9]/g, '').replace(/^244/, '');

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
                return res.status(404).json({ success: false, message: 'Nenhuma assinatura ativa encontrada.' });
            }

            if (!manualProfile.master_account) {
                 return res.status(500).json({ success: false, message: 'Erro nos dados da assinatura (Conta Mestra em falta).' });
            }

            return res.json({
                success: true,
                data: {
                    id: 'manual-' + manualProfile.id,
                    plan: manualProfile.type === 'TV' ? 'ULTRA' : 'ECONOMICO',
                    expires_at: manualProfile.expires_at,
                    profile_name: manualProfile.name,
                    pin: manualProfile.pin || 'N/A',
                    email: manualProfile.master_account.email,
                    password: manualProfile.master_account.password
                }
            });
        }

        // Extract nested data
        const profile = sub.profile;
        // The master account credentials could be direct (EXCLUSIVE) or via profile (ECONOMICO/ULTRA)
        const master = sub.account || profile?.master_account;

        // Validation for missing data
        if (!master) {
            return res.status(500).json({ success: false, message: 'Erro nos dados da assinatura (Conta Mestra em falta).' });
        }
        res.json({
            success: true,
            data: {
                id: sub.id,
                plan: sub.plan_type,
                expires_at: sub.expires_at,
                profile_name: profile ? profile.name : 'Exclusiva',
                pin: profile ? profile.pin : 'N/A',
                email: master.email,
                password: master.password
            }
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
        const { subscription_id, issue_type, description } = req.body;
        // issue_type: 'PASSWORD_INCORRECT', 'SCREEN_LIMIT', 'LOCKED', 'OTHER'

        // Log incident (MVP: Console/Admin Alert)
        console.warn(`[Ticket] Incident Reported! Sub: ${subscription_id}, Type: ${issue_type}`);

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

        const cleanPhone = phone.replace(/[^0-9]/g, '').replace(/^244/, '');
        const fullPhone = '+244' + cleanPhone;

        const { data: user } = await supabase
            .from('ecoflix_users')
            .select('id')
            .eq('phone', fullPhone)
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

            await smsService.sendDeliverySms(cleanPhone, creds, false); // false = profile (not EXCLUSIVE)

            return res.json({
                success: true,
                message: 'Credenciais enviadas por SMS!',
                data: {
                    sent: true,
                    phone: fullPhone
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

        await smsService.sendDeliverySms(cleanPhone, creds, sub.plan_type === 'FAMILIA');

        res.json({
            success: true,
            message: 'Credenciais enviadas por SMS para ' + fullPhone
        });

    } catch (error) {
        console.error('Recover credentials error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    validateCoupon,
    getSubscriptionCredentials,
    reportIssue,
    recoverCredentials
};
