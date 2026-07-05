const supabase = require('./src/config/supabase');
async function check() {
    const { data, error } = await supabase.from('ecoflix_issues').select('id').limit(1);
    console.log("Error:", error?.message || "Table exists");
}
check();
