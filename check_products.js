const supabase = require('./src/config/supabase');

async function checkProductsTable() {
    const { data, error } = await supabase.from('products').select('*').limit(1);
    if (error) {
        console.error("Error querying products:", error.message);
    } else {
        console.log("Products table exists. Data:", data);
    }
}

checkProductsTable();
