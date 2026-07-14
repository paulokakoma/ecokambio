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
            return res.status(500).json({ success: false, message: 'Erro ao buscar assinaturas: ' + error.message });
        }

        let allSubs = [];

        // FALLBACK: check if admin manually assigned a profile to this user's phone
        const userPhone = req.user.phone || '';
        const cleanPhone = userPhone.replace(/[^0-9]/g, '').replace(/^244/, '');

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

        // Broadcast to Admins
        try {
            const websocket = require('../../../src/websocket');
            websocket.broadcastToAdmins({
                type: 'new_issue',
                issue: data
            });
        } catch(e) {
            console.error('Failed to broadcast issue:', e);
        }

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



// ============================================================================
// PUBLIC SUPPORT (NO AUTH)
// ============================================================================
const publicReportIssue = async (req, res) => {
    try {
        const { phone, issue_type, description } = req.body;
        
        if (!phone) {
            return res.status(400).json({ success: false, message: 'Telefone obrigatório.' });
        }

        const cleanPhone = phone.replace(/[^0-9]/g, '');
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

        // Broadcast to Admins
        try {
            const websocket = require('../../../src/websocket');
            websocket.broadcastToAdmins({
                type: 'new_issue',
                issue: data
            });
        } catch(e) {
            console.error('Failed to broadcast issue:', e);
        }

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
