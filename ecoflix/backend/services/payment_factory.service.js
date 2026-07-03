/**
 * Payment Provider Factory
 * Returns the appropriate provider instance based on method/config
 */
const ExpressProvider = require('./providers/express.provider');
const PayGoProvider = require('./providers/paygo.provider');
const ReferenciaProvider = require('./providers/referencia.provider');
const UnitelMoneyProvider = require('./providers/unitel.provider');

class PaymentProviderFactory {
    static getProvider(method) {
        // Map old/alternative method codes
        const normalized = {
            'MCX_PUSH': 'EXPRESS',
            'REFERENCE': 'REFERENCIA'
        }[method] || method;

        switch (normalized) {
            case 'EXPRESS':
                if (process.env.PAYGOOO_API_KEY) {
                    return new PayGoProvider('express');
                }
                return new ExpressProvider();
            case 'REFERENCIA':
                if (process.env.PAYGOOO_API_KEY) {
                    return new PayGoProvider('referencia');
                }
                return new ReferenciaProvider();
            default:
                throw new Error(`Método de pagamento não suportado: ${method}`);
        }
    }
}

module.exports = PaymentProviderFactory;
