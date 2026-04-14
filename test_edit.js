const supabase = require('./src/config/supabase');
async function test() {
  const id = '4885efe7-9e99-4f65-b9c3-b14b17991c62'; // existing product
  
  const productData = { 
    name: 'asdfa modificado',
    description: '',
    price: '20,00',
    old_price: '',
    slug: 'asdfa',
    category: 'Telemóveis',
    is_active: true
  };
  
  console.log("Updating to:", productData);
  const { data, error } = await supabase
        .from('products')
        .update(productData)
        .eq('id', id)
        .select()
        .single();
        
  console.log("Result:", data);
  console.log("Error:", error);
}
test();
