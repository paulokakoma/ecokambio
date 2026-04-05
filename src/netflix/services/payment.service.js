/**
 * Serviço de Pagamentos (Payment Service)
 * Lida com toda a lógica central de processamento de aquisições (Mecanismos atómicos via Supabase RPC, notificações SMS, etc.)
 */

const supabase = require('../../config/supabase');
const { smsQueue } = require('./sms_queue.service');
const { familyPlanQueue } = require('./queue.service');
const smsService = require('./sms.service');

/**
 * Lidar com cenários de rutura de stock (Esgotado)
 * @param {Object} order Os dados do pedido (encomenda)
 */
const handleOutOfStock = async (order) => {
    // 1. Atualizar o estado do pedido para indicar falta de stock
    await supabase.from('ecoflix_orders').update({ status: 'STOCK_OUT' }).eq('id', order.id);

    // 2. Notificar Administração
    // await smsService.sendAdminAlert(`STOCK ESGOTADO! Pedido ${order.id} pago mas sem stock.`);

    return {
        success: true, // Retornamos true para o utilizador ver a mensagem de "Pago", mas com um aviso especial
        message: 'Pagamento recebido, mas stock temporariamente esgotado. Sua conta será enviada em breve.',
        stockOut: true
    };
};

/**
 * Processar um pagamento (Alocação de conta atómica por RPC)
 * @param {Object} order Os dados do pagamento processado
 */
const processPayment = async (order) => {
    try {
        // --- 0. LÓGICA DE RENOVAÇÃO (RENEWAL) ---
        if (order.subscription_action === 'RENEWAL' && order.target_subscription_id) {
            const { data: result, error } = await supabase
                .rpc('extend_subscription', {
                    p_subscription_id: order.target_subscription_id,
                    p_days: 30
                });

            if (error) throw error;

            // Enviar SMS de notificação após sucesso de renovação
            if (result.success) {
                await smsService.sendRenewalSms(order.phone, result.new_expires_at);
            }
            return result;
        }

        // --- 1. LÓGICA DO PLANO FAMÍLIA (Processado via Fila/Queue) ---
        if (order.plan_type === 'FAMILIA') {
            // await familyPlanQueue.add('assign-family', { orderId: order.id }); 
            // Comentado localmente: a fila poderá não estar instanciada dependendo do contexto
            return { success: true, message: 'Processamento em fila (Família) - Contacte Suporte' };
        }

        // --- 2. LÓGICA DE PLANO NORMAL/PADRÃO (Via RPC Atómico) ---
        // Chama uma função residente do SQL de nome 'purchase_slot' (para garantir segurança concorrencial)
        const { data: result, error } = await supabase
            .rpc('purchase_slot', {
                p_user_id: order.user_id,
                p_plan_type: order.plan_type,
                p_coupon_code: order.coupon_used,
                p_amount: order.amount,
                p_order_id: order.id
            });

        if (error) throw error;

        // Verificar Resposta do Backend
        if (!result.success) {
            console.warn(`[ProcessPayment] Falha na compra: ${result.message}`);
            // Se o motivo for falta de stock, encaminhar para essa verificação apropriada
            if (result.message === 'STOCK_ESGOTADO') {
                return handleOutOfStock(order);
            }
            return result;
        }

        // 3. SE SUCESSO -> ADICIONAR SMS À FILA (VIA QUEUE)
        if (result.credentials) {
            const creds = result.credentials;
            await smsQueue.add('enviar-credencial', {
                phone: order.phone,
                credentials: creds
            }, {
                attempts: 3,
                backoff: { type: 'exponential', delay: 5000 }
            });
            console.log(`[ProcessPayment] Envio de SMS da credencial para ${order.phone} adicionado à fila.`);
        }

        // 4. ATRIBUIR COMISSÃO A PARCEIRO/INFLUENCER (Se tiver código promocional)
        if (order.coupon_used) {
            try {
                // Primeira tentativa: Usar diretamente o RPC para aplicar comissão atomicamente
                const { data: commission, error: rpcError } = await supabase.rpc('add_partner_commission', {
                    p_coupon_code: order.coupon_used,
                    p_plan_type: order.plan_type
                });

                if (rpcError) {
                    // Plano de fallback manual: Se a store procedure falhar, atualizar aqui o valor
                    console.warn(`[ProcessPayment] Função RPC falhou para comissão. Utilizando o recuo manual:`, rpcError.message);

                    // Obter as atuais taxas de comissão do cupão
                    const { data: coupon } = await supabase
                        .from('ecoflix_coupons')
                        .select('commission_mobile, commission_tv')
                        .eq('code', order.coupon_used)
                        .single();

                    if (coupon) {
                        const commissionAmount = order.plan_type === 'ECONOMICO'
                            ? (coupon.commission_mobile || 500)
                            : (coupon.commission_tv || 700);

                        // Guardar a atualização com a nova contagem de comissão e referências
                        await supabase
                            .from('ecoflix_coupons')
                            .update({
                                usage_count: supabase.raw('COALESCE(usage_count, 0) + 1'),
                                total_commission_due: supabase.raw(`COALESCE(total_commission_due, 0) + ${commissionAmount}`)
                            })
                            .eq('code', order.coupon_used);

                        console.log(`[ProcessPayment] Comissão de parceiro atribuída manualmente: ${commissionAmount} Kz`);
                    }
                } else {
                    console.log(`[ProcessPayment] Comissão de parceiro atribuída via RPC: ${commission} Kz`);
                }
            } catch (couponErr) {
                console.warn(`[ProcessPayment] Falha fatal silenciosa ao adicionar a comissão de parceiro:`, couponErr.message);
            }
        }

        return result;

    } catch (error) {
        console.error('Process payment error:', error);
        return { success: false, message: error.message };
    }
};

module.exports = {
    processPayment,
    handleOutOfStock
};
