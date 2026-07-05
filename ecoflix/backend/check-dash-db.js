const supabase = require('./src/config/supabase');
async function run() {
    const { data: accounts } = await supabase.from('ecoflix_master_accounts').select('*');
    const { data: profiles } = await supabase.from('ecoflix_profiles').select('*');
    console.log("Accounts:", accounts.length, accounts.map(a => `${a.type} - ${a.email}`));
    console.log("Profiles count:", profiles.length);
    console.log("Available profiles:", profiles.filter(p => p.status === 'AVAILABLE').length);
    console.log("Sold profiles:", profiles.filter(p => p.status === 'SOLD').length);
    console.log("Suspended profiles:", profiles.filter(p => p.status === 'SUSPENDED').length);
}
run();
