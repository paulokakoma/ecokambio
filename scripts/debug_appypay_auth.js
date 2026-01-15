const axios = require('axios');
require('dotenv').config();

const BASE_URL = 'https://gwy-api-tst.appypay.co.ao/v2.0';
const TOKEN = 'mock_token_123'; // This will likely fail (401) but I want to see if it hits the server

async function testEndpoints() {
    // 3. Query Params?
    try {
        console.log(`\n--- Query Params ---`);
        const response = await axios.post(`${BASE_URL}/charges?amount=6500&phone=923123123`, {}, {
            headers: { 'Authorization': `Bearer ${TOKEN}` }
        });
        console.log(`✅ Success (Query): ${response.status}`);
        console.log(response.data);
    } catch (e) { console.log(`❌ Query Failed: ${e.response?.status} - ${getMsg(e)}`); }
}

function getMsg(error) {
    if (error.response && error.response.data && error.response.data.responseStatus) {
        return error.response.data.responseStatus.sourceDetails.message;
    }
    return error.message;
}

testEndpoints();
