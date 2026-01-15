require('dotenv').config();
const smsService = require('../src/netflix/services/sms.service');

const TEST_PHONE = '+244927862935'; // Verified Twilio Caller ID

(async () => {
    console.log('--- Testing OTP SMS ---');
    const otpRes = await smsService.sendOtpSms(TEST_PHONE, '1234');
    console.log('OTP Result:', otpRes);

    console.log('\n--- Testing Delivery SMS ---');
    const delRes = await smsService.sendDeliverySms(TEST_PHONE, {
        email: 'test@netflix.com',
        password: 'password123',
        profile: 'Test Profile',
        pin: '5566'
    });
    console.log('Delivery Result:', delRes);
})();
