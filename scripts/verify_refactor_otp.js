
const controller = require('../src/netflix/controller');
const dotenv = require('dotenv');
dotenv.config();

// Mock Request and Response
const req = {
    body: {
        phone: '923000000'
    }
};

const res = {
    status: (code) => {
        console.log(`[Response Status] ${code}`);
        return res;
    },
    json: (data) => {
        console.log(`[Response Data]`, JSON.stringify(data, null, 2));
        return res;
    }
};

const runTest = async () => {
    console.log('--- Testing OTP Flow with New SMS Service ---');

    try {
        await controller.sendOtp(req, res);
    } catch (error) {
        console.error('Test Failed:', error);
    }
};

runTest();
