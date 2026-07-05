const supabase = require('./src/config/supabase');
async function run() {
    const { data } = await supabase.from('ecoflix_profiles').select('type');
    console.log(data);
}
run();
