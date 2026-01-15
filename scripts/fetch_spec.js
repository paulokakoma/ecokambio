const axios = require('axios');

const BASE_URL = 'https://stoplight.io/mocks/appypay/appypay-payment-gateway/44997391';

async function fetchSpec() {
    console.log('Fetching OpenAPI Spec...');
    const files = ['openapi.yaml', 'openapi.json', 'swagger.json', 'swagger.yaml'];

    for (const f of files) {
        try {
            console.log(`GET ${BASE_URL}/${f}`);
            const res = await axios.get(`${BASE_URL}/${f}`);
            console.log('✅ FOUND SPEC!');
            console.log(JSON.stringify(res.data).substring(0, 500)); // Show beginning
            // Inspect paths if possible
            return;
        } catch (e) {
            console.log(`❌ ${e.response?.status}`);
        }
    }
}

fetchSpec();
