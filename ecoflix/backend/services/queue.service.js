const supabase = require('../../../src/config/supabase');
const smsService = require('./sms.service');

const { redisConfig, redisUrl } = require('../../../src/config/redis');

let familyPlanQueue = null;
let queueConnection = null;
let startFamilyPlanWorker = null;

if (redisUrl) {
    const { Queue, Worker } = require('bullmq');
    const Redis = require('ioredis');

    const FAMILY_PLAN_QUEUE = 'family-plan-assignment';

    queueConnection = new Redis(redisUrl, { ...redisConfig, maxRetriesPerRequest: null });

    familyPlanQueue = new Queue(FAMILY_PLAN_QUEUE, {
        connection: queueConnection
    });

    startFamilyPlanWorker = () => {
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

            // --- ATOMIC FAMILY ASSIGNMENT LOGIC (RPC) ---
            const durationMonths = order.duration_months || 1;
            
            const { data: result, error: rpcError } = await supabase.rpc('assign_shared_account_atomic', {
                p_order_id: order.id,
                p_phone: order.phone,
                p_duration_months: durationMonths
            });

            if (rpcError) {
                console.error(`[Queue] Fatal RPC Error for order ${orderId}:`, rpcError.message);
                throw rpcError;
            }

            if (!result.success) {
                if (result.message === 'CONCURRENCY_LOCKED') {
                    // O BullMQ cuida do retry com exponential backoff se lançarmos erro
                    throw new Error('CONCURRENCY_LOCKED - Database locked, retrying via BullMQ');
                }
                
                console.warn(`[Queue] Out of stock for Family Plan (Order ${orderId}): ${result.message}`);
                await handleOutOfStock(order);
                return;
            }

            // O RPC atualizou os profiles, criou a subscrição e atualizou a order com sucesso.
            
            // 5. Enviar SMS
            await smsService.sendDeliverySms(order.phone, result.credentials);
            console.log(`[Queue] Order ${orderId} completed.`);

        } catch (error) {
            console.error(`[Queue] Error processing order ${orderId}:`, error);
            throw error;
        }

    }, {
        connection: queueConnection,
        concurrency: 1,
        limiter: {
            max: 1,
            duration: 1000
        }
    });
};
} else {
    console.log('[Queue] Redis not configured. Family Plan queue disabled.');
}

const handleOutOfStock = async (order) => {
    await supabase.from('ecoflix_orders').update({ status: 'STOCK_OUT' }).eq('id', order.id);
    const websocket = require('../../../src/websocket');
    websocket.broadcastToOrder(order.id, { type: 'payment_update', status: 'STOCK_OUT' });
};

module.exports = {
    familyPlanQueue,
    startFamilyPlanWorker
};
