const supabase = require('./src/config/supabase');
async function run() {
    const { data, error } = await supabase.rpc('execute_sql', { 
        sql_string: 'ALTER TABLE ecoflix_orders ADD COLUMN IF NOT EXISTS duration_months INTEGER DEFAULT 1;' 
    });
    console.log("RPC Error:", error);
}
run();
