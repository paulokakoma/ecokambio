const supabase = require('./src/config/supabase');
async function test() {
  const { data, error } = await supabase.from('products').select('*');
  console.log("Products: ", data.length, data.map(d => ({id: d.id, name: d.name})));
}
test();
