const supabase = require('./src/config/supabase');
async function run() {
  const { data } = await supabase.from('ecoflix_subscriptions').select('id, profile_id, master_account_id, status, plan_type, user_id').order('created_at', { ascending: false }).limit(5);
  console.log("Subs:", JSON.stringify(data, null, 2));
}
run();
