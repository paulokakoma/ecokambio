/**
 * AppyPay Provider
 * Implementation for AppyPay Gateway
 */
const axios = require('axios');
const BasePaymentProvider = require('./base.provider');

class AppyPayProvider extends BasePaymentProvider {
    constructor() {
        super();
        this.baseUrl = process.env.APPYPAY_BASE_URL || 'https://stoplight.io/mocks/appypay/appypay-payment-gateway/44997391';
        this.token = process.env.APPYPAY_MERCHANT_TOKEN;
        this.entityId = process.env.APPYPAY_ENTITY_ID || '00024';
    }

    async initiatePayment(order) {
        try {
            const headers = {
                'Authorization': `Bearer ${this.token}`,
                'Content-Type': 'application/json'
            };

            const payload = {
                amount: order.amount,
                phone: order.phone,
                description: `EcoFlix ${order.plan_type}`,
                method: order.payment_method // REFERENCE, MCX_PUSH, etc.
            };

            const response = await axios.post(`${this.baseUrl}/payment`, payload, { headers });

            if (response.data && response.data.reference) {
                return {
                    success: true,
                    reference: response.data.reference.toString(),
                    entity: response.data.entity || this.entityId,
                    transaction_id: response.data.transaction_id || `txn_${Date.now()}`
                };
            } else {
                throw new Error('Resposta inválida da AppyPay');
            }

        } catch (error) {
            console.error('AppyPay Provider Error:', error.message);

            // Fallback for DEV
            if (process.env.NODE_ENV === 'development') {
                return {
                    success: true,
                    reference: Math.floor(100000000 + Math.random() * 900000000).toString(),
                    entity: '90000',
                    transaction_id: `dev_${Date.now()}`,
                    isMock: true
                };
            }
            throw new Error('Erro ao comunicar com AppyPay');
        }
    }
}

module.exports = AppyPayProvider;
