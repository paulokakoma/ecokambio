// src/middleware/jwtAuth.js
const jwt = require('jsonwebtoken');

// Secret should be set in environment variable JWT_SECRET
const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret_in_production';

/**
 * Middleware to verify JWT token.
 * Expects Authorization header in the form "Bearer <token>".
 * On success, attaches decoded payload to req.user.
 * On failure, responds with 401.
 */
function jwtAuth(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
        return res.status(401).json({
            success: false,
            error: { code: 'TOKEN_MISSING', message: 'Authorization token is required' }
        });
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
        return res.status(401).json({
            success: false,
            error: { code: 'TOKEN_MALFORMED', message: 'Authorization header must be Bearer token' }
        });
    }

    const token = parts[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded; // attach payload
        next();
    } catch (err) {
        return res.status(401).json({
            success: false,
            error: { code: 'TOKEN_INVALID', message: 'Invalid or expired token' }
        });
    }
}

module.exports = { jwtAuth, JWT_SECRET };
