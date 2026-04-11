const input = "2 223 443 434 343 434,50";
const rawValue = input.replace(/\D/g, '');
const amount = parseFloat(rawValue) / 100;
console.log(`Input: ${input}`);
console.log(`Raw: ${rawValue}`);
console.log(`Amount: ${amount}`);

const rate = 828.31; // Exemplo de taxa USD/AOA
const result = amount * rate;
console.log(`Rate: ${rate}`);
console.log(`Result: ${result}`);
