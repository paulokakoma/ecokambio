const { Queue, Worker } = require('bullmq');
const { redisConfig } = require('../../config/redis');
const supabase = require('../../config/supabase');
const smsService = require('./sms.service');

// Define Queue Name
const FAMILY_PLAN_QUEUE = 'family-plan-assignment';

// Create Queue
const familyPlanQueue = new Queue(FAMILY_PLAN_QUEUE, {
    connection: redisConfig
});

// Worker Factory
const startFamilyPlanWorker = () => {
    return new Worker(FAMILY_PLAN_QUEUE, async (job) => {
        const { orderId } = job.data;
        console.log(`[Queue] Processing Family Plan Order: ${orderId}`);

        try {
            // Fetch Order
            const { data: order, error: orderError } = await supabase
                .from('ecoflix_orders')
                .select('*')
                .eq('id', orderId)
                .single();

            if (orderError || !order) {
                throw new Error('Order not found');
            }

            if (order.status !== 'PENDING') {
                console.log(`[Queue] Order ${orderId} already processed.`);
                return;
            }

            // --- ATOMIC FAMILY ASSIGNMENT LOGIC ---
            const { data: accounts, error: accError } = await supabase
                .from('ecoflix_master_accounts')
                .select('*, profiles:ecoflix_profiles(*)')
                .eq('status', 'ACTIVE')
                .eq('type', 'SHARED');

            if (accError) throw accError;

            const candidate = accounts.find(acc =>
                acc.profiles &&
                acc.profiles.length > 0 &&
                acc.profiles.every(p => p.status === 'AVAILABLE')
            );

            if (!candidate) {
                console.warn(`[Queue] Out of stock for Family Plan (Order ${orderId})`);
                await handleOutOfStock(order);
                return;
            }

            // 2. Assign User to Profiles
            const mainProfile = candidate.profiles[0];

            const { error: updateError } = await supabase
                .from('ecoflix_profiles')
                .update({
                    status: 'SOLD',
                    client_name: 'FAMILIA_' + order.phone,
                    client_phone: order.phone,
                    updated_at: new Date()
                })
                .eq('master_account_id', candidate.id)
                .eq('status', 'AVAILABLE');

            if (updateError) throw updateError;

            // 3. Create Subscription
            await supabase
                .from('ecoflix_subscriptions')
                .insert({
                    user_id: order.user_id,
                    profile_id: mainProfile.id,
                    order_id: order.id,
                    status: 'ACTIVE',
                    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                });

            // 4. Update Order
            await supabase
                .from('ecoflix_orders')
                .update({ status: 'PAID', updated_at: new Date() })
                .eq('id', order.id);

            // 5. Send SMS
            const creds = {
                email: candidate.email,
                password: candidate.password,
                profile: 'Conta Completa',
                pin: 'Todos'
            };
            await smsService.sendDeliverySms(order.phone, creds);
            console.log(`[Queue] Order ${orderId} completed.`);

        } catch (error) {
            console.error(`[Queue] Error processing order ${orderId}:`, error);
            throw error;
        }

    }, {
        connection: redisConfig,
        concurrency: 1,
        limiter: {
            max: 1,
            duration: 1000
        }
    });
};

const handleOutOfStock = async (order) => {
    await smsService.sendSms(order.phone, 'EcoFlix: Pagamento recebido. Conta Família em preparação. Enviaremos em breve.');
    await supabase.from('ecoflix_orders').update({ status: 'PAID' }).eq('id', order.id);
};

module.exports = {
    familyPlanQueue,
    startFamilyPlanWorker
};
