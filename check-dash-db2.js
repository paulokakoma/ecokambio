const supabase = require('./src/config/supabase');
async function run() {
    const { data: profiles } = await supabase.from('ecoflix_profiles').select('name, master_account_id');
    const counts = {};
    profiles.forEach(p => {
        counts[p.master_account_id] = (counts[p.master_account_id] || 0) + 1;
    });
    console.log(counts);
}
run();
