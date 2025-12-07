// src/routes/api/v1/auth.js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

// In a real app, use a DB. Here we use a hard‑coded test user.
const TEST_USER = {
    id: 1,
    email: 'demo@example.com',
    password: 'demo' // In production, store hashed passwords!
};

// Secret must match the one used in jwtAuth middleware.
const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret_in_production';

/**
 * @route POST /api/v1/auth/login
 * @desc  Authenticate user and return a JWT token
 * @access Public (for demo purposes)
 */
router.post('/login', (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) {
        return res.status(400).json({
            success: false,
            error: { code: 'MISSING_CREDENTIALS', message: 'Email and password are required' }
        });
    }

    // Simple validation against the test user
    if (email !== TEST_USER.email || password !== TEST_USER.password) {
        return res.status(401).json({
            success: false,
            error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' }
        });
    }

    // Create JWT payload – you can add more fields as needed
    const payload = { id: TEST_USER.id, email: TEST_USER.email };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });

    return res.json({
        success: true,
        data: { access_token: token }
    });
});

module.exports = router;
