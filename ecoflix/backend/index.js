const express = require('express');
const logger = require('../../src/config/logger');
const viewRoutes = require('./viewRoutes');
const apiRoutes = require('./routes');

const noCacheHeaders = (req, res, next) => {
    res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, private',
        'Pragma': 'no-cache',
        'Expires': '0'
    });
    next();
};

module.exports = (app) => {
    // 1. API Routes
    app.use('/api/ecoflix', apiRoutes);
    app.use('/api/ecoflix/admin', noCacheHeaders);

    // 2. View Routes (Standalone Microfrontend)
    app.use('/ecoflix', viewRoutes);

    // 3. Inicializar Background Queues (BullMQ)
    if (process.env.REDIS_URL) {
        require('./services/queue.service');
        require('./services/sms_queue.service');
    } else {
        logger.info('⚠️ REDIS_URL não definida: Sistema de filas EcoFlix desativado.');
    }

    // 4. Inicializar Cron Jobs (SMS Automáticos)
    const { initializeCron } = require('./cron/expiration.cron');
    initializeCron();
};
