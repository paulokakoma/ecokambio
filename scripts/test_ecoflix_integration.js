const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api/ecoflix';
const PHONE = '+244927862935'; // Verified for Twilio Trial

async function runTest() {
    try {
        console.log('--- 1. Send OTP ---');
        await axios.post(`${BASE_URL}/auth/send-otp`, { phone: PHONE });
        console.log('✅ OTP Sent (Log should show code if in dev mode)');

        // We need the code. In dev/test, we can't see the SMS.
        // But the controller returns `devCode` if NODE_ENV is development.
        // Let's rely on that or query DB.
        // Since we can't query DB easily here without setup, let's hope the API returns it or we can brute force (no).
        // Actually, I can use the same script to query Supabase directly to get the code.

        const supabase = require('../src/config/supabase');
        const { data: otpRecord } = await supabase
            .from('ecoflix_otp_codes')
            .select('code')
            .eq('phone', PHONE)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (!otpRecord) throw new Error('OTP not saved in DB');
        const code = otpRecord.code;
        console.log(`ℹ️  OTP fetched from DB: ${code}`);

        console.log('\n--- 2. Verify OTP ---');
        const verifyRes = await axios.post(`${BASE_URL}/auth/verify-otp`, { phone: PHONE, code: code });
        console.log('✅ OTP Verified:', verifyRes.data.success);

        console.log('\n--- 3. Create Order ---');
        // Need to ensure payment method enum is correct
        const orderRes = await axios.post(`${BASE_URL}/orders/create`, {
            phone: PHONE,
            plan_type: 'ECONOMICO',
            payment_method: 'REFERENCE'
        });
        console.log('✅ Order Created:', orderRes.data.success);
        const refId = orderRes.data.data.reference;
        const amount = orderRes.data.data.amount;
        console.log(`ℹ️  Reference: ${refId}, Amount: ${amount}`);

        console.log('\n--- 4. Simulate Payment Webhook ---');
        const webhookRes = await axios.post(`${BASE_URL}/test/simulate-webhook`, {
            reference_id: refId,
            amount: amount
        });
        console.log('✅ Webhook Triggered:', webhookRes.data.success);

        console.log('\n--- 5. Check Status ---');
        const statusRes = await axios.get(`${BASE_URL}/orders/${refId}/status`);
        console.log('✅ Status:', statusRes.data.status);
        if (statusRes.data.credentials) {
            console.log('🎉 Credentials Received:', statusRes.data.credentials);
        } else {
            console.warn('⚠️  No credentials returned (Stock might be empty)');
        }

    } catch (error) {
        console.error('❌ Test Failed:', error.response ? error.response.data : error.message);
        process.exit(1);
    }
}

// Check if server is running
axios.get('http://localhost:3000/api/scraper/health')
    .then(() => runTest())
    .catch(() => {
        console.log('Server not running. Starting it...');
        const { spawn } = require('child_process');
        const server = spawn('node', ['server.js'], { stdio: 'inherit' });
        // Give it time to start
        setTimeout(runTest, 5000);
    });
