const supabase = require('./src/config/supabase');
async function run() {
        const { data: profs } = await supabase
            .from('ecoflix_profiles')
            .select('*')
            .eq('master_account_id', '0e91284f-e284-46d1-a4f8-9ee4e33d31d6');
        console.log("profs count:", profs ? profs.length : 0);
}
run();
