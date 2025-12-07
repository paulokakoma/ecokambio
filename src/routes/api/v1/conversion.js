const express = require('express');
const router = express.Router();
const conversionController = require('../../../controllers/api/v1/conversionController');
const { conversionLimiter } = require('../../../middleware/apiRateLimits');
const { jwtAuth } = require('../../../middleware/jwtAuth');

/**
 * @route   POST /api/v1/conversion
 * @desc    Convert amount between currencies (protected)
 * @access  Protected – requires valid JWT token
 * @body    { from: 'USD', to: 'AOA', amount: 100, market: 'informal' }
 */
router.post('/', jwtAuth, conversionLimiter, conversionController.convertCurrency);

module.exports = router;
