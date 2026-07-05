const supabase = require('./src/config/supabase');
async function run() {
    const { data } = await supabase.from('ecoflix_master_accounts').select('*').eq('type', 'EXCLUSIVE');
    console.log(data);
}
run();
