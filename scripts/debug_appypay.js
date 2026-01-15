const axios = require('axios');
require('dotenv').config();

const BASE_URL = process.env.APPYPAY_BASE_URL;
const TOKEN = process.env.APPYPAY_MERCHANT_TOKEN;

async function debugAppyPay() {
    console.log(`Testing AppyPay Mock at: ${BASE_URL}`);

    const payload = {
        amount: 6500,
        phone: '923123123',
        description: 'EcoFlix ULTRA',
        method: 'REFERENCE'
    };

    console.log('Sending Payload:', payload);

    try {
        const response = await axios.post(`${BASE_URL}/payment`, payload, {
            headers: {
                'Authorization': `Bearer ${TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('✅ Success:', response.data);
    } catch (error) {
        console.error('❌ Error Status:', error.response ? error.response.status : error.message);
        if (error.response) {
            console.error('❌ Error Data:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

debugAppyPay();
