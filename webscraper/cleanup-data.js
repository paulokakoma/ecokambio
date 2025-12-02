
require('dotenv').config();
const supabase = require('../src/config/supabase');

(async () => {
    console.log('🧹 Starting database cleanup...');

    // 1. Identify bad records (rates > 5000)
    const { data: badRates, error: fetchError } = await supabase
        .from('exchange_rates')
        .select('id, sell_rate, currency_pair, provider_id')
        .gt('sell_rate', 5000);

    if (fetchError) {
        console.error('❌ Error fetching bad rates:', fetchError);
        process.exit(1);
    }

    console.log(`🔍 Found ${badRates.length} erroneous records (rate > 5000).`);

    if (badRates.length === 0) {
        console.log('✅ No bad data found.');
        process.exit(0);
    }

    // Log a few examples
    console.log('Examples of bad data:', badRates.slice(0, 3));

    // 2. Delete bad records
    const { error: deleteError } = await supabase
        .from('exchange_rates')
        .delete()
        .gt('sell_rate', 5000);

    if (deleteError) {
        console.error('❌ Error deleting bad rates:', deleteError);
        process.exit(1);
    }

    console.log('✅ Successfully deleted bad records.');
    process.exit(0);
})();
