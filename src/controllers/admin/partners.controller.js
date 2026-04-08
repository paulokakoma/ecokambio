/**
 * Partners Controller
 * Gerencia parceiros e clicks
 */
const { partnerService } = require('../../services');
const { catchAsync } = require('../../utils/catchAsync');
const logger = require('../../config/logger');

/**
 * POST /api/admin/partner-click/:id
 * Registrar click em parceiro
 */
const trackPartnerClick = catchAsync(async (req, res) => {
    const { id } = req.params;

    await partnerService.trackClick(id);
    logger.info(`Click registrado no parceiro: ${id}`);

    res.status(200).json({
        success: true,
        message: 'Click registrado com sucesso.'
    });
});

/**
 * GET /api/admin/partner-clicks
 * Estatísticas de clicks
 */
const getPartnerClickStats = catchAsync(async (req, res) => {
    const stats = await partnerService.getClickStats();

    res.status(200).json({
        success: true,
        data: stats
    });
});

module.exports = {
    trackPartnerClick,
    getPartnerClickStats
};
