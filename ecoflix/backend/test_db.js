const fs = require('fs');
const env = fs.readFileSync('../../.env', 'utf8');
const supabaseUrl = env.match(/SUPABASE_URL=(.*)/)[1];
const supabaseKey = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1];
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(supabaseUrl, supabaseKey);
async function run() {
    const { data: logs } = await supabase.from('ecoflix_sms_logs').select('*').order('created_at', { ascending: false }).limit(5);
    console.log(logs);
}
run();
