require('dotenv').config();
const smsService = require('../src/netflix/services/sms.service');
const axios = require('axios');

const TEST_PHONE = '923000000';
// Temporarily force Mimo for this test
const MIMO_HOST = process.env.MIMO_API_HOST || 'http://52.30.114.86:8080';
const MIMO_BASE = process.env.MIMO_API_BASE || '/mimosms/v1';
const MIMO_TOKEN = process.env.MIMO_API_TOKEN;

const testSender = async (senderId) => {
    console.log(`\n--- Testing SenderID: ${senderId} ---`);
    const url = `${MIMO_HOST}${MIMO_BASE}/message/send?token=${MIMO_TOKEN}`;
    const payload = {
        sender: senderId,
        recipients: TEST_PHONE,
        text: 'EcoFlix Teste'
    };
    try {
        const res = await axios.post(url, payload, { headers: { 'Content-Type': 'application/json' } });
        console.log('Success:', res.data);
        return true;
    } catch (error) {
        console.error('Failed:', error.response ? error.response.data : error.message);
        return false;
    }
}

(async () => {
    await testSender('ECOFLIX');
    await testSender('Mimo');
    await testSender('INFO');
})();
