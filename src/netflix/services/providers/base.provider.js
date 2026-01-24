/**
 * Base Payment Provider
 * Interface for all payment gateways
 */
class BasePaymentProvider {
    constructor(config) {
        this.config = config;
    }

    /**
     * Initiate a payment
     * @param {Object} order - Order details
     * @returns {Promise<Object>} - Payment reference/transaction details
     */
    async initiatePayment(order) {
        throw new Error('Method not implemented');
    }

    /**
     * Verify payment status
     * @param {string} reference
     * @returns {Promise<Object>} - Status: PAID, PENDING, FAILED
     */
    async checkStatus(reference) {
        throw new Error('Method not implemented');
    }
}

module.exports = BasePaymentProvider;
