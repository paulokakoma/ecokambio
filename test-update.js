const supabase = require('./src/config/supabase');
async function run() {
  const { data, error } = await supabase
            .from('ecoflix_subscriptions')
            .update({ status: 'CANCELLED', updated_at: new Date() })
            .eq('profile_id', '244d0fda-88be-462a-85c7-50451c2b3e23')
            .in('status', ['ACTIVE', 'SUSPENDED'])
            .select();
  console.log("Data:", data);
  console.log("Error:", error);
}
run();
