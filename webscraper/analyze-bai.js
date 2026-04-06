const fs = require('fs');

if (!fs.existsSync('bai.html')) {
    console.log("No bai.html");
    process.exit(1);
}

const html = fs.readFileSync('bai.html', 'utf8');

// Find occurrences of "USD" or "Dólar" in the file
function findContext(str, searchStr, contextLen = 200) {
    let index = str.indexOf(searchStr);
    let results = [];
    while (index !== -1 && results.length < 5) {
        let start = Math.max(0, index - contextLen);
        let end = Math.min(str.length, index + searchStr.length + contextLen);
        results.push(str.substring(start, end));
        index = str.indexOf(searchStr, index + 1);
    }
    return results;
}

console.log("Looking for USD...");
const usdMatches = findContext(html, 'USD', 200);
usdMatches.forEach((m, i) => console.log(`\nMatch ${i+1}:\n`, m));

console.log("\nLooking for Dolar...");
const dolarMatches = findContext(html, 'Dólar', 200);
dolarMatches.forEach((m, i) => console.log(`\nDolar Match ${i+1}:\n`, m));

console.log("\nLooking for 'cambio' in script tags...");
const scriptMatches = html.match(/<script.*?\/script>/g) || [];
scriptMatches.forEach((s) => {
    if (s.includes('cambio') || s.includes('rate') || s.includes('taxa')) {
        console.log("Found in script:", s.substring(0, 150));
    }
});

// Since the file is 1.8MB, it must have a lot of inline CSS/JS.
// Let's strip tags and see what's left.
const stripped = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
console.log("\nStrpped text excerpt:", stripped.substring(0, 500));
