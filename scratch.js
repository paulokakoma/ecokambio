const supabase = require('./src/config/supabase');
async function check() {
  const { data: orders } = await supabase.from('ecoflix_orders').select('*').order('created_at', { ascending: false }).limit(2);
  const { data: subs } = await supabase.from('ecoflix_subscriptions').select('*').order('created_at', { ascending: false }).limit(2);
  console.log("Last Orders:", JSON.stringify(orders, null, 2));
  console.log("Last Subs:", JSON.stringify(subs, null, 2));
}
check();
