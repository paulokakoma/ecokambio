const supabase = require('./src/config/supabase');
async function run() {
  const { data, error } = await supabase
            .from('ecoflix_subscriptions')
            .select(`
                *,
                order:ecoflix_orders(plan_type),
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
  console.log("Error:", error);
  console.log("Data:", JSON.stringify(data, null, 2));
}
run();
