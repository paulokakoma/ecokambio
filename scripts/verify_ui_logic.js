const axios = require('axios');
require('dotenv').config();

const BASE_URL = 'http://localhost:' + (process.env.PORT || 3000) + '/api/ecoflix';
const PHONE = '923123123';

async function testFullFlow() {
    console.log('🚀 Testing Full User Logic (OTP -> Verify -> Order)');

    try {
        // 1. Send OTP
        console.log('\n1. Sending OTP...');
        const sendRes = await axios.post(`${BASE_URL}/auth/send-otp`, { phone: PHONE });
        console.log('Send Result:', sendRes.data);

        // Extract DEV CODE
        const devCode = sendRes.data.devCode;
        if (!devCode) throw new Error('Dev code not returned. Ensure NODE_ENV is development.');
        console.log('Got Dev Code:', devCode);

        // 2. Verify OTP
        console.log('\n2. Verifying OTP...');
        const verifyRes = await axios.post(`${BASE_URL}/auth/verify-otp`, {
            phone: PHONE,
            code: devCode
        });
        console.log('Verify Result:', verifyRes.data);
        if (!verifyRes.data.success) throw new Error('Verification failed');

        // 3. Create Order (ULTRA)
        console.log('\n3. Creating Order (ULTRA)...');
        const orderRes = await axios.post(`${BASE_URL}/orders/create`, {
            phone: PHONE,
            plan_type: 'ULTRA', // Testing the value we set in UI
            payment_method: 'REFERENCE'
        });
        console.log('Order Result:', orderRes.data);

        if (!orderRes.data.success) throw new Error('Order creation failed');
        if (orderRes.data.data.amount !== 6500) throw new Error('Wrong amount for ULTRA');

        console.log('\n✅ Verified: OTP Flow + Order Creation (Ultra) works correctly.');

    } catch (error) {
        console.error('\n❌ Test Failed:', error.response ? error.response.data : error.message);
        process.exit(1);
    }
}

testFullFlow();
