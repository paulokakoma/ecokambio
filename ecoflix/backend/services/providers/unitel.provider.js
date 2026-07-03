/**
 * Unitel Money Provider (Placeholder)
 */
const BasePaymentProvider = require('./base.provider');

class UnitelMoneyProvider extends BasePaymentProvider {
    async initiatePayment(order) {
        // USSD Push / API logic
        console.log('Initiating Unitel Money Push for:', order.phone);

        return {
            success: true,
            reference: null, // Push doesn't always have reference immediately visible to user
            transaction_id: `unitel_${Date.now()}`,
            message: 'Aviso enviado para o telemóvel.'
        };
    }
}

module.exports = UnitelMoneyProvider;
