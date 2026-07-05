const supabase = require('./src/config/supabase');
async function run() {
  const { data: profiles } = await supabase.from('ecoflix_profiles').select('id').eq('status', 'AVAILABLE');
  if (profiles && profiles.length > 0) {
    const ids = profiles.map(p => p.id);
    const { data, error } = await supabase
        .from('ecoflix_subscriptions')
        .update({ status: 'CANCELLED', updated_at: new Date() })
        .in('profile_id', ids)
        .in('status', ['ACTIVE', 'SUSPENDED'])
        .select();
    console.log("Updated", data ? data.length : 0, "subscriptions.");
  }
}
run();
