const supabase = require('./src/config/supabase');
async function run() {
    const cleanPhone = '927862935';
    const { data: manualProfiles } = await supabase
            .from('ecoflix_profiles')
            .select(`id, name`)
            .or(`client_phone.eq.${cleanPhone},client_phone.eq.+244${cleanPhone},client_phone.eq.244${cleanPhone}`);
    console.log("MANUAL ALL: ", manualProfiles);
}
run();
