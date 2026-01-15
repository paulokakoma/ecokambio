const crypto = require('crypto');

/**
 * Verify HMAC Signature
 * @param {string} payload - The raw request body
 * @param {string} signature - The signature from the header
 * @param {string} secret - The secret key
 * @returns {boolean} - True if signature is valid
 */
const verifySignature = (payload, signature, secret) => {
    if (!signature || !secret) return false;

    // Assuming signature is hex encoded HMAC-SHA256
    // Adjust algo if AppyPay uses something else (e.g. sha1, base64)
    const hmac = crypto.createHmac('sha256', secret);
    const digest = hmac.update(payload).digest('hex');

    // Use timingSafeEqual to prevent timing attacks
    // Ensure lengths verify first to avoid errors
    const signatureBuffer = Buffer.from(signature);
    const digestBuffer = Buffer.from(digest);

    if (signatureBuffer.length !== digestBuffer.length) {
        return false;
    }

    return crypto.timingSafeEqual(signatureBuffer, digestBuffer);
};

module.exports = {
    verifySignature
};
