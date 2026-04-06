const fs = require('fs');
const cheerio = require('cheerio');
const html = fs.readFileSync('bai.html', 'utf8');
const $ = cheerio.load(html);

// Try to find the word USD and print its parent tree
// Or find any tables or div lists that seem like exchange rates
const usdElements = $('*:contains("USD")').filter(function() { return $(this).children().length === 0; });

usdElements.each((i, el) => {
    let parent = $(el).parent();
    // print out HTML of some ancestor that seems like a card or a row
    console.log(`--- Match ${i + 1} ---`);
    console.log(parent.parent().parent().html().substring(0, 500));
});

// Let's also look for explicit table classes or lists
console.log('--- Tables ---');
$('table').each((i, el) => {
    console.log(`Table ${i} classes:`, $(el).attr('class'));
});

console.log('--- divs with rate/cambio in class ---');
$('div[class*="rate"], div[class*="cambio"], div[class*="exchange"]').slice(0, 5).each((i, el) => {
    console.log(`Div ${i} classes:`, $(el).attr('class'));
});
