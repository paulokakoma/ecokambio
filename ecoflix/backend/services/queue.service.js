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
        console.log(`[Queue] A processar Family Plan Order: ${orderId}`);

        try {
            // Fetch Order
            const { data: order, error: orderError } = await supabase
                .from('ecoflix_orders')
                .select('*')
                .eq('id', orderId)
                .single();

            if (orderError || !order) {
                throw new Error('Pedido não encontrado');
            }

            if (order.status !== 'PENDING') {
                console.log(`[Queue] Order ${orderId} já processado.`);
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
                console.error(`[Queue] Erro Fatal RPC para order ${orderId}:`, rpcError.message);
                throw rpcError;
            }

            if (!result.success) {
                if (result.message === 'CONCURRENCY_LOCKED') {
                    // O BullMQ cuida do retry com exponential backoff se lançarmos erro
                    throw new Error('CONCURRENCY_LOCKED - Base de dados bloqueada, a tentar novamente via BullMQ');
                }
                
                console.warn(`[Queue] Stock esgotado para Family Plan (Order ${orderId}): ${result.message}`);
                await handleOutOfStock(order);
                return;
            }

            // O RPC atualizou os profiles, criou a subscrição e atualizou a order com sucesso.
            
            // 5. Buscar credenciais completas da DB
            const durationMonthsQ = order.duration_months || 1;
            const expiresAtQ = new Date(Date.now() + durationMonthsQ * 30 * 24 * 60 * 60 * 1000).toISOString();

            let creds = null;
            try {
                const { data: sub } = await supabase
                    .from('ecoflix_subscriptions')
                    .select(`
                        profile:ecoflix_profiles!fk_subscriptions_profile(
                            name, pin,
                            master_account:ecoflix_master_accounts!ecoflix_profiles_master_account_id_fkey(email, password)
                        ),
                        account:ecoflix_master_accounts(email, password)
                    `)
                    .eq('order_id', orderId)
                    .single();

                if (sub) {
                    const master = sub.account || sub.profile?.master_account;
                    if (master) {
                        creds = {
                            email: master.email,
                            password: master.password,
                            profile: sub.profile?.name || null,
                            pin: sub.profile?.pin || null
                        };
                    }
                }
            } catch (e) {
                console.error(`[Queue] Erro ao buscar credenciais: ${e.message}`);
            }

            if (!creds) creds = result.credentials || {};
            creds.plan_type = order.plan_type;
            creds.expires_at = expiresAtQ;

            // 6. Enviar SMS
            await smsService.sendDeliverySms(order.phone, creds);
            console.log(`[Queue] Order ${orderId} concluída.`);

        } catch (error) {
            console.error(`[Queue] Erro ao processar order ${orderId}:`, error);
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

    // Notificar o cliente por SMS que o stock está esgotado
    await smsService.sendStockOutSms(order.phone, order.plan_type).catch(err => {
        console.error(`[SMS] Falha ao enviar SMS de stock esgotado (queue): ${err.message}`);
    });
};

module.exports = {
    familyPlanQueue,
    startFamilyPlanWorker
};
