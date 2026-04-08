/**
 * Scraper Admin Controller
 * Gerencia operações de administração do scraper
 */
const { scraperService } = require('../../services');
const { scraperController } = require('../scraperController');
const { catchAsync } = require('../../utils/catchAsync');
const logger = require('../../config/logger');

/**
 * POST /api/admin/scraper/trigger
 * Despoletar execução manual do scraper
 */
const triggerScraper = catchAsync(async (req, res) => {
    // Reutilizar o controller existente
    return scraperController.triggerScraper(req, res);
});

/**
 * POST /api/admin/scraper/trigger-informal
 * Despoletar scraper informal
 */
const triggerInformalScraper = catchAsync(async (req, res) => {
    // Reutilizar o controller existente
    return scraperController.triggerInformalScraper(req, res);
});

/**
 * GET /api/admin/scraper/health
 * Estado de saúde do scraper
 */
const getHealth = catchAsync(async (req, res) => {
    const health = await scraperService.getHealthStatus();

    res.status(200).json({
        success: true,
        data: health
    });
});

/**
 * GET /api/admin/scraper/last-results
 * Últimos resultados do scraper
 */
const getLastResults = catchAsync(async (req, res) => {
    const results = await scraperService.getLastResults();

    res.status(200).json({
        success: true,
        data: results
    });
});

/**
 * POST /api/admin/notify-update
 * Notificar atualização via WebSocket
 */
const notifyUpdate = catchAsync(async (req, res) => {
    const success = scraperService.notifyUpdate();

    if (success) {
        logger.info('Notificação de atualização enviada via WebSocket');
        res.status(200).json({
            success: true,
            message: 'Notificação enviada com sucesso.'
        });
    } else {
        res.status(500).json({
            success: false,
            message: 'Erro ao enviar notificação.'
        });
    }
});

module.exports = {
    triggerScraper,
    triggerInformalScraper,
    getHealth,
    getLastResults,
    notifyUpdate
};
