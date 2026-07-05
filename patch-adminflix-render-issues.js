const fs = require('fs');
const file = '/Users/av/Documents/Projetos/ecokambio-main/ecoflix/backend/public/adminflix.html';
let content = fs.readFileSync(file, 'utf8');

const regex = /const name = i\.user\?\.name \|\| 'Cliente';[\s\S]*?const profileStr = i\.subscription\?\.profile\?\.name \|\| 'N\/A';/;
const replacement = `
                let phone = i.subscription?.user?.phone || 'S/N';
                let profileStr = i.subscription?.profile?.name || i.subscription?.account?.email || 'S/N';
                
                // Fallback for public issues
                if (phone === 'S/N' && i.description && i.description.includes('Suporte Público')) {
                    const match = i.description.match(/Tel:\\s*([0-9]+)\\]/);
                    if (match && match[1]) phone = match[1];
                    profileStr = 'Público';
                }
                
                const name = 'Cliente';
`;

content = content.replace(regex, replacement);
fs.writeFileSync(file, content);
console.log('patched frontend');
