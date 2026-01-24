/**
 * Referencia Provider (Placeholder)
 * Implementation for Payment by Reference (Direct/Proxy)
 */
const BasePaymentProvider = require('./base.provider');

class ReferenciaProvider extends BasePaymentProvider {
    async initiatePayment(order) {
        // Only Generate Reference
        console.log('Generating Reference for:', order.id);

        return {
            success: true,
            reference: Math.floor(100000000 + Math.random() * 900000000).toString(),
            entity: '00001', // Example Entity
            transaction_id: `ref_${Date.now()}`
        };
    }
}

module.exports = ReferenciaProvider;
