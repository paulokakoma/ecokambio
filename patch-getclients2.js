const fs = require('fs');
const file = '/Users/av/Documents/Projetos/ecokambio-main/ecoflix/backend/controllers/admin.controller.js';
let content = fs.readFileSync(file, 'utf8');

const oldStr = `profile:ecoflix_profiles(
                    *,
                    master_account:ecoflix_master_accounts(*)
                ),`;
const newStr = `profile:ecoflix_profiles!fk_subscriptions_profile(
                    *,
                    master_account:ecoflix_master_accounts!ecoflix_profiles_master_account_id_fkey(*)
                ),`;

if (content.includes(oldStr)) {
    content = content.replace(oldStr, newStr);
    fs.writeFileSync(file, content);
    console.log('Successfully patched getClients constraint names.');
} else {
    console.log('Could not find the string to replace.');
}
