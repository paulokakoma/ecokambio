const supabase = require('./src/config/supabase');
async function test() {
    const { data, error } = await supabase
        .from('ecoflix_subscriptions')
        .select(`
            id,
            profile:ecoflix_profiles!fk_subscriptions_profile(*)
        `).limit(1);
    
    if (error) {
        console.log("Failed fk_subscriptions_profile:", error.message);
        const { data: d2, error: e2 } = await supabase
            .from('ecoflix_subscriptions')
            .select(`
                id,
                profile:ecoflix_profiles!ecoflix_subscriptions_profile_id_fkey(*)
            `).limit(1);
        console.log("Result with ecoflix_subscriptions_profile_id_fkey:", e2 ? e2.message : "Success");
    } else {
        console.log("Success with fk_subscriptions_profile");
    }
}
test();
