const supabase = require('./src/config/supabase');
async function run() {
        const { count: totalProfilesCount } = await supabase
            .from('ecoflix_profiles')
            .select('*', { count: 'exact', head: true });
        const { count: normallySold } = await supabase
            .from('ecoflix_profiles')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'SOLD');
        const { data: exclusiveSubs } = await supabase
            .from('ecoflix_subscriptions')
            .select('master_account_id')
            .is('profile_id', null)
            .in('status', ['ACTIVE', 'SUSPENDED']);
        
        let exclusiveSold = 0;
        if (exclusiveSubs && exclusiveSubs.length > 0) {
            const masterAccountIds = exclusiveSubs.map(s => s.master_account_id);
            const { count: exclusiveProfilesCount } = await supabase
                .from('ecoflix_profiles')
                .select('*', { count: 'exact', head: true })
                .in('master_account_id', masterAccountIds);
            exclusiveSold = exclusiveProfilesCount || 0;
        }

        const soldProfiles = (normallySold || 0) + exclusiveSold;
        const freeProfiles = (totalProfilesCount || 0) - soldProfiles;
        
        console.log("normallySold:", normallySold);
        console.log("exclusiveSold:", exclusiveSold);
        console.log("soldProfiles:", soldProfiles);
        console.log("freeProfiles:", freeProfiles);
}
run();
