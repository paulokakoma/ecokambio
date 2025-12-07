const express = require('express');
const router = express.Router();
const statusController = require('../../../controllers/api/v1/statusController');

/**
 * @route   GET /api/v1/status
 * @desc    Get API health and status information
 * @access  Public
 */
router.get('/', statusController.getStatus);

module.exports = router;
