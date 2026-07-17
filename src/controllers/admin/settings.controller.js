/**
 * Settings Controller
 * Gerencia configurações do sistema
 */
const { settingsService } = require('../../services');
const { catchAsync } = require('../../middleware/catchAsync');
const { AppError } = require('../../middleware/errorHandler');
const sharp = require('sharp');
const path = require('path');
const logger = require('../../config/logger');

/**
 * GET /api/admin/settings
 * Buscar configurações
 */
const getSettings = catchAsync(async (req, res) => {
    const settings = await settingsService.getSettings();

    res.status(200).json({
        success: true,
        data: settings
    });
});

/**
 * POST /api/admin/settings
 * Atualizar configurações
 */
const updateSettings = catchAsync(async (req, res) => {
    const settingsData = req.body;

    const data = await settingsService.updateSettings({
        ...settingsData,
        updated_at: new Date().toISOString()
    });

    res.status(200).json({
        success: true,
        message: 'Configurações atualizadas com sucesso.',
        data
    });
});

/**
 * POST /api/admin/informal-rates
 * Atualizar taxas informais
 */
const updateInformalRates = catchAsync(async (req, res) => {
    const { informal_rates } = req.body;

    if (!informal_rates || typeof informal_rates !== 'object') {
        throw new AppError('Dados de taxas informais inválidos.', 400);
    }

    const data = await settingsService.updateSettings({
        informal_rates,
        updated_at: new Date().toISOString()
    });

    res.status(200).json({
        success: true,
        message: 'Taxas informais atualizadas com sucesso.',
        data
    });
});

module.exports = {
    getSettings,
    updateSettings,
    updateInformalRates
};
