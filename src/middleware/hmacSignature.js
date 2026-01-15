const crypto = require('crypto');
const config = require('../config/env');

/**
 * HMAC Signature Validation Middleware
 * Prevents replay attacks and data tampering by validating request signatures
 * 
 * How it works:
 * 1. Frontend signs request with: HMAC-SHA256(timestamp + JSON body, SECRET_KEY)
 * 2. Backend validates signature and timestamp
 * 3. Rejects if signature is invalid or request is > 5 minutes old
 * 
 * Headers required from frontend:
 * - x-signature: HMAC signature
 * - x-timestamp: Unix timestamp in milliseconds
 */
const validateSignature = (req, res, next) => {
    // Skip validation in development if explicitly disabled
    if (config.isDevelopment && process.env.SKIP_HMAC_VALIDATION === 'true') {
        console.log('[HMAC] Validation skipped in development mode');
        return next();
    }

    const SECRET_KEY = config.apiSecretKey;

    if (!SECRET_KEY) {
        console.error('[HMAC] API_SECRET_KEY not configured in .env');
        return res.status(500).json({
            success: false,
            error: 'Configuração de segurança ausente no servidor.'
        });
    }

    // 1. GET HEADERS
    const signature = req.headers['x-signature'];
    const timestamp = req.headers['x-timestamp'];

    if (!signature || !timestamp) {
        console.warn('[HMAC] Missing signature or timestamp headers');
        return res.status(401).json({
            success: false,
            error: 'Assinatura ou Timestamp em falta.'
        });
    }

    // 2. PREVENT REPLAY ATTACKS
    // Reject requests older than 5 minutes (300000ms)
    const now = Date.now();
    const requestTime = parseInt(timestamp);
    const timeDiff = Math.abs(now - requestTime);

    if (timeDiff > 300000) {
        console.warn(`[HMAC] Request expired. Time diff: ${timeDiff}ms from IP: ${req.ip}`);
        return res.status(401).json({
            success: false,
            error: 'Pedido expirado. Tente novamente.'
        });
    }

    // 3. RECREATE SIGNATURE
    // Formula: timestamp + JSON body (order matters!)
    const payload = `${timestamp}${JSON.stringify(req.body || {})}`;

    const expectedSignature = crypto
        .createHmac('sha256', SECRET_KEY)
        .update(payload)
        .digest('hex');

    // 4. COMPARE SIGNATURES (timing-safe comparison to prevent timing attacks)
    try {
        const isValid = crypto.timingSafeEqual(
            Buffer.from(signature),
            Buffer.from(expectedSignature)
        );

        if (!isValid) {
            throw new Error('Signature mismatch');
        }

        // Signature valid, proceed
        if (config.isDevelopment) {
            console.log('[HMAC] ✅ Signature validated successfully');
        }

        next();

    } catch (err) {
        console.warn(`[HMAC] 🚨 Invalid signature detected! IP: ${req.ip}, Error: ${err.message}`);

        // Log for debugging in development
        if (config.isDevelopment) {
            console.log('[HMAC DEBUG] Expected:', expectedSignature);
            console.log('[HMAC DEBUG] Received:', signature);
            console.log('[HMAC DEBUG] Payload:', payload.substring(0, 100) + '...');
        }

        return res.status(403).json({
            success: false,
            error: 'Assinatura Inválida.'
        });
    }
};

/**
 * Optional middleware - logs signature validation attempts without blocking
 * Useful for gradual rollout
 */
const logSignature = (req, res, next) => {
    const signature = req.headers['x-signature'];
    const timestamp = req.headers['x-timestamp'];

    if (!signature || !timestamp) {
        console.log('[HMAC LOG] Request without signature from:', req.ip);
    } else {
        console.log('[HMAC LOG] Request with signature from:', req.ip);
    }

    next();
};

module.exports = { validateSignature, logSignature };
