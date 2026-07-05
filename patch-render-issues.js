const fs = require('fs');
const file = '/Users/av/Documents/Projetos/ecokambio-main/ecoflix/backend/public/adminflix.html';
let content = fs.readFileSync(file, 'utf8');

const regex = /<td class="px-6 py-4 text-xs font-medium text-gray-800">\$\{i\.issue_type\}<\/td>/;
const replacement = `<td class="px-6 py-4 max-w-xs">
                        <div class="text-xs font-bold text-gray-800">${'${i.issue_type}'}</div>
                        <div class="text-xs text-gray-500 mt-1 whitespace-pre-wrap">${'${i.description || \'\'}'}</div>
                    </td>`;

content = content.replace(regex, replacement);
fs.writeFileSync(file, content);
console.log('patched');
