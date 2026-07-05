const supabase = require('./src/config/supabase');
async function run() {
    const { data: subs } = await supabase
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
            .eq('user_id', '6b8b7450-d210-46a9-92a0-d15bca2df079')
            .eq('status', 'ACTIVE')
            .order('created_at', { ascending: false });

    const formalProfileIds = new Set(subs ? subs.map(s => s.profile_id).filter(id => id) : []);
    console.log("FORMAL IDS: ", formalProfileIds);

    const cleanPhone = '927862935';
    const { data: manualProfiles } = await supabase
            .from('ecoflix_profiles')
            .select(`
                id, name, pin, expires_at, status, type,
                master_account:ecoflix_master_accounts!ecoflix_profiles_master_account_id_fkey (email, password)
            `)
            .or(`client_phone.eq.${cleanPhone},client_phone.eq.+244${cleanPhone},client_phone.eq.244${cleanPhone}`)
            .eq('status', 'SOLD')
            .order('updated_at', { ascending: false });

    console.log("MANUAL RAW IDS: ", manualProfiles.map(m => m.id));

    manualProfiles.forEach(m => {
        console.log("HAS? ", m.id, formalProfileIds.has(m.id));
    });
}
run();
