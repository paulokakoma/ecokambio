const axios = require('axios');

const PAYGO_BASE_URL = 'https://rouxavcvorjiwhpjhsye.supabase.co/functions/v1/api-v1';

// IDs de produtos fixos no PayGo por plano
const PRODUCT_IDS = {
    'ECONOMICO': 'd13a142b-9d1f-4788-b227-a41235d04e85',
    'ULTRA':     '2d8240df-e851-4b10-aeaf-8054145a4de4',
    'FAMILIA':   'f88a0f69-03ba-432e-b6b7-ed30f96fc7e2',
    'COMPLETA':  'f88a0f69-03ba-432e-b6b7-ed30f96fc7e2',
    'INTEIRA':   'f88a0f69-03ba-432e-b6b7-ed30f96fc7e2',
};

const API_METHOD = {
    express:    'multicaixa',
    referencia: 'reference',
};

class PayGoProvider {
    constructor(paymentMethod) {
        this.apiKey          = process.env.PAYGOOO_API_KEY;
        this.webhookSecret   = process.env.PAYGOOO_WEBHOOK_SECRET;
        this.paymentMethod   = paymentMethod; // 'express' | 'referencia'
    }

    get headers() {
        return { 'x-api-key': this.apiKey, 'Content-Type': 'application/json' };
    }

    async initiatePayment(order) {
        if (!this.apiKey) {
            throw new Error('PayGo: API key não configurada (PAYGOOO_API_KEY)');
        }

        const apiMethod  = API_METHOD[this.paymentMethod] || 'reference';
        const cleanPhone = (order.phone || '').replace(/[^0-9]/g, '').replace(/^244/, '');

        const payload = {
            payment_method: apiMethod,
            product_id:     order.paygo_id || PRODUCT_IDS[order.plan_type] || PRODUCT_IDS['ULTRA'],
            amount:         order.amount,
            customer_name:  'Cliente EcoFlix',
            customer_email: `cliente${Date.now()}@ecoflix.ao`,
            customer_phone: cleanPhone,
        };

        console.log(`[PayGo] POST /payments method=${apiMethod} product=${payload.product_id} amount=${payload.amount} phone=${cleanPhone}`);

        try {
            const { data } = await axios.post(`${PAYGO_BASE_URL}/payments`, payload, { headers: this.headers });

            if (!data?.payment_id) {
                console.error('[PayGo] Resposta sem payment_id:', JSON.stringify(data));
                throw new Error('PayGo: resposta inválida — sem payment_id');
            }

            const refObj = data.reference || {};
            console.log(`[PayGo] Success payment_id=${data.payment_id} ref=${refObj.reference_number} entity=${refObj.entity}`);

            return {
                success:        true,
                reference:      refObj.reference_number || null,
                entity:         refObj.entity || null,
                transaction_id: data.payment_id,
                payment_id:     data.payment_id,
                message:        this.paymentMethod === 'express'
                    ? 'Pagamento Multicaixa Express iniciado'
                    : 'Referência gerada com sucesso',
            };
        } catch (error) {
            const apiMsg = error.response?.data?.error || error.response?.data?.message;
            if (apiMsg) {
                console.warn(`[PayGo] API Error: ${apiMsg}`);
                // Translate common English error messages to Portuguese
                const translations = {
                    'The payment was refused. Please try again later.': 'Pagamento recusado. Por favor, tente novamente mais tarde.',
                    'Payment failed': 'Pagamento falhou',
                    'Invalid phone number': 'Número de telefone inválido',
                    'Insufficient funds': 'Saldo insuficiente',
                    'Transaction declined': 'Transação recusada',
                };
                const translatedMsg = translations[apiMsg] || apiMsg;
                throw new Error(translatedMsg);
            }
            throw error;
        }
    }

    async checkStatus(paymentId) {
        if (!this.apiKey) return { status: 'PENDING' };

        try {
            const { data } = await axios.get(`${PAYGO_BASE_URL}/payment-status/${paymentId}`, { headers: this.headers });
            const raw    = (data?.payment?.status || data?.status || '').toLowerCase();
            const PAID   = ['completed', 'paid', 'success'];
            const FAILED = ['failed', 'cancelled'];

            return {
                status: PAID.includes(raw) ? 'PAID' : FAILED.includes(raw) ? 'FAILED' : 'PENDING',
                raw:    data,
            };
        } catch (error) {
            console.error('[PayGo] Status Check Error:', error.message);
            return { status: 'PENDING' };
        }
    }
}

module.exports = PayGoProvider;
