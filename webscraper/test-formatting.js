
const assert = require('assert');

// Helper function to be tested (will be moved to cron-scraping.js later)
function parseRate(rateStr, bankLabel) {
    if (!rateStr) return null;

    // Clean up whitespace
    let cleanStr = rateStr.trim();

    try {
        if (bankLabel === 'BAI') {
            // BAI: "1.115,04560" -> 1115.04560 (European: dot thousands, comma decimal)
            // Remove dots, replace comma with dot
            cleanStr = cleanStr.replace(/\./g, '').replace(',', '.');
        } else if (bankLabel === 'BFA') {
            // BFA: "957.122" -> 957.122 (US-like: dot decimal)
            // Just ensure it's a valid float
            // No special replacement needed if it's already in dot format
        } else if (bankLabel === 'BNA') {
            // BNA: "911,545" or "1.055,843" (European: dot thousands, comma decimal)
            cleanStr = cleanStr.replace(/\./g, '').replace(',', '.');
        } else if (bankLabel === 'BIC') {
            // BIC: "911.5450" -> 911.5450 (US-like: dot decimal)
            // No special replacement needed
        } else if (bankLabel === 'BCI') {
            // BCI: Assume European if comma is present, otherwise US
            if (cleanStr.includes(',') && !cleanStr.includes('.')) {
                cleanStr = cleanStr.replace(',', '.');
            } else if (cleanStr.includes('.') && cleanStr.includes(',')) {
                // Mixed, assume dot thousands, comma decimal like BAI
                cleanStr = cleanStr.replace(/\./g, '').replace(',', '.');
            }
        } else if (bankLabel === 'YETU') {
            // YETU: "890,00" -> 890.00
            cleanStr = cleanStr.replace(',', '.');
        }

        const rate = parseFloat(cleanStr);
        return isNaN(rate) ? null : rate;
    } catch (e) {
        return null;
    }
}

// Test Cases
const tests = [
    { bank: 'BAI', input: '962,65750', expected: 962.6575 },
    { bank: 'BAI', input: '1.115,04560', expected: 1115.0456 },
    { bank: 'BFA', input: '957.122', expected: 957.122 },
    { bank: 'BFA', input: '1129.752', expected: 1129.752 },
    { bank: 'BNA', input: '911,545', expected: 911.545 },
    { bank: 'BNA', input: '1.055,843', expected: 1055.843 }, // Assuming BNA might use dot for thousands if > 1000
    { bank: 'BIC', input: '911.5450', expected: 911.545 },
    { bank: 'BIC', input: '1055.8430', expected: 1055.843 },
    { bank: 'BIC', input: '938.8910', expected: 938.891 }, // User case: 9 388 910 -> 938.8910
    { bank: 'BFA', input: '957.122', expected: 957.122 }, // User case: 957 122 -> 957.122
    { bank: 'BCI', input: '940,36', expected: 940.36 }, // User case
    { bank: 'BCI', input: '1095,386', expected: 1095.386 }, // User case
    { bank: 'YETU', input: '935,00', expected: 935.00 },
];

console.log('Running tests...');
let passed = 0;
let failed = 0;

tests.forEach(t => {
    const result = parseRate(t.input, t.bank);
    if (Math.abs(result - t.expected) < 0.0001) {
        console.log(`✅ ${t.bank}: ${t.input} -> ${result}`);
        passed++;
    } else {
        console.error(`❌ ${t.bank}: ${t.input} -> ${result} (Expected: ${t.expected})`);
        failed++;
    }
});

console.log(`\nPassed: ${passed}, Failed: ${failed}`);
if (failed > 0) process.exit(1);
