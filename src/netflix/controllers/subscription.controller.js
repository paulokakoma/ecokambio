/**
 * Subscription Controller
 * Handles customer subscription logic (Coupons, Credentials, Issues)
 */

const supabase = require('../../config/supabase');

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
                ecoflix_profiles (
                    pin,
                    name,
                    ecoflix_master_accounts (
                        netflix_email,
                        netflix_password
                    )
                )
            `)
            .eq('user_id', userId)
            .eq('status', 'ACTIVE')
            .single();

        if (error || !sub) {
            return res.status(404).json({ success: false, message: 'Nenhuma assinatura ativa encontrada.' });
        }

        // Extract nested data
        const profile = sub.ecoflix_profiles;
        const master = profile?.ecoflix_master_accounts;

        // Validation for missing data
        if (!profile || !master) {
            return res.status(500).json({ success: false, message: 'Erro nos dados da assinatura (Perfil/Conta em falta).' });
        }

        res.json({
            success: true,
            data: {
                id: sub.id,
                plan: sub.plan_type,
                expires_at: sub.expires_at,
                profile_name: profile.name,
                pin: profile.pin,
                email: master.netflix_email,
                password: master.netflix_password
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

module.exports = {
    validateCoupon,
    getSubscriptionCredentials,
    reportIssue
};
