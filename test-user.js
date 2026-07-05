const supabase = require('./src/config/supabase');
async function run() {
  const phone = '922000000';
  const { data: newUser, error } = await supabase
    .from('ecoflix_users')
    .insert({ phone, verified_at: new Date() })
    .select('id, phone')
    .single();
  console.log('newUser:', newUser);
  console.log('error:', error);
}
run();
