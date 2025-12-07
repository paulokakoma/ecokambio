const os = require('os');

/**
 * Get API status and health
 * GET /api/v1/status
 */
const getStatus = (req, res) => {
    const isDevelopment = process.env.NODE_ENV === 'development';

    const response = {
        status: 'healthy',
        service: 'EcoKambio API',
        version: '1.0.0',
        timestamp: new Date().toISOString()
    };

    // SECURITY: Only expose detailed info in development
    // In production, hide uptime (reveals last deploy/patch) and hostname
    if (isDevelopment) {
        response.uptime = process.uptime();
        response.hostname = os.hostname();
        response.environment = 'development';
    }

    return res.apiSuccess(response);
};

module.exports = {
    getStatus
};
