const supabase = require('./src/config/supabase');

async function run() {
  const { data, error } = await supabase.rpc('execute_sql', {
    sql_string: `
      CREATE TABLE IF NOT EXISTS ecoflix_settings (
        id VARCHAR(50) PRIMARY KEY,
        value JSONB NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      INSERT INTO ecoflix_settings (id, value) 
      VALUES ('plans', '{"ECONOMICO":4500,"ULTRA":6500,"FAMILIA":18000}'::jsonb)
      ON CONFLICT (id) DO NOTHING;
    `
  });
  if(error) {
    console.error('Error with RPC:', error);
  } else {
    console.log('Success!', data);
  }
}
run();
