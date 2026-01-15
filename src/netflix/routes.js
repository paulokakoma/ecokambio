/**
 * EcoFlix API Routes
 * Prefix: /api/ecoflix
 */

const express = require('express');
const router = express.Router();
const ecoflixController = require('./controller');
const isAdmin = require('../middleware/auth');
const catchAsync = require('../utils/catchAsync');
const { validateSignature } = require('../middleware/hmacSignature');

// ============================================================================
// CUSTOMER ROUTES (Public)
// ============================================================================

// OTP Authentication - HMAC Protected
router.post('/auth/send-otp', validateSignature, catchAsync(ecoflixController.sendOtp));
router.post('/auth/verify-otp', validateSignature, catchAsync(ecoflixController.verifyOtp));

// Orders and Payments - HMAC Protected
// Note: Payment route is protected by OTP Auth + HMAC
router.post('/orders/create', validateSignature, catchAsync(ecoflixController.requireOtpAuth), catchAsync(ecoflixController.initPayment));
router.get('/orders/:ref/status', catchAsync(ecoflixController.checkPaymentStatus));
router.post('/coupons/validate', validateSignature, catchAsync(ecoflixController.validateCoupon));

// Subscriptions - HMAC Protected
router.get('/subscription/credentials', catchAsync(ecoflixController.requireOtpAuth), catchAsync(ecoflixController.getSubscriptionCredentials));
router.post('/subscription/renew', validateSignature, catchAsync(ecoflixController.requireOtpAuth), catchAsync(ecoflixController.renewSubscription));
router.post('/subscription/report', validateSignature, catchAsync(ecoflixController.requireOtpAuth), catchAsync(ecoflixController.reportIssue));

// Testing
router.post('/test/simulate-webhook', catchAsync(ecoflixController.simulateWebhook));

// Development Mocks
if (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV) {
    const mockAppyPay = require('./mock_appypay');
    router.use('/mock/appypay', mockAppyPay);
}

// ============================================================================
// ADMIN ROUTES (Protected)
// ============================================================================

// Auth
router.post('/admin/login', catchAsync(ecoflixController.adminLogin));

// Dashboard Analytics
router.get('/admin/inventory-stats', catchAsync(ecoflixController.getInventoryStatus));
router.get('/admin/export-csv', catchAsync(ecoflixController.getExportCSV));
router.get('/admin/export-sales-auto', catchAsync(ecoflixController.exportSalesAuto)); // Token Protected Query

// Dashboard (Old/Shared)
router.get('/admin/dashboard', isAdmin, catchAsync(ecoflixController.getDashboard));

// Stock Management
router.get('/admin/stock', isAdmin, catchAsync(ecoflixController.getStock));
router.post('/admin/accounts', isAdmin, catchAsync(ecoflixController.createAccount));
router.put('/admin/accounts/:id', isAdmin, catchAsync(ecoflixController.updateAccount));
router.delete('/admin/accounts/:id', isAdmin, catchAsync(ecoflixController.deleteAccount));

// Profiles
router.put('/admin/profiles/:id', isAdmin, catchAsync(ecoflixController.updateProfile));

// Orders
router.get('/admin/orders', isAdmin, catchAsync(ecoflixController.getOrders));
router.get('/admin/notifications', isAdmin, catchAsync(ecoflixController.getNotifications));
router.post('/admin/orders/:id/confirm', isAdmin, catchAsync(ecoflixController.confirmPayment));

// Security & Recovery (Admin)
router.get('/admin/accounts/:id/recovery', isAdmin, catchAsync(ecoflixController.getRecoveryData));

// ============================================================================
// CRON JOBS (Internal / Automated)
// ============================================================================
router.get('/cron/expiry-warning', catchAsync(ecoflixController.cronExpiryWarning));
router.get('/cron/cleanup', catchAsync(ecoflixController.cronCleanup));

// ============================================================================
// WEBHOOK (AppyPay)
// ============================================================================

router.post('/webhooks/proxypay', catchAsync(ecoflixController.proxyPayWebhook));
router.post('/webhooks/appypay', catchAsync(ecoflixController.appyPayWebhook));

module.exports = router;
