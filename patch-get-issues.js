const fs = require('fs');
const file = '/Users/av/Documents/Projetos/ecokambio-main/ecoflix/backend/controllers/admin.controller.js';
let content = fs.readFileSync(file, 'utf8');

const regex = /\.select\(\`[\s\S]*?user:ecoflix_users\(phone\)[\s\S]*?\`\)/;
const replacement = `.select(\`
                *,
                subscription:ecoflix_subscriptions(
                    plan_type, expires_at,
                    user:ecoflix_users(phone),
                    profile:ecoflix_profiles(name, pin),
                    account:ecoflix_master_accounts(email)
                )
            \`)`;

content = content.replace(regex, replacement);
fs.writeFileSync(file, content);
console.log('patched backend');
