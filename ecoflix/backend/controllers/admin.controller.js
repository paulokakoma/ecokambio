/**
 * Admin Controller
 * Handles administrative tasks for EcoFlix (Accounts, Profiles, Stats, Partners)
 */

const supabase = require('../../../src/config/supabase');
const { redisClient } = require('../../../src/config/redis');
const smsService = require('../services/sms.service');
const planService = require('../services/plan.service');
const { broadcast: sseBroadcast } = require('./sse.controller');

// Helper: Generate random PIN
const generatePin = () => Math.floor(1000 + Math.random() * 9000).toString();

// ============================================================================
// ADMIN: Dashboard Metrics
// ============================================================================
const getDashboard = async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const twoDaysFromNow = new Date();
        twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);

        // Fetch data concurrently for high performance
        const [
            normallyFreeRes,
            normallySoldRes,
            exclusiveAccountsRes,
            expiringAccountsRes,
            todaysOrdersRes,
            smsBalanceRes,
            recentOrdersRes,
            topClientsOrdersRes,
            allPaidOrdersRes
        ] = await Promise.allSettled([
            supabase.from('ecoflix_profiles').select('*', { count: 'exact', head: true }).eq('status', 'AVAILABLE'),
            supabase.from('ecoflix_profiles').select('*', { count: 'exact', head: true }).eq('status', 'SOLD'),
            supabase.from('ecoflix_master_accounts').select('id, subscriptions:ecoflix_subscriptions(id, status)').eq('type', 'EXCLUSIVE'),
            supabase.from('ecoflix_master_accounts').select('*', { count: 'exact', head: true }).lte('renewal_date', twoDaysFromNow.toISOString().split('T')[0]).eq('status', 'ACTIVE'),
            supabase.from('ecoflix_orders').select('amount').eq('status', 'PAID').gte('paid_at', today),
            smsService.checkBalance(),
            supabase.from('ecoflix_orders').select('phone, plan_type, created_at').order('created_at', { ascending: false }).limit(5),
            supabase.from('ecoflix_orders').select('phone, amount').order('created_at', { ascending: false }).limit(100),
            supabase.from('ecoflix_orders').select('amount, paid_at').in('status', ['PAID', 'MANUAL']).order('paid_at', { ascending: true })
        ]);

        // Process Counts
        const normallyFree = normallyFreeRes.status === 'fulfilled' ? normallyFreeRes.value.count || 0 : 0;
        const normallySold = normallySoldRes.status === 'fulfilled' ? normallySoldRes.value.count || 0 : 0;
        const exclusiveAccounts = exclusiveAccountsRes.status === 'fulfilled' ? exclusiveAccountsRes.value.data || [] : [];
        const expiringAccounts = expiringAccountsRes.status === 'fulfilled' ? expiringAccountsRes.value.count || 0 : 0;

        let exclusiveFreeCount = 0;
        let exclusiveSoldCount = 0;
        exclusiveAccounts.forEach(acc => {
            const hasActive = acc.subscriptions && acc.subscriptions.some(s => ['ACTIVE', 'SUSPENDED'].includes(s.status));
            if (hasActive) {
                exclusiveSoldCount++;
            } else {
                exclusiveFreeCount++;
            }
        });

        const soldProfiles = normallySold + exclusiveSoldCount;
        const freeProfiles = normallyFree + exclusiveFreeCount;

        // Process Orders
        const todaysOrders = todaysOrdersRes.status === 'fulfilled' ? todaysOrdersRes.value.data || [] : [];
        const todayRevenue = todaysOrders.reduce((sum, o) => sum + parseFloat(o.amount || 0), 0);
        const todaySales = todaysOrders.length;

        // Process SMS
        let smsAvailable = '-';
        let smsSent = '-';
        const smsCheck = smsBalanceRes.status === 'fulfilled' ? smsBalanceRes.value : null;
        if (smsCheck && smsCheck.success && smsCheck.data && smsCheck.data.company_info) {
            smsAvailable = smsCheck.data.company_info.sms_available;
            smsSent = smsCheck.data.company_info.sms_sent;
        }

        // Process Top Clients
        const clientTotals = {};
        const topClientsOrders = topClientsOrdersRes.status === 'fulfilled' ? topClientsOrdersRes.value.data || [] : [];
        topClientsOrders.forEach(o => {
            if (o.phone) {
                clientTotals[o.phone] = (clientTotals[o.phone] || 0) + parseFloat(o.amount || 0);
            }
        });
        const topClients = Object.entries(clientTotals)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([phone, total]) => ({ phone, total }));

        // Process Recent Activity
        const recentActivity = [];
        const recentOrders = recentOrdersRes.status === 'fulfilled' ? recentOrdersRes.value.data || [] : [];
        recentOrders.forEach(ro => {
            const date = new Date(ro.created_at);
            recentActivity.push({
                title: `Nova Subscrição ${ro.plan_type} - ${ro.phone}`,
                time: date.toLocaleDateString() + ' ' + date.toLocaleTimeString()
            });
        });

        // Chart Data Aggregation
        const chartData = {
            daily: { labels: [], data: [] },
            weekly: { labels: [], data: [] },
            monthly: { labels: [], data: [] },
            quarterly: { labels: [], data: [] },
            semiannual: { labels: [], data: [] },
            annual: { labels: [], data: [] }
        };

        const allPaidOrders = allPaidOrdersRes.status === 'fulfilled' ? allPaidOrdersRes.value.data || [] : [];
        if (allPaidOrders.length > 0) {
            const getWeek = (d) => {
                const date = new Date(d.getTime());
                date.setHours(0, 0, 0, 0);
                date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
                const week1 = new Date(date.getFullYear(), 0, 4);
                return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
            };

            const aggregations = { daily: {}, weekly: {}, monthly: {}, quarterly: {}, semiannual: {}, annual: {} };

            allPaidOrders.forEach(o => {
                if (!o.paid_at) return;
                const d = new Date(o.paid_at);
                const amt = parseFloat(o.amount) || 0;
                const year = d.getFullYear();
                const month = d.getMonth() + 1;
                const day = d.getDate();

                const dailyKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                aggregations.daily[dailyKey] = (aggregations.daily[dailyKey] || 0) + amt;

                const weekNum = getWeek(d);
                const weeklyKey = `${year}-W${String(weekNum).padStart(2, '0')}`;
                aggregations.weekly[weeklyKey] = (aggregations.weekly[weeklyKey] || 0) + amt;

                const monthlyKey = `${year}-${String(month).padStart(2, '0')}`;
                aggregations.monthly[monthlyKey] = (aggregations.monthly[monthlyKey] || 0) + amt;

                const q = Math.ceil(month / 3);
                const quarterKey = `${year}-Q${q}`;
                aggregations.quarterly[quarterKey] = (aggregations.quarterly[quarterKey] || 0) + amt;

                const s = Math.ceil(month / 6);
                const semiKey = `${year}-S${s}`;
                aggregations.semiannual[semiKey] = (aggregations.semiannual[semiKey] || 0) + amt;

                const annualKey = `${year}`;
                aggregations.annual[annualKey] = (aggregations.annual[annualKey] || 0) + amt;
            });

            for (const key of Object.keys(aggregations)) {
                let entries = Object.entries(aggregations[key]).sort((a, b) => a[0].localeCompare(b[0]));
                
                if (key === 'daily') entries = entries.slice(-14);
                if (key === 'weekly') entries = entries.slice(-12);
                if (key === 'monthly') entries = entries.slice(-12);

                entries.forEach(([label, value]) => {
                    chartData[key].labels.push(label);
                    chartData[key].data.push(value);
                });
            }
        }

        res.json({
            success: true,
            data: {
                freeProfiles,
                soldProfiles,
                expiringAccounts,
                todayRevenue,
                todaySales,
                smsAvailable,
                smsSent,
                topClients,
                recentActivity,
                chartData
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
        // 1. Fetch all accounts and their profiles in a single query
        const { data: accounts, error } = await supabase
            .from('ecoflix_master_accounts')
            .select('*, profiles:ecoflix_profiles!ecoflix_profiles_master_account_id_fkey(*)')
            .order('created_at', { ascending: false });

        if (error) throw error;

        // 2. Process data in memory
        const accountsWithProfiles = accounts.map((acc) => {
            const profilesData = acc.profiles || [];
            const total = profilesData.length > 0 ? profilesData.length : 5;
            const occupied = profilesData.filter(p => p.status === 'SOLD').length;

            return { ...acc, profiles: profilesData, total, occupied };
        });

        res.json({ success: true, data: accountsWithProfiles });
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
        const { email, password, renewal_date, type = 'SHARED', notes, recovery_email, recovery_password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Email e senha são obrigatórios' });
        }

        const { data: account, error } = await supabase
            .from('ecoflix_master_accounts')
            .insert({ email, password, renewal_date, type, notes, recovery_email: recovery_email || null, recovery_password: recovery_password || null })
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

        sseBroadcast('stock_update', { reason: 'add_stock' });
        sseBroadcast('refresh_admin', { reason: 'add_stock' });

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
        const { email, password, renewal_date, type, status, notes, notify_users, recovery_email, recovery_password } = req.body;

        // Fetch original account to see if password changed
        const { data: originalAccount } = await supabase
            .from('ecoflix_master_accounts')
            .select('password, type')
            .eq('id', id)
            .single();

        const updatePayload = { email, password, renewal_date, type, status, notes, updated_at: new Date() };
        if (recovery_email !== undefined) updatePayload.recovery_email = recovery_email || null;
        if (recovery_password !== undefined) updatePayload.recovery_password = recovery_password || null;

        const { data: account, error } = await supabase
            .from('ecoflix_master_accounts')
            .update(updatePayload)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        // Notify users if requested and password actually changed
        if (notify_users && originalAccount && originalAccount.password !== password) {
            if (account.type === 'SHARED') {
                const { data: profiles } = await supabase
                    .from('ecoflix_profiles')
                    .select('client_phone, pin')
                    .eq('master_account_id', id)
                    .eq('status', 'SOLD')
                    .not('client_phone', 'is', null);
                
                if (profiles && profiles.length > 0) {
                    for (const p of profiles) {
                        await smsService.sendPasswordUpdateSms(p.client_phone, {
                            email: account.email,
                            password: account.password,
                            pin: p.pin
                        });
                    }
                }
            } else if (account.type === 'EXCLUSIVE') {
                const { data: subs } = await supabase
                    .from('ecoflix_subscriptions')
                    .select('ecoflix_orders(phone)')
                    .eq('master_account_id', id)
                    .eq('status', 'ACTIVE')
                    .is('profile_id', null);
                
                if (subs && subs.length > 0) {
                    for (const sub of subs) {
                        if (sub.ecoflix_orders && sub.ecoflix_orders.phone) {
                            await smsService.sendPasswordUpdateSms(sub.ecoflix_orders.phone, {
                                email: account.email,
                                password: account.password
                            });
                        }
                    }
                }
            }
        }

        sseBroadcast('stock_update', { reason: 'update_account' });
        sseBroadcast('refresh_admin', { reason: 'update_account' });
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

        // Fetch all profiles for this account
        const { data: profiles } = await supabase
            .from('ecoflix_profiles')
            .select('id')
            .eq('master_account_id', id);

        if (profiles && profiles.length > 0) {
            const profileIds = profiles.map(p => p.id);
            // Cascade delete subscriptions linked to these profiles to avoid FK constraint errors
            await supabase
                .from('ecoflix_subscriptions')
                .delete()
                .in('profile_id', profileIds);
        }

        // Also delete any subscriptions linked directly to the master account (EXCLUSIVE accounts)
        await supabase
            .from('ecoflix_subscriptions')
            .delete()
            .eq('master_account_id', id);

        const { error } = await supabase
            .from('ecoflix_master_accounts')
            .delete()
            .eq('id', id);

        if (error) throw error;

        sseBroadcast('stock_update', { reason: 'delete_account' });
        sseBroadcast('refresh_admin', { reason: 'delete_account' });
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
        const { pin, status, type, client_name, client_phone, expires_at, name } = req.body;

        const updateData = { updated_at: new Date() };
        if (name !== undefined) updateData.name = name;
        if (pin !== undefined) updateData.pin = pin;
        if (status !== undefined) updateData.status = status;
        
        if (type !== undefined) {
            if (type === 'TV') {
                const { data: currentProfile } = await supabase.from('ecoflix_profiles').select('master_account_id').eq('id', id).single();
                if (currentProfile) {
                    const { data: tvProfiles } = await supabase.from('ecoflix_profiles')
                        .select('id')
                        .eq('master_account_id', currentProfile.master_account_id)
                        .eq('type', 'TV')
                        .neq('id', id);
                    if (tvProfiles && tvProfiles.length > 0) {
                        return res.status(400).json({ success: false, message: 'Esta Conta Mãe já tem um perfil de TV. Mude o outro para Mobile primeiro.' });
                    }
                }
            }
            updateData.type = type;
        }

        if (client_name !== undefined) updateData.client_name = client_name;
        if (client_phone !== undefined) updateData.client_phone = client_phone;
        if (expires_at !== undefined) updateData.expires_at = expires_at;

        // If resetting to AVAILABLE, clear client data
        if (status === 'AVAILABLE') {
            updateData.client_name = null;
            updateData.client_phone = null;
            updateData.expires_at = null;
        }

        const { data: profile, error } = await supabase
            .from('ecoflix_profiles')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        // Sync subscription status if profile status changed
        if (status === 'AVAILABLE') {
            await supabase
                .from('ecoflix_subscriptions')
                .update({ status: 'CANCELLED', updated_at: new Date() })
                .eq('profile_id', id)
                .in('status', ['ACTIVE', 'SUSPENDED']);
        } else if (status === 'SUSPENDED') {
            await supabase
                .from('ecoflix_subscriptions')
                .update({ status: 'SUSPENDED', updated_at: new Date() })
                .eq('profile_id', id)
                .in('status', ['ACTIVE']);
        }

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

        sseBroadcast('stock_update', { reason: 'update_profile' });
        sseBroadcast('refresh_admin', { reason: 'approve_order' });
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
// ADMIN: Get SMS Logs
// ============================================================================
const getSmsLogs = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('ecoflix_sms_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(100);

        if (error) throw error;

        res.json({ success: true, logs: data || [] });
    } catch (error) {
        console.error('Get SMS Logs Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ============================================================================
// ADMIN: Get Orders
// ============================================================================
const getOrders = async (req, res) => {
    try {
        const { status, page = 1, limit = 10 } = req.query;
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);

        let query = supabase
            .from('ecoflix_orders')
            .select(`
                *,
                user:ecoflix_users(name, phone),
                subscription:ecoflix_subscriptions!fk_orders_subscription(
                    plan_type, expires_at,
                    profile:ecoflix_profiles!fk_subscriptions_profile(name, pin),
                    account:ecoflix_master_accounts(email)
                )
            `, { count: 'exact' })
            .order('status', { ascending: false })
            .order('created_at', { ascending: false });

        if (status) {
            query = query.eq('status', status);
        }

        const from = (pageNum - 1) * limitNum;
        const to = from + limitNum - 1;
        query = query.range(from, to);

        const { data, error, count } = await query;

        if (error) throw error;

        res.json({ success: true, data: data || [], total: count, page: pageNum, limit: limitNum });
    } catch (error) {
        console.error('Get orders error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const resolveIssue = async (req, res) => {
    try {
        const { id } = req.params;
        const { data, error } = await supabase
            .from('ecoflix_issues')
            .update({ status: 'RESOLVED', resolved_at: new Date() })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        res.json({ success: true, data });
    } catch (error) {
        console.error('Resolve issue error:', error);
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

        // Fetch exclusive accounts to calculate their status directly based on subscriptions
        const { data: exclusiveAccounts } = await supabase
            .from('ecoflix_master_accounts')
            .select('id, subscriptions:ecoflix_subscriptions(status)')
            .eq('type', 'EXCLUSIVE');

        let extraSold = 0;
        let extraSuspended = 0;
        let exclusiveAvailable = 0;

        if (exclusiveAccounts) {
            exclusiveAccounts.forEach(acc => {
                if (!acc.subscriptions || acc.subscriptions.length === 0) {
                    exclusiveAvailable += 1;
                } else {
                    const hasActive = acc.subscriptions.some(s => s.status === 'ACTIVE');
                    const hasSuspended = acc.subscriptions.some(s => s.status === 'SUSPENDED');
                    
                    if (hasSuspended && !hasActive) {
                        extraSuspended += 1;
                    } else if (hasActive || hasSuspended) {
                        extraSold += 1;
                    } else {
                        exclusiveAvailable += 1;
                    }
                }
            });
        }

        sseBroadcast('refresh_admin', { reason: 'resolve_issue' });
        res.json({
            success: true,
            data: {
                mobile_available: mobileAvailable || 0,
                tv_available: tvAvailable || 0,
                exclusive_available: exclusiveAvailable,
                sold: (soldTotal || 0) + extraSold,
                suspended: (suspendedTotal || 0) + extraSuspended
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
        if (redisClient) {
            const cacheKey = 'ecoflix:relatorio_csv_cache';
            const cachedContent = await redisClient.get(cacheKey);

            if (cachedContent) {
                console.log('⚡ Sales Report served via Redis Cache');
                res.setHeader('Content-Type', 'text/csv');
                return res.status(200).send(cachedContent);
            }
        }

        // 3. FETCH FROM VIEW
        const { data, error } = await supabase
            .from('view_relatorio_influenciadores')
            .select('*')
            .csv();

        if (error) throw error;

        // 4. CACHE IN REDIS (1 HOUR)
        if (redisClient) {
            await redisClient.set(cacheKey, data, 'EX', 3600);
            console.log('🐢 Sales Report served via Database (New Cache Created)');
        }

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

// ============================================================================
// ADMIN: Configurações de Planos
// ============================================================================
const getPlans = async (req, res) => {
    try {
        const plans = await planService.getPlans();
        res.json({ success: true, data: plans });
    } catch (error) {
        console.error('Erro ao ler planos:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const updatePlans = async (req, res) => {
    try {
        const newPrices = req.body;
        const currentPlans = await planService.getPlans();

        const plansToSave = {};
        const PAYGO_API_KEY = process.env.PAYGOOO_API_KEY;
        const PAYGO_BASE_URL = 'https://rouxavcvorjiwhpjhsye.supabase.co/functions/v1/api-v1';
        const axios = require('axios');

        for (const [key, current] of Object.entries(currentPlans)) {
            const newPrice = parseInt(newPrices[key]);

            // If the price differs and we have a PayGo key, create a new Product
            if (newPrice && newPrice !== current.price && PAYGO_API_KEY) {
                const { data: prod } = await axios.post(
                    `${PAYGO_BASE_URL}/products`,
                    { name: `EcoFlix ${key}`, price: newPrice, thank_you_url: 'https://ecokambio.com', description: `Acesso EcoFlix ${key}` },
                    { headers: { 'x-api-key': PAYGO_API_KEY, 'Content-Type': 'application/json' } }
                );
                const newPaygoId = prod?.product?.id || prod?.id;
                plansToSave[key] = { price: newPrice, paygo_id: newPaygoId };
            } else {
                plansToSave[key] = { ...current, price: newPrice || current.price };
            }
        }
        
        const updatedPlans = await planService.updatePlans(plansToSave);
        sseBroadcast('refresh_admin', { reason: 'update_plans' });
        res.json({ success: true, data: updatedPlans, message: 'Preços atualizados com sucesso' });
    } catch (error) {
        console.error('Erro ao atualizar planos:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ============================================================================
// ADMIN: Get Issues
// ============================================================================
const getIssues = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('ecoflix_issues')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        res.json({ success: true, data: data || [] });
    } catch (error) {
        console.error('Get issues error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ============================================================================
// ADMIN: Get Clients
// ============================================================================
const getClients = async (req, res) => {
    try {
        const { page = 1, limit = 50 } = req.query;
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const from = (pageNum - 1) * limitNum;
        const to = from + limitNum - 1;

        const { data, error, count } = await supabase
            .from('ecoflix_subscriptions')
            .select(`
                *,
                user:ecoflix_users(*),
                profile:ecoflix_profiles!fk_subscriptions_profile(
                    *,
                    master_account:ecoflix_master_accounts!ecoflix_profiles_master_account_id_fkey(*)
                ),
                account:ecoflix_master_accounts(*)
            `, { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(from, to);

        if (error) throw error;

        // Map end_date to expires_at so frontend doesn't break
        const mappedData = data.map(sub => ({
            ...sub,
            end_date: sub.expires_at // For renderCustomers compat
        }));

        res.json({ success: true, data: mappedData || [], total: count, page: pageNum, limit: limitNum });
    } catch (error) {
        console.error('Get clients error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    getPlans,
    updatePlans,
    getDashboard,
    getStock,
    createAccount,
    updateAccount,
    deleteAccount,
    updateProfile,
    getNotifications,
    getSmsLogs,
    getOrders,
    getInventoryStatus,
    getExportCSV,
    getClients,
    getIssues,
    resolveIssue,
    exportSalesAuto,
    getInfluencerStats,
    getRecoveryData,
    getPartnerStats,
    markPartnerPaid,
    getSalesOriginChart,
    createPartner
};

// ============================================================================
// ADMIN: Revoke Profile
// ============================================================================
const revokeProfile = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason = 'Revogado pelo administrador' } = req.body;

        // 1. Fetch profile with active subscription
        const { data: profile, error: profileError } = await supabase
            .from('ecoflix_profiles')
            .select('*, subscriptions:ecoflix_subscriptions!fk_subscriptions_profile(id, status, user_id)')
            .eq('id', id)
            .single();

        if (profileError || !profile) {
            return res.status(404).json({ success: false, message: 'Perfil não encontrado' });
        }

        const clientPhone = profile.client_phone;
        const activeSubscription = (profile.subscriptions || []).find(s => s.status === 'ACTIVE');

        // 2. Reset Profile to AVAILABLE
        await supabase
            .from('ecoflix_profiles')
            .update({
                status: 'AVAILABLE',
                client_name: null,
                client_phone: null,
                expires_at: null,
                updated_at: new Date()
            })
            .eq('id', id);

        // 3. Revoke ALL subscriptions linked to this profile (regardless of client_phone)
        const { error: subError } = await supabase
            .from('ecoflix_subscriptions')
            .update({ status: 'CANCELLED', updated_at: new Date() })
            .eq('profile_id', id)
            .in('status', ['ACTIVE', 'SUSPENDED']);

        if (subError) console.error('[Revoke] Subscription update error:', subError.message);

        // 4. If we know the user_id, also cancel any PENDING/PAID orders for that user
        if (activeSubscription?.user_id) {
            await supabase
                .from('ecoflix_orders')
                .update({ status: 'CANCELLED', updated_at: new Date() })
                .eq('user_id', activeSubscription.user_id)
                .in('status', ['PENDING']);
        }

        // 5. Send SMS if phone exists
        const phoneToNotify = clientPhone;
        if (phoneToNotify) {
            try {
                const smsService = require('../services/sms.service');
                await smsService.sendRevokeSms(phoneToNotify, reason);
            } catch (smsErr) {
                console.error('[Revoke] Failed to send SMS:', smsErr.message);
            }
        }

        console.log(`[Revoke] Profile ${id} revoked. client_phone=${clientPhone || 'unknown'}`);
        sseBroadcast('stock_update', { reason: 'revoke_profile' });
        sseBroadcast('refresh_admin', { reason: 'revoke_profile' });
        res.json({ success: true, message: 'Perfil revogado com sucesso. O utilizador foi desconectado.' });
    } catch (error) {
        console.error('Revoke profile error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports.revokeProfile = revokeProfile;

const suspendProfile = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        const { data: profile } = await supabase
            .from('ecoflix_profiles')
            .select('client_phone')
            .eq('id', id)
            .single();

        if (!profile) return res.status(404).json({ success: false, message: 'Perfil não encontrado' });

        await supabase
            .from('ecoflix_profiles')
            .update({ status: 'SUSPENDED', updated_at: new Date() })
            .eq('id', id);

        await supabase
            .from('ecoflix_subscriptions')
            .update({ status: 'SUSPENDED', updated_at: new Date() })
            .eq('profile_id', id)
            .eq('status', 'ACTIVE');

        if (profile.client_phone) {
            const smsService = require('../services/sms.service');
            await smsService.sendSuspendSms(profile.client_phone, reason);
        }

        sseBroadcast('stock_update', { reason: 'suspend_profile' });
        sseBroadcast('refresh_admin', { reason: 'suspend_profile' });
        res.json({ success: true, message: 'Perfil suspenso.' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const restoreProfile = async (req, res) => {
    try {
        const { id } = req.params;

        const { data: profile } = await supabase
            .from('ecoflix_profiles')
            .select('client_phone')
            .eq('id', id)
            .single();

        if (!profile) return res.status(404).json({ success: false, message: 'Perfil não encontrado' });

        await supabase
            .from('ecoflix_profiles')
            .update({ status: 'SOLD', updated_at: new Date() })
            .eq('id', id);

        await supabase
            .from('ecoflix_subscriptions')
            .update({ status: 'ACTIVE', updated_at: new Date() })
            .eq('profile_id', id)
            .eq('status', 'SUSPENDED');

        if (profile.client_phone) {
            const smsService = require('../services/sms.service');
            await smsService.sendRestoreSms(profile.client_phone);
        }

        sseBroadcast('stock_update', { reason: 'return_profile' });
        sseBroadcast('refresh_admin', { reason: 'return_profile' });
        res.json({ success: true, message: 'Perfil devolvido/restaurado.' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};



const getSupportClients = async (req, res) => {
    try {

        const query = req.query.q || '';
        let { data: allSubscriptions, error } = await supabase
            .from('ecoflix_subscriptions')
            .select(`
                id,
                status,
                expires_at,
                profile:ecoflix_profiles!fk_subscriptions_profile (
                    id, name, pin, client_phone, status,
                    master_account:ecoflix_master_accounts!ecoflix_profiles_master_account_id_fkey(email, password)
                ),
                account:ecoflix_master_accounts(email, password),
                order:ecoflix_orders!ecoflix_subscriptions_order_id_fkey(phone, reference_id, plan_type, amount, paid_at, expires_at)
            `)
            .order('created_at', { ascending: false });

        if (error) throw error;

        const groupedMap = new Map();

        allSubscriptions.forEach(sub => {
            if (!sub.order || !sub.order.phone) return;
            const phone = sub.order.phone;
            
            // Search filter
            if (query && !phone.includes(query) && !sub.order.reference_id.toLowerCase().includes(query.toLowerCase())) return;

            if (!groupedMap.has(phone)) {
                groupedMap.set(phone, {
                    phone: phone,
                    total_amount: 0,
                    active_count: 0,
                    subscriptions: []
                });
            }

            const client = groupedMap.get(phone);
            client.total_amount += sub.order.amount;
            if (sub.status === 'ACTIVE') {
                client.active_count += 1;
            }

            client.subscriptions.push(sub);
        });

        res.json({ success: true, data: Array.from(groupedMap.values()) });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const resendSms = async (req, res) => {
    try {
        const { phone, email, password, profile, pin } = req.body;
        const smsService = require('../services/sms.service');
        await smsService.sendDeliverySms(phone, { email, password, profile, pin });
        res.json({ success: true, message: 'SMS reenviado com sucesso.' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const suspendAccount = async (req, res) => {
    try {
        const { subscription_id, phone } = req.body;
        
        await supabase
            .from('ecoflix_subscriptions')
            .update({ status: 'SUSPENDED' })
            .eq('id', subscription_id);

        const smsService = require('../services/sms.service');
        await smsService.sendRevokeSms(phone, 'Partilha indevida de dados / Violação de Termos');

        sseBroadcast('stock_update', { reason: 'suspend_account' });
        sseBroadcast('refresh_admin', { reason: 'suspend_account' });
        res.json({ success: true, message: 'Conta suspensa e cliente notificado.' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const restoreAccount = async (req, res) => {
    try {
        const { subscription_id, phone } = req.body;

        const { data: sub } = await supabase
            .from('ecoflix_subscriptions')
            .select('profile_id, status')
            .eq('id', subscription_id)
            .single();

        if (!sub) throw new Error("Subscrição não encontrada.");

        const { data: activeSubs } = await supabase
            .from('ecoflix_subscriptions')
            .select('id')
            .eq('profile_id', sub.profile_id)
            .eq('status', 'ACTIVE');

        if (activeSubs && activeSubs.length > 0) {
            throw new Error("Não é possível reativar. Este perfil já foi vendido ou alocado a outro utilizador.");
        }

        await supabase
            .from('ecoflix_subscriptions')
            .update({ status: 'ACTIVE' })
            .eq('id', subscription_id);

        await supabase
            .from('ecoflix_profiles')
            .update({ status: 'SOLD' })
            .eq('id', sub.profile_id);

        const smsService = require('../services/sms.service');
        if (phone) {
            await smsService.sendRestoreSms(phone);
        }

        sseBroadcast('stock_update', { reason: 'reactivate_account' });
        sseBroadcast('refresh_admin', { reason: 'reactivate_account' });
        res.json({ success: true, message: 'Conta reativada com sucesso e SMS enviado.' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const resetPassword = async (req, res) => {
    try {
        const { master_account_id, new_password } = req.body;
        
        await supabase
            .from('ecoflix_master_accounts')
            .update({ password: new_password })
            .eq('id', master_account_id);

        res.json({ success: true, message: 'Palavra-passe atualizada com sucesso.' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const fs = require('fs');
const path = require('path');
const SETTINGS_FILE = path.join(__dirname, '../settings.json');

const getSettings = async (req, res) => {
    try {
        if (!fs.existsSync(SETTINGS_FILE)) {
            return res.json({ success: true, settings: {} });
        }
        const settingsData = fs.readFileSync(SETTINGS_FILE, 'utf8');
        res.json({ success: true, settings: JSON.parse(settingsData) });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const updateSettings = async (req, res) => {
    try {
        const { key, value } = req.body;
        if (!key) throw new Error("Chave de configuração não fornecida.");

        let currentSettings = {};
        if (fs.existsSync(SETTINGS_FILE)) {
            currentSettings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
        }

        currentSettings[key] = value;
        fs.writeFileSync(SETTINGS_FILE, JSON.stringify(currentSettings, null, 4));

        res.json({ success: true, message: 'Configuração atualizada com sucesso.' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};


const searchSupportClient = async (req, res) => {
    try {
        const phone = req.params.phone;

        // Fetch orders and their nested subscriptions and profiles
        const { data, error } = await supabase
            .from('ecoflix_orders')
            .select(`
                id,
                plan_type,
                paid_at,
                phone,
                subscription:ecoflix_subscriptions!ecoflix_subscriptions_order_id_fkey (
                    id,
                    status,
                    profile:ecoflix_profiles!fk_subscriptions_profile (
                        name,
                        pin,
                        master_account:ecoflix_master_accounts!ecoflix_profiles_master_account_id_fkey (
                            id,
                            email,
                            password
                        )
                    )
                )
            `)
            .like('phone', `%${phone}%`)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching support client:', error);
            return res.json({ success: false, message: 'Erro ao pesquisar na base de dados.' });
        }
        
        // Flatten subscription arrays (one-to-many relation returns arrays)
        const formattedData = data.map(order => {
            let sub = order.subscription;
            if (Array.isArray(sub)) sub = sub.length > 0 ? sub[0] : null;
            return { ...order, subscription: sub };
        });

        // Priority: most recent order that has an active subscription
        // Fallback: just the most recent order (first item, already sorted desc)
        const ACTIVE_STATUSES = ['ACTIVE', 'SOLD'];
        const bestOrder =
            formattedData.find(o => o.subscription && ACTIVE_STATUSES.includes(o.subscription.status)) ||
            formattedData.find(o => o.subscription) ||
            formattedData[0] ||
            null;

        res.json({ success: true, data: bestOrder ? [bestOrder] : [] });
    } catch (e) {
        console.error('searchSupportClient error:', e);
        res.json({ success: false, message: 'Erro interno no servidor' });
    }
};

module.exports.searchSupportClient = searchSupportClient;
module.exports.getSupportClients = getSupportClients;
module.exports.resendSms = resendSms;
module.exports.suspendAccount = suspendAccount;
module.exports.restoreAccount = restoreAccount;
module.exports.resetPassword = resetPassword;
module.exports.getSettings = getSettings;
module.exports.updateSettings = updateSettings;

