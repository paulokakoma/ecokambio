const supabase = require('./src/config/supabase');
async function run() {
    const { data: subs } = await supabase
            .from('ecoflix_subscriptions')
            .select('*')
            .eq('user_id', '6b8b7450-d210-46a9-92a0-d15bca2df079')
    console.log("ALL SUBS: ", subs.map(s => ({id: s.id, order: s.order_id, profile: s.profile_id, status: s.status})));
}
run();
