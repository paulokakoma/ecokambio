require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

// Initialize Supabase with SERVICE KEY to bypass RLS/Auth for setup
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const BASE_URL = 'http://localhost:' + (process.env.PORT || 3000) + '/api/ecoflix';

async function runStrictTest() {
    try {
        console.log('🚀 Starting Strict Flow Test...');

        // 1. Setup User (Verified)
        const phone = '999111222';
        console.log(`\n1. Setting up Verified User (${phone})...`);

        let { data: user } = await supabase.from('ecoflix_users').select('*').eq('phone', phone).single();
        if (!user) {
            const { data: newUser } = await supabase.from('ecoflix_users').insert({ phone, verified_at: new Date() }).select().single();
            user = newUser;
        } else if (!user.verified_at) {
            await supabase.from('ecoflix_users').update({ verified_at: new Date() }).eq('id', user.id);
        }
        console.log('User Ready:', user.id);

        // 2. Init Payment (REFERENCE)
        console.log('\n2. Initializing Payment (REFERENCE)...');
        try {
            const res = await axios.post(`${BASE_URL}/orders/create`, {
                phone: phone,
                plan_type: 'ECONOMICO',
                payment_method: 'REFERENCE'
            });
            console.log('Init Response:', res.data);

            if (!res.data.success) throw new Error('Init Payment Failed');

            const { reference, transaction_id, order_id } = res.data.data;
            console.log(`Order Created: ${order_id} | Ref: ${reference}`);

            // 3. Simulate Webhook
            console.log('\n3. Simulating Webhook...');

            // We use the test endpoint to trigger the real webhook logic
            const simRes = await axios.post(`${process.env.BASE_URL || 'http://localhost:3000'}/api/ecoflix/test/simulate-webhook`, {
                reference_id: reference,
                amount: 4500
            });

            console.log('Simulation Response:', simRes.data);

            // 4. Verify Final State
            console.log('\n4. Verifying Order Status in DB...');
            const { data: finalOrder } = await supabase.from('ecoflix_orders').select('*').eq('id', order_id).single();
            console.log(`Final Status: ${finalOrder.status}`);
            console.log(`Payment Method: ${finalOrder.payment_method}`);

            if (finalOrder.status !== 'PAID') throw new Error('Order not PAID');
            if (finalOrder.payment_method !== 'REFERENCE') throw new Error('Wrong Payment Method');

            console.log('\n✅ STRICT FLOW TEST PASSED!');

        } catch (e) {
            console.error('API Call Failed:', e.response ? e.response.data : e.message);
            throw e;
        }

    } catch (error) {
        console.error('\n❌ TEST FAILED:', error.message);
        process.exit(1);
    }
}

runStrictTest();
