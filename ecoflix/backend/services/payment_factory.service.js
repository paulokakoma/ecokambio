const PayGoProvider = require('./providers/paygo.provider');

class PaymentProviderFactory {
    static getProvider(method) {
        const METHOD_MAP = {
            'EXPRESS':    'express',
            'MCX_PUSH':   'express',
            'REFERENCIA': 'referencia',
            'REFERENCE':  'referencia',
        };

        const paygoMethod = METHOD_MAP[method];
        if (!paygoMethod) {
            throw new Error(`Método de pagamento não suportado: ${method}`);
        }

        return new PayGoProvider(paygoMethod);
    }
}

module.exports = PaymentProviderFactory;
