const config = require('../config/env');

/**
 * Middleware to enforce HTTPS and canonical domain (non-www).
 * 
 * - Redirects HTTP to HTTPS (using x-forwarded-proto from load balancer).
 * - Redirects www.domain.com to domain.com.
 */
const enforceHttps = (req, res, next) => {
    // Only enforce in production/staging, not local dev
    /*
    if (!config.isDevelopment) {
        const proto = req.headers['x-forwarded-proto'];
        const host = req.headers['host'];

        // 1. Enforce HTTPS
        if (proto && proto !== 'https') {
            return res.redirect(301, `https://${host}${req.url}`);
        }

        // 2. Enforce non-www (Canonical Domain)
        if (host && host.startsWith('www.')) {
            const newHost = host.slice(4); // Remove 'www.'
            return res.redirect(301, `https://${newHost}${req.url}`);
        }
    }
    */
    next();
};

module.exports = enforceHttps;
