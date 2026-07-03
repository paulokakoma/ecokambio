const BasePaymentProvider = require('./base.provider');
const paygoService = require('../paygo.service');

class ReferenciaProvider extends BasePaymentProvider {
    async initiatePayment({ amount, phone, plan_type }) {
        console.log(`Initiating Referencia (PayGo) Payment for plan: ${plan_type}, amount: ${amount}`);

        try {
            // 1. Create a product in PayGo
            const productName = `EcoFlix - Plano ${plan_type}`;
            const productId = await paygoService.createProduct(
                productName,
                amount,
                'https://ecokambio.com/ecoflix/obrigado', // Placeholder URL
                'Pagamento de subscrição EcoFlix'
            );

            // 2. Create the payment request (Referencia = 'reference')
            const merchantTransactionId = `EFX-REF-${Date.now()}`;
            const payment = await paygoService.createPayment(
                productId,
                'reference',
                'Cliente EcoFlix',
                'geral@ecokambio.com',
                {
                    phone: phone,
                    merchantTransactionId: merchantTransactionId
                }
            );

            // In reference mode, PayGo usually returns a 'reference' field in the format "000000000".
            // Some providers use a fixed entity, assuming Paygo uses its default entity or we can hardcode 'PayGo'.
            const reference = payment.reference || '';
            
            return {
                success: true,
                reference: reference, 
                entity: 'PAYGO', // Adjust this if PayGo returns a dynamic entity
                transaction_id: payment.payment_id,
                message: 'Utilize os dados acima para fazer o pagamento no Multicaixa.'
            };
        } catch (error) {
            console.error('ReferenciaProvider Error:', error.message);
            throw error;
        }
    }
}

module.exports = ReferenciaProvider;
