const supabase = require('./src/config/supabase');
async function run() {
  const { data, error } = await supabase.from('ecoflix_users').select('phone');
  const counts = {};
  data.forEach(u => {
      counts[u.phone] = (counts[u.phone] || 0) + 1;
  });
  console.log(Object.keys(counts).filter(p => counts[p] > 1));
}
run();
