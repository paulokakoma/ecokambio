const express = require('express');
const router = express.Router();

// Import API v1 route modules
const ratesRoutes = require('./rates');
const conversionRoutes = require('./conversion');
const statusRoutes = require('./status');
const keysRoutes = require('./keys');
const authRoutes = require('./auth');
const chatRoutes = require('./chat');


/**
 * API v1 Router
 * Base path: /api/v1
 */

// Mount sub-routes
router.use('/rates', ratesRoutes);
router.use('/conversion', conversionRoutes);
router.use('/status', statusRoutes);
router.use('/keys', keysRoutes);
router.use('/auth', authRoutes);
router.use('/chat', chatRoutes);


// API v1 Root endpoint - provides API information
router.get('/', (req, res) => {
    res.json({
        success: true,
        data: {
            name: 'EcoKambio API',
            version: '1.0.0',
            description: 'API pública para consulta de taxas de câmbio em Angola',
            documentation: '/api-docs',
            endpoints: {
                rates: {
                    all: 'GET /api/v1/rates',
                    byCurrency: 'GET /api/v1/rates/:currency',
                    informal: 'GET /api/v1/rates/informal',
                    formal: 'GET /api/v1/rates/formal',
                    history: 'GET /api/v1/rates/history'
                },
                conversion: {
                    convert: 'POST /api/v1/conversion'
                },
                status: {
                    health: 'GET /api/v1/status'
                },
                auth: {
                    login: 'POST /api/v1/auth/login'
                }
            }
        },
        meta: {
            timestamp: new Date().toISOString()
        }
    });
});

module.exports = router;
