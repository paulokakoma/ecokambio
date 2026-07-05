const supabase = require('./src/config/supabase');
async function run() {
    const { data } = await supabase.from('ecoflix_orders').select('*').order('created_at', { ascending: false }).limit(5);
    console.log(JSON.stringify(data, null, 2));
}
run();
