/**
 * EcoFlix Main Controller (Refactored)
 * Now delegates to modular controllers in ./controllers/
 */

const adminController = require('./controllers/admin.controller');
const authController = require('./controllers/auth.controller');
const paymentController = require('./controllers/payment.controller');
const subscriptionController = require('./controllers/subscription.controller');
const cronController = require('./controllers/cron.controller');

module.exports = {
    // Admin
    ...adminController,

    // Auth
    ...authController,

    // Payment
    ...paymentController,

    // Subscription
    ...subscriptionController,

    // Cron
    ...cronController
};
