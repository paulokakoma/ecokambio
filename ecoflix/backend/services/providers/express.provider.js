const BasePaymentProvider = require('./base.provider');
const paygoService = require('../paygo.service');

class ExpressProvider extends BasePaymentProvider {
    async initiatePayment({ amount, phone, plan_type }) {
        console.log(`Initiating Express (PayGo) Payment for plan: ${plan_type}, amount: ${amount}, phone: ${phone}`);

        try {
            // 1. Create a product in PayGo
            const productName = `EcoFlix - Plano ${plan_type}`;
            const productId = await paygoService.createProduct(
                productName,
                amount,
                'https://ecokambio.com/ecoflix/obrigado', // Placeholder URL
                'Pagamento de subscrição EcoFlix'
            );

            // 2. Create the payment request (Express = 'multicaixa')
            const merchantTransactionId = `EFX-EXP-${Date.now()}`;
            const payment = await paygoService.createPayment(
                productId,
                'multicaixa',
                'Cliente EcoFlix',
                'geral@ecokambio.com',
                {
                    phone: phone,
                    merchantTransactionId: merchantTransactionId
                }
            );

            // PayGo doesn't always provide an entity for express, we can default it or grab from reference if needed
            // But usually the entity is part of the API details or not needed for push.
            // For express, reference is the phone number usually, but PayGo might return a reference string.
            
            return {
                success: true,
                reference: payment.reference || phone, // fallback to phone if no reference
                entity: 'EXPRESS', // default entity name for UI purposes
                transaction_id: payment.payment_id,
                message: 'Por favor, confirme o pagamento no seu telemóvel (Multicaixa Express).'
            };
        } catch (error) {
            console.error('ExpressProvider Error:', error.message);
            throw error;
        }
    }
}

module.exports = ExpressProvider;
