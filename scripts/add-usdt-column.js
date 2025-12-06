const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

async function addUsdtRateColumn() {
    console.log('🔧 Adding usdt_rate column to rate_providers table...');

    try {
        // Using Supabase's RPC or direct SQL execution
        // Since Supabase JS client doesn't have direct DDL, we'll use the REST API
        const { data, error } = await supabase.rpc('exec_sql', {
            query: 'ALTER TABLE rate_providers ADD COLUMN IF NOT EXISTS usdt_rate NUMERIC;'
        });

        if (error) {
            // Try alternative approach - check if column exists first
            const { data: testData, error: testError } = await supabase
                .from('rate_providers')
                .select('usdt_rate')
                .limit(1);

            if (testError && testError.message.includes('column "usdt_rate" does not exist')) {
                console.log('⚠️  Column does not exist. Please add manually via Supabase dashboard:');
                console.log('   ALTER TABLE rate_providers ADD COLUMN usdt_rate NUMERIC;');
                process.exit(1);
            } else if (!testError) {
                console.log('✅ Column usdt_rate already exists!');
                process.exit(0);
            }
        } else {
            console.log('✅ Column added successfully!');
        }
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.log('\n💡 Please add the column manually via Supabase dashboard SQL editor:');
        console.log('   ALTER TABLE rate_providers ADD COLUMN usdt_rate NUMERIC;');
        process.exit(1);
    }
}

addUsdtRateColumn();
