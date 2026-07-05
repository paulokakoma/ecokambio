const supabase = require('./src/config/supabase');
async function run() {
    const { data, error } = await supabase.from('ecoflix_subscriptions').select('*').order('created_at', { ascending: false }).limit(2);
    console.log("Error:", error);
    console.log(JSON.stringify(data, null, 2));
}
run();
