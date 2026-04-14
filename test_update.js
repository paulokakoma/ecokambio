const { supabase } = require('./src/services/supabase');
async function test() {
  const { data, error } = await supabase.from('products').select('id, name, slug').limit(1);
  if (error) console.log(error);
  else console.log(data);
}
test();
