const express = require('express');
const router = express.Router();
const apiKeysController = require('../../../controllers/api/v1/apiKeysController');
const { apiWriteLimiter } = require('../../../middleware/apiRateLimits');

/**
 * @route   POST /api/v1/keys/generate
 * @desc    Generate a new API key
 * @access  Public
 * @body    { name, email, project_description }
 */
router.post('/generate', apiWriteLimiter, apiKeysController.generateKey);

/**
 * @route   GET /api/v1/keys/my-keys
 * @desc    List API key s for a given email
 * @access  Public (requires email query param)
 * @query   email
 */
router.get('/my-keys', apiKeysController.listMyKeys);

/**
 * @route   POST /api/v1/keys/revoke
 * @desc    Revoke an API key
 * @access  Public (requires the actual key)
 * @body    { key }
 */
router.post('/revoke', apiWriteLimiter, apiKeysController.revokeKey);

/**
 * @route   GET /api/v1/keys/:keyId/stats
 * @desc    Get usage statistics for an API key
 * @access  Public
 */
router.get('/:keyId/stats', apiKeysController.getKeyStats);

module.exports = router;
