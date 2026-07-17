/**
 * EcoFlix API Routes
 * Prefix: /api/ecoflix
 */

const express = require('express');
const router = express.Router();

// Middleware
const isAdmin = require('../../src/middleware/auth');
const catchAsync = require('../../src/middleware/catchAsync');
const { validateSignature } = require('../../src/middleware/hmacSignature');

// Controllers
const adminController = require('./controllers/admin.controller');
const authController = require('./controllers/auth.controller');
const paymentController = require('./controllers/payment.controller');
const subscriptionController = require('./controllers/subscription.controller');
const cronController = require('./controllers/cron.controller');
const { sseConnect } = require('./controllers/sse.controller');


// ============================================================================
// CUSTOMER ROUTES (Public)
// ============================================================================

// Password Authentication - HMAC Protected
router.get('/public/plans', catchAsync(adminController.getPlans));
router.get('/public/stock', catchAsync(adminController.getPublicStock));
router.post('/auth/register-request', validateSignature, catchAsync(authController.registerRequest));
router.post('/auth/register-verify', validateSignature, catchAsync(authController.registerVerify));
router.post('/auth/login', validateSignature, catchAsync(authController.login));

// Orders and Payments - HMAC Protected
router.post('/orders/create', validateSignature, catchAsync(authController.requireOtpAuth), catchAsync(paymentController.initPayment));
router.post('/orders/quick', validateSignature, catchAsync(paymentController.quickOrder));
router.get('/orders/:ref/status', catchAsync(paymentController.checkPaymentStatus));
router.post('/orders/:id/cancel', catchAsync(paymentController.cancelOrder));
router.post('/coupons/validate', validateSignature, catchAsync(subscriptionController.validateCoupon));

// Account / Credential Recovery (no auth needed — SMS-based)
router.post('/account/recover', catchAsync(authController.recoverCredentials));

// Subscriptions - HMAC Protected
router.get('/subscription/credentials', catchAsync(authController.requireOtpAuth), catchAsync(subscriptionController.getSubscriptionCredentials));
router.post('/subscription/renew', validateSignature, catchAsync(authController.requireOtpAuth), catchAsync(paymentController.renewSubscription));
router.post('/subscription/report', validateSignature, catchAsync(authController.requireOtpAuth), catchAsync(subscriptionController.reportIssue));
router.post('/support/public-report', validateSignature, catchAsync(subscriptionController.publicReportIssue));

// Testing
router.post('/test/simulate-webhook', catchAsync(paymentController.simulateWebhook));


// ============================================================================
// ADMIN ROUTES (Protected)
// ============================================================================

// Auth
router.post('/admin/login', catchAsync(adminController.adminLogin));

// Dashboard Analytics
router.get('/admin/inventory-stats', catchAsync(adminController.getInventoryStatus));
router.get('/admin/export-csv', catchAsync(adminController.getExportCSV));
router.get('/admin/export-sales-auto', catchAsync(adminController.exportSalesAuto)); // Token Protected Query

// Dashboard (Old/Shared)
router.get('/admin/dashboard', isAdmin, catchAsync(adminController.getDashboard));

// Configuração de Planos
router.get('/admin/plans', isAdmin, catchAsync(adminController.getPlans));
router.put('/admin/plans', isAdmin, catchAsync(adminController.updatePlans));

// Stock Management
router.get('/admin/stock', isAdmin, catchAsync(adminController.getStock));
router.post('/admin/accounts', isAdmin, catchAsync(adminController.createAccount));
router.put('/admin/accounts/:id', isAdmin, catchAsync(adminController.updateAccount));
router.delete('/admin/accounts/:id', isAdmin, catchAsync(adminController.deleteAccount));

// Profiles
router.put('/admin/profiles/:id', isAdmin, catchAsync(adminController.updateProfile));
router.post('/admin/profiles/:id/revoke', isAdmin, catchAsync(adminController.revokeProfile));
router.post('/admin/profiles/:id/suspend', isAdmin, catchAsync(adminController.suspendProfile));
router.post('/admin/profiles/:id/restore', isAdmin, catchAsync(adminController.restoreProfile));

// Orders
router.get('/admin/orders', isAdmin, catchAsync(adminController.getOrders));
router.get('/admin/notifications', isAdmin, catchAsync(adminController.getNotifications));
router.get('/admin/sms-logs', isAdmin, catchAsync(adminController.getSmsLogs));
router.post('/admin/orders/:id/confirm', isAdmin, catchAsync(paymentController.confirmPayment));
router.post('/admin/orders/:id/cancel', isAdmin, catchAsync(paymentController.cancelOrder));

// Clients & Issues
router.get('/admin/clients', isAdmin, catchAsync(adminController.getClients));
router.get('/admin/issues', isAdmin, catchAsync(adminController.getIssues));
router.post('/admin/issues/:id/resolve', isAdmin, catchAsync(adminController.resolveIssue));
// Security & Recovery (Admin)
router.get('/admin/accounts/:id/recovery', isAdmin, catchAsync(adminController.getRecoveryData));

// Admin Support (WhatsApp/Quick Fixes)
router.get('/admin/support/clients', isAdmin, catchAsync(adminController.getSupportClients));
router.get('/admin/support/search/:phone', isAdmin, catchAsync(adminController.searchSupportClient));
router.post('/admin/support/resend-sms', isAdmin, catchAsync(adminController.resendSms));
router.post('/admin/support/suspend', isAdmin, catchAsync(adminController.suspendAccount));
router.post('/admin/support/restore', isAdmin, catchAsync(adminController.restoreAccount));
router.post('/admin/support/reset-password', isAdmin, catchAsync(adminController.resetPassword));
router.get('/admin/settings', isAdmin, catchAsync(adminController.getSettings));
router.post('/admin/settings', isAdmin, catchAsync(adminController.updateSettings));

// Influencer/Referral Code Stats (Admin) - Legacy
router.get('/admin/influencer-stats', isAdmin, catchAsync(adminController.getInfluencerStats));

// Partner/Affiliate Management (Admin)
router.get('/admin/partners', isAdmin, catchAsync(adminController.getPartnerStats));
router.post('/admin/partners', isAdmin, catchAsync(adminController.createPartner));
router.post('/admin/partners/:id/pay', isAdmin, catchAsync(adminController.markPartnerPaid));
router.get('/admin/sales-origin-chart', isAdmin, catchAsync(adminController.getSalesOriginChart));

// SSE — Actualizações em tempo real para o painel admin
router.get('/admin/events', isAdmin, sseConnect);

// ============================================================================
// CRON JOBS (Internal / Automated)
// ============================================================================
router.get('/cron/expiry-warning', catchAsync(cronController.cronExpiryWarning));
router.get('/cron/cleanup', catchAsync(cronController.cronCleanup));

// ============================================================================
// WEBHOOK 
// ============================================================================

router.post('/webhooks/paygo', catchAsync(paymentController.paygoWebhook)); // Renamed paygooo to paygo


module.exports = router;
