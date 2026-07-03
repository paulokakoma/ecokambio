const axios = require('axios');
const BasePaymentProvider = require('./base.provider');

const PAYGO_BASE_URL = 'https://rouxavcvorjiwhpjhsye.supabase.co/functions/v1/api-v1';

class PayGoProvider extends BasePaymentProvider {
    constructor(paymentMethod) {
        super();
        this.apiKey = process.env.PAYGOOO_API_KEY;
        this.webhookSecret = process.env.PAYGOOO_WEBHOOK_SECRET;
        this.paymentMethod = paymentMethod; // 'express' | 'referencia'
    }

    async initiatePayment(order) {
        if (!this.apiKey) {
            throw new Error('PayGo: API key não configurada (PAYGOOO_API_KEY)');
        }

        const headers = {
            'x-api-key': this.apiKey,
            'Content-Type': 'application/json'
        };

        const apiMethod = this.paymentMethod === 'express' ? 'multicaixa' : 'reference';
        const productIds = {
            'ECONOMICO': 'd13a142b-9d1f-4788-b227-a41235d04e85',
            'ULTRA': '2d8240df-e851-4b10-aeaf-8054145a4de4',
            'FAMILIA': 'f88a0f69-03ba-432e-b6b7-ed30f96fc7e2'
        };
        const cleanPhone = (order.phone || '').replace(/[^0-9]/g, '').replace(/^244/, '');
        const payload = {
            payment_method: apiMethod,
            product_id: order.paygo_id || productIds[order.plan_type] || productIds['ULTRA'],
            amount: order.amount,
            customer_name: 'Cliente EcoFlix',
            customer_email: `cliente${Date.now()}@ecoflix.ao`,
            customer_phone: cleanPhone
        };

        console.log(`[PayGo] POST /payments method=${apiMethod} product=${payload.product_id} amount=${payload.amount} phone=${cleanPhone}`);

        const response = await axios.post(`${PAYGO_BASE_URL}/payments`, payload, { headers });

        if (response.data?.payment_id) {
            const d = response.data;
            const refObj = d.reference || {};
            console.log(`[PayGo] Success payment_id=${d.payment_id} ref=${refObj.reference_number} entity=${refObj.entity}`);
            return {
                success: true,
                reference: refObj.reference_number || null,
                entity: refObj.entity || null,
                transaction_id: d.payment_id,
                payment_id: d.payment_id,
                message: this.paymentMethod === 'express'
                    ? 'Pagamento Multicaixa Express iniciado'
                    : 'Referência gerada com sucesso'
            };
        }

        console.error('[PayGo] Resposta sem payment_id:', JSON.stringify(response.data));
        throw new Error('PayGo: resposta inválida — sem payment_id');
    }

    async checkStatus(paymentId) {
        if (!this.apiKey) {
            return { status: 'PENDING' };
        }

        try {
            const headers = { 'x-api-key': this.apiKey };
            const response = await axios.get(`${PAYGO_BASE_URL}/payment-status/${paymentId}`, { headers });

            const status = response.data?.status || 'unknown';
            const normalizedStatus = status.toLowerCase();

            return {
                status: (normalizedStatus === 'completed' || normalizedStatus === 'paid' || normalizedStatus === 'success') ? 'PAID'
                    : (normalizedStatus === 'failed' || normalizedStatus === 'cancelled') ? 'FAILED'
                    : 'PENDING',
                raw: response.data
            };
        } catch (error) {
            console.error('PayGo Status Check Error:', error.message);
            return { status: 'PENDING' };
        }
    }

}

module.exports = PayGoProvider;
