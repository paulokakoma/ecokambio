const express = require('express');
const router = express.Router();
const ratesController = require('../../../controllers/api/v1/ratesController');
const { apiReadLimiter } = require('../../../middleware/apiRateLimits');

// Apply read rate limiter to all rates endpoints
router.use(apiReadLimiter);

/**
 * @route   GET /api/v1/rates
 * @desc    Get all current exchange rates (formal + informal)
 * @access  Public
 */
router.get('/', ratesController.getAllRates);

/**
 * @route   GET /api/v1/rates/informal
 * @desc    Get informal market rates
 * @access  Public
 */
router.get('/informal', ratesController.getInformalRates);

/**
 * @route   GET /api/v1/rates/formal
 * @desc    Get formal market rates (banks)
 * @access  Public
 */
router.get('/formal', ratesController.getFormalRates);

/**
 * @route   GET /api/v1/rates/history
 * @desc    Get historical rates (query params: currency, days)
 * @access  Public
 */
router.get('/history', ratesController.getHistoricalRates);

/**
 * @route   GET /api/v1/rates/:currency
 * @desc    Get rates for a specific currency (USD, EUR, USDT)
 * @access  Public
 */
router.get('/:currency', ratesController.getRatesByCurrency);

module.exports = router;
