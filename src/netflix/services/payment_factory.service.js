/**
 * Payment Provider Factory
 * Returns the appropriate provider instance based on method/config
 */
const AppyPayProvider = require('./providers/appypay.provider');
const ExpressProvider = require('./providers/express.provider');
const ReferenciaProvider = require('./providers/referencia.provider');
const UnitelMoneyProvider = require('./providers/unitel.provider');

class PaymentProviderFactory {
    static getProvider(method) {
        switch (method) {
            case 'EXPRESS':
                return new ExpressProvider();
            case 'REFERENCIA': // Direct reference generation
                return new ReferenciaProvider();
            case 'UNITEL_MONEY':
                return new UnitelMoneyProvider();
            case 'APPYPAY':
            case 'REFERENCE': // AppyPay Reference
            case 'MCX_PUSH': // AppyPay Push
            default:
                // Default to AppyPay for existing flows
                return new AppyPayProvider();
        }
    }
}

module.exports = PaymentProviderFactory;
