const fs = require('fs');

// Patch payment.controller.js
let paymentFile = '/Users/av/Documents/Projetos/ecokambio-main/ecoflix/backend/controllers/payment.controller.js';
let paymentContent = fs.readFileSync(paymentFile, 'utf8');
paymentContent = paymentContent.replace(
    /status: 'FAILED', rejection_reason:/g,
    "status: 'CANCELLED', rejection_reason:"
);
fs.writeFileSync(paymentFile, paymentContent);

// Patch admin.controller.js
let adminFile = '/Users/av/Documents/Projetos/ecokambio-main/ecoflix/backend/controllers/admin.controller.js';
let adminContent = fs.readFileSync(adminFile, 'utf8');

// Fix CANCELED -> CANCELLED
adminContent = adminContent.replace(
    /status: 'CANCELED', updated_at: new Date\(\) \}\)/g,
    "status: 'CANCELLED', updated_at: new Date() })"
);

fs.writeFileSync(adminFile, adminContent);
console.log('Patched');
