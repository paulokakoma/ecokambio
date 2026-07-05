const supabase = require('./src/config/supabase');
async function run() {
    // try to fetch duration_months to see if it exists
    const { data, error } = await supabase.from('ecoflix_orders').select('duration_months').limit(1);
    if (error) console.log(error);
    else console.log("Success! Column exists");
}
run();
