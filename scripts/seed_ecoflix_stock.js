const supabase = require('../src/config/supabase');

(async () => {
    try {
        console.log('--- Seeding Stock ---');
        const email = `test_acc_${Date.now()}@netflix.com`;

        // Create Master Account
        const { data: account, error } = await supabase
            .from('ecoflix_master_accounts')
            .insert({
                email: email,
                password: 'password123',
                renewal_date: '2026-12-31',
                type: 'SHARED',
                status: 'ACTIVE'
            })
            .select()
            .single();

        if (error) throw error;
        console.log('✅ Account Created:', account.email);

        // Wait for trigger to create profiles (Supabase triggers are fast but technically async in propagation sometimes?)
        // Actually triggers run in the same transaction usually.
        // Let's verify profiles.

        // Give it 1 second if needed or just query.

        const { data: profiles, error: pError } = await supabase
            .from('ecoflix_profiles')
            .select('*')
            .eq('master_account_id', account.id);

        if (pError) throw pError;

        console.log(`✅ Profiles Found: ${profiles.length}`);

        if (profiles.length === 0) {
            console.warn('⚠️ No profiles created. Trigger might be missing?');
            // Manually create if trigger missing (fallback for dev)
            const newProfiles = [];
            for (let i = 1; i <= 4; i++) {
                newProfiles.push({
                    master_account_id: account.id,
                    name: `Perfil ${i}`,
                    pin: '0000',
                    status: 'AVAILABLE'
                });
            }
            const { error: insError } = await supabase.from('ecoflix_profiles').insert(newProfiles);
            if (insError) throw insError;
            console.log('✅ Manually created 4 profiles.');
        }

    } catch (error) {
        console.error('❌ Seed Failed:', error.message);
    }
})();
