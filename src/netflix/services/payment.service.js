/**
 * Payment Service
 * Handles core payment processing logic (Supabase RPC, SMS notifications, etc.)
 */

const supabase = require('../../config/supabase');
const { smsQueue } = require('./sms_queue.service');
const { familyPlanQueue } = require('./queue.service');
const smsService = require('./sms.service');

/**
 * Handle Out of Stock Logic
 * @param {Object} order
 */
const handleOutOfStock = async (order) => {
    // 1. Update order status
    await supabase.from('ecoflix_orders').update({ status: 'STOCK_OUT' }).eq('id', order.id);

    // 2. Notify Admin
    // await smsService.sendAdminAlert(`STOCK ESGOTADO! Pedido ${order.id} pago mas sem stock.`);

    return {
        success: true, // Return true so user sees "Paid" but with specific message
        message: 'Pagamento recebido, mas stock temporariamente esgotado. Sua conta será enviada em breve.',
        stockOut: true
    };
};

/**
 * Process a Payment (Atomic Allocation via RPC)
 * @param {Object} order
 */
const processPayment = async (order) => {
    try {
        // --- 0. RENEWAL LOGIC ---
        if (order.subscription_action === 'RENEWAL' && order.target_subscription_id) {
            const { data: result, error } = await supabase
                .rpc('extend_subscription', {
                    p_subscription_id: order.target_subscription_id,
                    p_days: 30
                });

            if (error) throw error;

            // Notify
            if (result.success) {
                await smsService.sendRenewalSms(order.phone, result.new_expires_at);
            }
            return result;
        }

        // --- 1. FAMILY PLAN LOGIC (Via Queue) ---
        if (order.plan_type === 'FAMILIA') {
            // await familyPlanQueue.add('assign-family', { orderId: order.id }); 
            // Commented out as queue might not be setup in this context yet
            return { success: true, message: 'Processamento em fila (Família) - Contacte Suporte' };
        }

        // --- 2. STANDARD PLAN LOGIC (RPC) ---
        // Call the atomic SQL function 'purchase_slot'
        const { data: result, error } = await supabase
            .rpc('purchase_slot', {
                p_user_id: order.user_id,
                p_plan_type: order.plan_type,
                p_coupon_code: order.coupon_used,
                p_amount: order.amount,
                p_order_id: order.id
            });

        if (error) throw error;

        // Verify Result
        if (!result.success) {
            console.warn(`[ProcessPayment] Purchase failed: ${result.message}`);
            // If Stock Out, handle it
            if (result.message === 'STOCK_ESGOTADO') {
                return handleOutOfStock(order);
            }
            return result;
        }

        // 3. SUCCESS -> SEND SMS (VIA QUEUE)
        if (result.credentials) {
            const creds = result.credentials;
            await smsQueue.add('enviar-credencial', {
                phone: order.phone,
                credentials: creds
            }, {
                attempts: 3,
                backoff: { type: 'exponential', delay: 5000 }
            });
            console.log(`[ProcessPayment] Delivery SMS for ${order.phone} added to queue.`);
        }

        // 4. ADD PARTNER COMMISSION (Influencer Tracking)
        if (order.coupon_used) {
            try {
                // Try RPC first (preferred - atomic operation)
                const { data: commission, error: rpcError } = await supabase.rpc('add_partner_commission', {
                    p_coupon_code: order.coupon_used,
                    p_plan_type: order.plan_type
                });

                if (rpcError) {
                    // Fallback: Calculate and update manually
                    console.warn(`[ProcessPayment] RPC failed, using fallback:`, rpcError.message);

                    // Get coupon commission rates
                    const { data: coupon } = await supabase
                        .from('ecoflix_coupons')
                        .select('commission_mobile, commission_tv')
                        .eq('code', order.coupon_used)
                        .single();

                    if (coupon) {
                        const commissionAmount = order.plan_type === 'ECONOMICO'
                            ? (coupon.commission_mobile || 500)
                            : (coupon.commission_tv || 700);

                        // Update coupon with new commission
                        await supabase
                            .from('ecoflix_coupons')
                            .update({
                                usage_count: supabase.raw('COALESCE(usage_count, 0) + 1'),
                                total_commission_due: supabase.raw(`COALESCE(total_commission_due, 0) + ${commissionAmount}`)
                            })
                            .eq('code', order.coupon_used);

                        console.log(`[ProcessPayment] Partner commission added: ${commissionAmount} Kz`);
                    }
                } else {
                    console.log(`[ProcessPayment] Partner commission added via RPC: ${commission} Kz`);
                }
            } catch (couponErr) {
                console.warn(`[ProcessPayment] Failed to add partner commission:`, couponErr.message);
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
