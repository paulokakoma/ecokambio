const supabase = require('./src/config/supabase');
async function run() {
        const { count: normallyFree } = await supabase
            .from('ecoflix_profiles')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'AVAILABLE');

        const { count: normallySold } = await supabase
            .from('ecoflix_profiles')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'SOLD');

        const { data: exclusiveAccounts } = await supabase
            .from('ecoflix_master_accounts')
            .select('id, subscriptions:ecoflix_subscriptions(id, status)')
            .eq('type', 'EXCLUSIVE');

        let exclusiveFreeCount = 0;
        let exclusiveSoldCount = 0;

        if (exclusiveAccounts) {
            exclusiveAccounts.forEach(acc => {
                const hasActive = acc.subscriptions && acc.subscriptions.some(s => ['ACTIVE', 'SUSPENDED'].includes(s.status));
                if (hasActive) {
                    exclusiveSoldCount += 5;
                } else {
                    exclusiveFreeCount += 5;
                }
            });
        }

        const freeProfiles = (normallyFree || 0) + exclusiveFreeCount;
        const soldProfiles = (normallySold || 0) + exclusiveSoldCount;

        console.log("normallyFree:", normallyFree);
        console.log("normallySold:", normallySold);
        console.log("exclusiveFreeCount:", exclusiveFreeCount);
        console.log("exclusiveSoldCount:", exclusiveSoldCount);
        console.log("freeProfiles:", freeProfiles);
        console.log("soldProfiles:", soldProfiles);
}
run();
