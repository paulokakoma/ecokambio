const input = "294 839 360 963 063 000 000 000 000 000 000 000 000 000 000 000 000 000 000 000 000 000 000 000 000 000 000 000 000 000 000 000,00";
const rawValue = input.replace(/\D/g, '');
const amount = parseFloat(rawValue) / 100;
console.log(`Input: ${input}`);
console.log(`Raw: ${rawValue}`);
console.log(`Amount: ${amount}`);

const result = amount * 828.31;
console.log(`Result: ${result}`);
