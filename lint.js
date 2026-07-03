const fs = require('fs');
const acorn = require('acorn');
const html = fs.readFileSync('src/netflix/public/adminflix.html', 'utf8');
const scriptRegex = /<script>([\s\S]*?)<\/script>/g;
let match;
while ((match = scriptRegex.exec(html)) !== null) {
  const code = match[1];
  try {
    acorn.parse(code, { ecmaVersion: 2022 });
  } catch (e) {
    console.error(`Syntax error at offset ${match.index}:`);
    console.error(e);
  }
}
