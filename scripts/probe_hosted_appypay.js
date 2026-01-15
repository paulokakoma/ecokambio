const axios = require('axios');

const STOPLIGHT_BASE = 'https://stoplight.io/mocks/appypay/appypay-payment-gateway/44997391';
const TEST_ENV_BASE = 'https://gwy-api-tst.appypay.co.ao';

const paths = [
    '',
    '/v2.0',
    '/v2',
    '/api/v2.0',
    '/api/v2'
];

const endpoints = [
    '/payment', '/payments',
    '/charge', '/charges',
    '/reference', '/references',
    '/order', '/orders',
    '/invoice', '/invoices',
    '/transaction', '/transactions',
    '/pay', '/checkout',
    '/auth', '/token'
];

async function probe() {
    console.log('🔍 Probing AppyPay Endpoints...\n');

    // 1. Probe Stoplight
    console.log('--- Probing Stoplight Mock ---');
    for (const p of paths) {
        for (const e of endpoints) {
            const url = `${STOPLIGHT_BASE}${p}${e}`;
            try {
                process.stdout.write(`Trying ${url} ... `);
                await axios.post(url, { dummy: true });
                console.log('✅ 200 OK');
            } catch (err) {
                const status = err.response ? err.response.status : 'ERR';
                console.log(`❌ ${status}`);
                if (status !== 404 && status !== 422) {
                    console.log(`   >>> INTERESTING STATUS: ${status} at ${url}`);
                }
            }
        }
    }

    // 2. Probe Test Env
    console.log('\n--- Probing Test Environment ---');
    for (const p of paths) {
        for (const e of endpoints) {
            const url = `${TEST_ENV_BASE}${p}${e}`;
            try {
                process.stdout.write(`Trying ${url} ... `);
                await axios.post(url, { dummy: true });
                console.log('✅ 200 OK');
            } catch (err) {
                const status = err.response ? err.response.status : 'ERR';
                console.log(`❌ ${status}`);
                if (status === 401) {
                    console.log(`   >>> ✅ FOUND ENDPOINT (Auth required): ${url}`);
                }
            }
        }
    }
}

probe();
