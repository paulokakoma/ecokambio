
const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

const sendTestSms = async () => {
    console.log('Testing Mimo SMS Integration...');

    if (!process.env.MIMO_SMS_TOKEN) {
        console.error('ERROR: MIMO_SMS_TOKEN not found in .env');
        return;
    }

    const token = process.env.MIMO_SMS_TOKEN;
    const sender = process.env.MIMO_SENDER_ID || 'Mimo';
    const url = `http://52.30.114.86:8080/mimosms/v1/message/send?token=${token}`;

    // Test Number (Using a dummy number or user provided if available, here using a clearly fake but valid format for test)
    // Actually, to verify it REALLY works, I should try to hit the API. 
    // Since I can't receive it, I will use a generic number (e.g., 900000000) just to see the API response structure.
    const recipient = '244923000000'; // Dummy number
    const message = 'Test from EcoFlix Agent';

    const payload = {
        // sender: sender, // Omit to test default
        recipients: recipient,
        text: message
    };

    try {
        console.log(`Sending to ${url}`);
        console.log('Payload:', JSON.stringify(payload, null, 2));

        const response = await axios.post(url, payload, { headers: { 'Content-Type': 'application/json' } });

        console.log('Response Status:', response.status);
        console.log('Response Data:', response.data);
        console.log('✅ SMS Request Sent Successfully!');
    } catch (error) {
        console.error('❌ SMS Request Failed:', error.message);
        if (error.response) {
            console.error('API Response:', error.response.data);
        }
    }
};

sendTestSms();
