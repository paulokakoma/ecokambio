const axios = require('axios');
require('dotenv').config();

const BASE_URL = process.env.APPYPAY_BASE_URL;
const TOKEN = process.env.APPYPAY_MERCHANT_TOKEN;

async function probeEndpoints() {
    console.log(`Probing AppyPay Mock at: ${BASE_URL}`);

    const payload = {
        amount: 6500,
        phone: '923123123',
        description: 'EcoFlix ULTRA',
        method: 'REFERENCE'
    };

    const endpoints = [
        '/payment',
        '/payments',
        '/v1/payment',
        '/v1/payments',
        '/transaction',
        '/transactions',
        '/checkout'
    ];

    for (const ep of endpoints) {
        try {
            console.log(`\nTrying: ${ep}`);
            const response = await axios.post(`${BASE_URL}${ep}`, payload, {
                headers: {
                    'Authorization': `Bearer ${TOKEN}`,
                    'Content-Type': 'application/json'
                }
            });
            console.log(`✅ Success at ${ep}:`, response.status);
            return; // Found it
        } catch (error) {
            console.log(`❌ Failed at ${ep}: ${error.response ? error.response.status : error.message}`);
            if (error.response && error.response.status !== 404 && error.response.status !== 422) {
                // If it's not a 404/422, maybe it's the right endpoint but wrong payload?
                // 422 = Unprocessable Entity (often validation but here specifically "Route not resolved" according to previous log)
                // Stoplight returns 404 for route not found sometimes, or 422 if project exists but route doesn't match?
                // Previous error was 422 "Route not resolved".
            }
        }
    }
}

probeEndpoints();
