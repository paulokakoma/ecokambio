/**
 * Express Provider (Placeholder)
 * Implementation for Express Payment Gateway
 */
const BasePaymentProvider = require('./base.provider');

class ExpressProvider extends BasePaymentProvider {
    async initiatePayment(order) {
        // Implement Express API logic here
        console.log('Initiating Express Payment for:', order.id);

        // Mock Implementation for now
        return {
            success: true,
            reference: 'EXP-' + Math.floor(100000 + Math.random() * 900000),
            entity: 'EXPRESS',
            transaction_id: `exp_${Date.now()}`
        };
    }
}

module.exports = ExpressProvider;
