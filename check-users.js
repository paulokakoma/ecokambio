const supabase = require('./src/config/supabase');
async function run() {
    const { data } = await supabase.from('ecoflix_users').select('*').order('created_at', { ascending: false }).limit(5);
    console.log("Recent users:", data);
}
run();
