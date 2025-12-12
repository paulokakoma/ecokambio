const express = require('express');
const router = express.Router();
const chatController = require('../../../controllers/api/v1/chatController');

// Helper wrapper to handle async errors in routes
const asyncHandler = fn => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

// POST /api/v1/chat
router.post('/', asyncHandler(chatController.chat));

module.exports = router;
