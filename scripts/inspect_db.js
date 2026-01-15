const supabase = require('../src/config/supabase');

(async () => {
    console.log('--- Inspecting ecoflix_profiles ---');
    // Try to get one row
    const { data, error } = await supabase.from('ecoflix_profiles').select('*').limit(1);
    if (error) {
        console.error('Select Error:', error.message);
    } else if (data.length > 0) {
        console.log('Columns:', Object.keys(data[0]));
    } else {
        console.log('Table is empty. Cannot deduce columns from data.');
        // Try inserting with a random column to see if it suggests valid columns? 
        // Postgres error messages sometimes list columns or say "column x does not exist".
        // Let's try inserting a dummy to see "column account_id does not exist".
        // We already know account_id doesn't exist.
        // Let's try master_account_id
        console.log('Trying master_account_id...');
        const { error: insError } = await supabase.from('ecoflix_profiles').insert({
            master_account_id: 1,
            name: 'Test',
            pin: '1234'
        });
        if (insError) console.log('Insert Error:', insError.message);
    }
})();
