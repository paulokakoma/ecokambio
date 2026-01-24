/**
 * Admin Controller
 * Handles administrative tasks for EcoFlix (Accounts, Profiles, Stats, Partners)
 */

const supabase = require('../../config/supabase');
const { redisClient } = require('../../config/redis');
const smsService = require('../services/sms.service');

// Helper: Generate random PIN
const generatePin = () => Math.floor(1000 + Math.random() * 9000).toString();

// ============================================================================
// ADMIN: Dashboard Metrics
// ============================================================================
const getDashboard = async (req, res) => {
    try {
        // Get available profiles count
        const { count: freeProfiles } = await supabase
            .from('ecoflix_profiles')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'AVAILABLE');

        // Get sold profiles count
        const { count: soldProfiles } = await supabase
            .from('ecoflix_profiles')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'SOLD');

        // Get accounts expiring in 48h
        const twoDaysFromNow = new Date();
        twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);
        const { count: expiringAccounts } = await supabase
            .from('ecoflix_master_accounts')
            .select('*', { count: 'exact', head: true })
            .lte('renewal_date', twoDaysFromNow.toISOString().split('T')[0])
            .eq('status', 'ACTIVE');

        // Get today's revenue
        const today = new Date().toISOString().split('T')[0];
        const { data: todaysOrders } = await supabase
            .from('ecoflix_orders')
            .select('amount')
            .eq('status', 'PAID')
            .gte('paid_at', today);

        const todayRevenue = (todaysOrders || []).reduce((sum, o) => sum + parseFloat(o.amount), 0);
        const todaySales = (todaysOrders || []).length;

        res.json({
            success: true,
            data: {
                freeProfiles: freeProfiles || 0,
                soldProfiles: soldProfiles || 0,
                expiringAccounts: expiringAccounts || 0,
                todayRevenue,
                todaySales
            }
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ============================================================================
// ADMIN: Get Stock (All Master Accounts with Profiles)
// ============================================================================
const getStock = async (req, res) => {
    try {
        const { data: accounts, error } = await supabase
            .from('ecoflix_master_accounts')
            .select(`
                *,
                profiles:ecoflix_profiles!ecoflix_profiles_master_account_id_fkey(*)
            `)
            .order('created_at', { ascending: false });

        if (error) throw error;

        res.json({ success: true, data: accounts });
    } catch (error) {
        console.error('Get stock error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ============================================================================
// ADMIN: Create Master Account
// ============================================================================
const createAccount = async (req, res) => {
    try {
        const { email, password, renewal_date, type = 'SHARED', notes } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Email e senha são obrigatórios' });
        }

        const { data: account, error } = await supabase
            .from('ecoflix_master_accounts')
            .insert({ email, password, renewal_date, type, notes })
            .select()
            .single();

        if (error) throw error;

        // Profiles are auto-created by trigger for SHARED accounts
        // Fetch the account with profiles
        const { data: fullAccount } = await supabase
            .from('ecoflix_master_accounts')
            .select('*, profiles:ecoflix_profiles!ecoflix_profiles_master_account_id_fkey(*)')
            .eq('id', account.id)
            .single();

        res.status(201).json({ success: true, data: fullAccount });
    } catch (error) {
        console.error('Create account error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ============================================================================
// ADMIN: Update Master Account
// ============================================================================
const updateAccount = async (req, res) => {
    try {
        const { id } = req.params;
        const { email, password, renewal_date, status, notes } = req.body;

        const { data: account, error } = await supabase
            .from('ecoflix_master_accounts')
            .update({ email, password, renewal_date, status, notes, updated_at: new Date() })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        res.json({ success: true, data: account });
    } catch (error) {
        console.error('Update account error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ============================================================================
// ADMIN: Delete Master Account
// ============================================================================
const deleteAccount = async (req, res) => {
    try {
        const { id } = req.params;

        const { error } = await supabase
            .from('ecoflix_master_accounts')
            .delete()
            .eq('id', id);

        if (error) throw error;

        res.json({ success: true, message: 'Conta apagada com sucesso' });
    } catch (error) {
        console.error('Delete account error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ============================================================================
// ADMIN: Update Profile
// ============================================================================
const updateProfile = async (req, res) => {
    try {
        const { id } = req.params;
        const { pin, status, client_name, client_phone, expires_at } = req.body;

        const updateData = { updated_at: new Date() };
        if (pin !== undefined) updateData.pin = pin;
        if (status !== undefined) updateData.status = status;
        if (client_name !== undefined) updateData.client_name = client_name;
        if (client_phone !== undefined) updateData.client_phone = client_phone;
        if (expires_at !== undefined) updateData.expires_at = expires_at;

        // If resetting to AVAILABLE, clear client data
        if (status === 'AVAILABLE') {
            updateData.client_name = null;
            updateData.client_phone = null;
            updateData.expires_at = null;
            updateData.pin = generatePin();
        }

        const { data: profile, error } = await supabase
            .from('ecoflix_profiles')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        // Send SMS if status changed to SOLD (Manual Sale)
        if (status === 'SOLD') {
            const phoneToSend = client_phone || profile.client_phone;
            if (phoneToSend) {
                // Get Account Credentials
                const { data: account } = await supabase
                    .from('ecoflix_master_accounts')
                    .select('email, password')
                    .eq('id', profile.master_account_id)
                    .single();

                if (account) {
                    const pName = client_name || profile.name;
                    const pPin = pin || profile.pin;

                    // Send SMS (async)
                    await smsService.sendDeliverySms(phoneToSend, {
                        email: account.email,
                        password: account.password,
                        profile: pName,
                        pin: pPin
                    });
                }
            }
        }

        res.json({ success: true, data: profile });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ============================================================================
// ADMIN: Get Notifications (Polling)
// ============================================================================
const getNotifications = async (req, res) => {
    try {
        const { since } = req.query;
        // Default to 10 seconds ago if no timestamp
        const timeCheck = since ? new Date(parseInt(since)).toISOString() : new Date(Date.now() - 10000).toISOString();

        // 1. New Registered Users
        const { data: newUsers } = await supabase
            .from('ecoflix_users')
            .select('phone, verified_at')
            .gt('verified_at', timeCheck);

        // 2. New Paid Orders
        const { data: newOrders } = await supabase
            .from('ecoflix_orders')
            .select('reference_id, amount, status, updated_at')
            .eq('status', 'PAID')
            .gt('updated_at', timeCheck);

        const events = [];

        if (newUsers && newUsers.length > 0) {
            newUsers.forEach(u => {
                events.push({
                    type: 'USER',
                    message: `Novo cliente registado: ${u.phone}`,
                    timestamp: u.verified_at
                });
            });
        }

        if (newOrders && newOrders.length > 0) {
            newOrders.forEach(o => {
                events.push({
                    type: 'ORDER',
                    message: `Pagamento recebido: ${o.amount} Kz (Ref: ${o.reference_id})`,
                    timestamp: o.updated_at
                });
            });
        }

        res.json({ success: true, events, timestamp: Date.now() });
    } catch (error) {
        console.error('Notifications error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ============================================================================
// ADMIN: Get Orders
// ============================================================================
const getOrders = async (req, res) => {
    try {
        const { status } = req.query;

        let query = supabase
            .from('ecoflix_orders')
            .select(`
                *,
                user:ecoflix_users(phone, name),
                subscription:ecoflix_subscriptions!ecoflix_subscriptions_order_id_fkey(
                    profile:ecoflix_profiles!ecoflix_profiles_master_account_id_fkey(name, pin),
                    account:ecoflix_master_accounts(email, password)
                )
            `)
            .order('created_at', { ascending: false });

        if (status) {
            query = query.eq('status', status);
        }

        const { data: orders, error } = await query;
        if (error) throw error;

        res.json({ success: true, data: orders || [] });
    } catch (error) {
        console.error('Get orders error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ============================================================================
// ADMIN: Inventory Status
// ============================================================================
const getInventoryStatus = async (req, res) => {
    try {
        // Count AVAILABLE Mobile
        const { count: mobileAvailable } = await supabase.from('ecoflix_profiles')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'AVAILABLE').eq('type', 'MOBILE');

        // Count AVAILABLE TV
        const { count: tvAvailable } = await supabase.from('ecoflix_profiles')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'AVAILABLE').eq('type', 'TV');

        // Count SOLD
        const { count: soldTotal } = await supabase.from('ecoflix_profiles')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'SOLD');

        // Count EXPIRED/SUSPENDED
        const { count: suspendedTotal } = await supabase.from('ecoflix_profiles')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'SUSPENDED');

        res.json({
            success: true,
            data: {
                mobile_available: mobileAvailable || 0,
                tv_available: tvAvailable || 0,
                sold: soldTotal || 0,
                suspended: suspendedTotal || 0
            }
        });

    } catch (error) {
        console.error('Inventory Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ============================================================================
// ADMIN: Export CSV
// ============================================================================
const getExportCSV = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('ecoflix_subscriptions')
            .select(`
                start_date,
                amount_paid,
                coupon_code,
                status,
                profile:ecoflix_profiles!fk_subscriptions_profile ( type ),
                user:ecoflix_users ( phone )
            `)
            .order('start_date', { ascending: false });

        if (error) throw error;

        // Convert to CSV
        const header = ['Data Venda', 'Cliente', 'Plano', 'Valor', 'Cupom', 'Status'];
        const rows = data.map(sub => [
            new Date(sub.start_date).toLocaleString('pt-PT'),
            sub.user?.phone || 'N/A',
            sub.profile?.type || 'N/A',
            sub.amount_paid,
            sub.coupon_code || '-',
            sub.status
        ]);

        const csvContent = [
            header.join(','),
            ...rows.map(r => r.join(','))
        ].join('\n');

        res.header('Content-Type', 'text/csv');
        res.attachment(`relatorio_vendas_${new Date().toISOString().split('T')[0]}.csv`);
        res.send(csvContent);

    } catch (error) {
        console.error('Export CSV Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ============================================================================
// ADMIN: Auto-Export to Google Sheets
// ============================================================================
const exportSalesAuto = async (req, res) => {
    const { token } = req.query;

    // 1. SECURITY CHECK
    if (!token || token !== process.env.SHEETS_SYNC_TOKEN) {
        return res.status(401).send('Acesso Negado: Token inválido.');
    }

    try {
        // 2. CHECK REDIS CACHE
        const cacheKey = 'ecoflix:relatorio_csv_cache';
        const cachedContent = await redisClient.get(cacheKey);

        if (cachedContent) {
            console.log('⚡ Sales Report served via Redis Cache');
            res.setHeader('Content-Type', 'text/csv');
            return res.status(200).send(cachedContent);
        }

        // 3. FETCH FROM VIEW
        const { data, error } = await supabase
            .from('view_relatorio_influenciadores')
            .select('*')
            .csv();

        if (error) throw error;

        // 4. CACHE IN REDIS (1 HOUR)
        await redisClient.set(cacheKey, data, 'EX', 3600);
        console.log('🐢 Sales Report served via Database (New Cache Created)');

        // 5. SEND PLAIN CSV
        res.setHeader('Content-Type', 'text/csv');
        res.status(200).send(data);

    } catch (error) {
        console.error('Auto-Export Error:', error);
        res.status(500).send('Erro no servidor');
    }
};

// ============================================================================
// ADMIN: Influencer Stats
// ============================================================================
const getInfluencerStats = async (req, res) => {
    try {
        // Get all referral codes
        const { data: coupons, error } = await supabase
            .from('ecoflix_coupons')
            .select('*')
            .order('usage_count', { ascending: false });

        if (error) throw error;

        // Get sales
        const { data: salesData, error: salesError } = await supabase
            .from('ecoflix_orders')
            .select('coupon_used, amount, status, created_at')
            .not('coupon_used', 'is', null)
            .eq('status', 'PAID');

        if (salesError) throw salesError;

        // Calculate stats
        const stats = coupons.map(coupon => {
            const sales = salesData.filter(s => s.coupon_used === coupon.code);
            const totalRevenue = sales.reduce((sum, s) => sum + parseFloat(s.amount || 0), 0);
            const lastSale = sales.length > 0
                ? sales.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0].created_at
                : null;

            return {
                id: coupon.id,
                code: coupon.code,
                influencer_name: coupon.partner_name,
                discount_amount: coupon.discount_amount,
                status: coupon.status,
                total_sales: coupon.usage_count || sales.length,
                total_revenue: totalRevenue,
                inventory_tag: coupon.inventory_tag,
                last_sale_at: lastSale,
                created_at: coupon.created_at
            };
        });

        // Summary totals
        const summary = {
            total_influencers: coupons.length,
            active_influencers: coupons.filter(c => c.status === 'ACTIVE').length,
            total_referred_sales: salesData.length,
            total_referred_revenue: salesData.reduce((sum, s) => sum + parseFloat(s.amount || 0), 0)
        };

        res.json({ success: true, summary, data: stats });

    } catch (error) {
        console.error('Influencer Stats Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const getRecoveryData = async (req, res) => {
    try {
        const { id } = req.params; // master_account_id
        const { data, error } = await supabase
            .from('ecoflix_master_accounts')
            .select('id, recovery_email, recovery_password, email')
            .eq('id', id)
            .single();

        if (error) throw error;
        res.json({ success: true, data });
    } catch (error) {
        console.error('Recovery Data Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ============================================================================
// ADMIN: Partner/Affiliate Management
// ============================================================================
const getPartnerStats = async (req, res) => {
    try {
        const { data: coupons, error } = await supabase
            .from('ecoflix_coupons')
            .select('*')
            .order('total_commission_due', { ascending: false, nullsFirst: false });

        if (error) throw error;

        const { data: orders, error: ordersError } = await supabase
            .from('ecoflix_orders')
            .select('coupon_used, plan_type, amount, status')
            .not('coupon_used', 'is', null)
            .eq('status', 'PAID');

        if (ordersError) throw ordersError;

        const stats = coupons.map(coupon => {
            const partnerOrders = orders.filter(o => o.coupon_used === coupon.code);
            const salesMobile = partnerOrders.filter(o => o.plan_type === 'ECONOMICO').length;
            const salesTV = partnerOrders.filter(o => o.plan_type === 'ULTRA' || o.plan_type === 'FAMILIA').length;

            return {
                id: coupon.id,
                code: coupon.code,
                partner_name: coupon.partner_name,
                commission_mobile: parseFloat(coupon.commission_mobile) || 500,
                commission_tv: parseFloat(coupon.commission_tv) || 700,
                status: coupon.status,
                inventory_tag: coupon.inventory_tag,
                sales_mobile: salesMobile,
                sales_tv: salesTV,
                total_sales: coupon.usage_count || (salesMobile + salesTV),
                total_commission_due: parseFloat(coupon.total_commission_due) || 0,
                last_paid_at: coupon.last_paid_at,
                created_at: coupon.created_at
            };
        });

        const summary = {
            total_partners: coupons.length,
            active_partners: coupons.filter(c => c.status === 'ACTIVE').length,
            total_commission_pending: stats.reduce((sum, p) => sum + p.total_commission_due, 0)
        };

        res.json({ success: true, summary, data: stats });
    } catch (error) {
        console.error('Partner Stats Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const markPartnerPaid = async (req, res) => {
    try {
        const { id } = req.params;
        const { amount_paid } = req.body;

        const { error: rpcError } = await supabase.rpc('mark_partner_paid', {
            p_coupon_code: id
        });

        if (rpcError) {
            const { error: updateError } = await supabase
                .from('ecoflix_coupons')
                .update({
                    total_commission_due: 0,
                    last_paid_at: new Date().toISOString()
                })
                .or(`code.eq.${id},id.eq.${id}`);

            if (updateError) throw updateError;
        }

        console.log(`[Partners] Marked ${id} as paid. Amount: ${amount_paid || 'N/A'}`);

        res.json({
            success: true,
            message: `Pagamento registado com sucesso!`,
            paid_at: new Date().toISOString()
        });
    } catch (error) {
        console.error('Mark Partner Paid Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const getSalesOriginChart = async (req, res) => {
    try {
        const { data: orders, error } = await supabase
            .from('ecoflix_orders')
            .select('coupon_used, amount')
            .eq('status', 'PAID');

        if (error) throw error;

        const { data: coupons } = await supabase
            .from('ecoflix_coupons')
            .select('code, partner_name');

        const couponMap = (coupons || []).reduce((acc, c) => {
            acc[c.code] = c.partner_name;
            return acc;
        }, {});

        const sourceStats = {};
        let organicCount = 0;
        let organicRevenue = 0;

        orders.forEach(order => {
            if (!order.coupon_used) {
                organicCount++;
                organicRevenue += parseFloat(order.amount) || 0;
            } else {
                const name = couponMap[order.coupon_used] || order.coupon_used;
                if (!sourceStats[name]) {
                    sourceStats[name] = { count: 0, revenue: 0, code: order.coupon_used };
                }
                sourceStats[name].count++;
                sourceStats[name].revenue += parseFloat(order.amount) || 0;
            }
        });

        const chartData = [
            {
                label: 'Orgânico (Sem código)',
                value: organicCount,
                revenue: organicRevenue,
                color: '#10b981'
            }
        ];

        const colors = ['#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4'];
        let colorIdx = 0;

        Object.entries(sourceStats).forEach(([name, stats]) => {
            chartData.push({
                label: name,
                code: stats.code,
                value: stats.count,
                revenue: stats.revenue,
                color: colors[colorIdx % colors.length]
            });
            colorIdx++;
        });

        res.json({ success: true, total_sales: orders.length, data: chartData });
    } catch (error) {
        console.error('Sales Origin Chart Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const createPartner = async (req, res) => {
    try {
        const { code, partner_name, commission_mobile, commission_tv, inventory_tag } = req.body;

        if (!code || !partner_name) {
            return res.status(400).json({ success: false, message: 'Código e nome são obrigatórios' });
        }

        const { data, error } = await supabase
            .from('ecoflix_coupons')
            .insert({
                code: code.toUpperCase(),
                partner_name,
                commission_mobile: commission_mobile || 500,
                commission_tv: commission_tv || 700,
                inventory_tag: inventory_tag || null,
                status: 'ACTIVE',
                usage_count: 0,
                total_commission_due: 0
            })
            .select()
            .single();

        if (error) throw error;
        res.status(201).json({ success: true, data });
    } catch (error) {
        console.error('Create Partner Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    getDashboard,
    getStock,
    createAccount,
    updateAccount,
    deleteAccount,
    updateProfile,
    getNotifications,
    getOrders,
    getInventoryStatus,
    getExportCSV,
    exportSalesAuto,
    getInfluencerStats,
    getRecoveryData,
    getPartnerStats,
    markPartnerPaid,
    getSalesOriginChart,
    createPartner
};
