/**
 * Dashboard Controller
 * Gerencia estatísticas e dashboard do administrador
 */
const { dashboardService } = require('../../services');
const { catchAsync } = require('../../middleware/catchAsync');
const logger = require('../../config/logger');

/**
 * GET /api/admin/dashboard-stats
 * Estatísticas do dashboard
 */
const getDashboardStats = catchAsync(async (req, res) => {
    const stats = await dashboardService.getStats();

    res.status(200).json({
        success: true,
        data: stats
    });
});

/**
 * GET /api/admin/weekly-activity
 * Atividade semanal
 */
const getWeeklyActivity = catchAsync(async (req, res) => {
    const activity = await dashboardService.getWeeklyActivity();

    res.status(200).json({
        success: true,
        data: activity
    });
});

/**
 * GET /api/admin/event-types-stats
 * Estatísticas de tipos de eventos
 */
const getEventTypeStats = catchAsync(async (req, res) => {
    const stats = await dashboardService.getEventTypeStats();

    res.status(200).json({
        success: true,
        data: stats
    });
});

/**
 * GET /api/admin/recent-activity
 * Atividade recente
 */
const getRecentActivity = catchAsync(async (req, res) => {
    const limit = parseInt(req.query.limit) || 50;
    const activity = await dashboardService.getRecentActivity(limit);

    res.status(200).json({
        success: true,
        data: activity
    });
});

/**
 * POST /api/admin/reset-stats
 * Limpar estatísticas
 */
const resetStats = catchAsync(async (req, res) => {
    await dashboardService.clearStats();
    logger.info('Estatísticas limpas pelo administrador');

    res.status(200).json({
        success: true,
        message: 'Estatísticas limpas com sucesso.'
    });
});

module.exports = {
    getDashboardStats,
    getWeeklyActivity,
    getEventTypeStats,
    getRecentActivity,
    resetStats
};
