const supabase = require('./src/config/supabase');
async function run() {
  const { data } = await supabase.from('ecoflix_profiles').select('id, status, client_phone').in('id', ['244d0fda-88be-462a-85c7-50451c2b3e23', '24281a38-0ce1-47d2-af15-fb0307ddcffb']);
  console.log("Profiles:", JSON.stringify(data, null, 2));
}
run();
