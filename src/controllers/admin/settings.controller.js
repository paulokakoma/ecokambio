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

/**
 * POST /api/admin/visa-settings
 * Atualizar configurações VISA com upload de imagem
 */
const updateVisaSettings = catchAsync(async (req, res) => {
    const { visa_url, visa_description } = req.body;
    const visaImage = req.file;

    let updateData = {
        visa_url,
        visa_description,
        updated_at: new Date().toISOString()
    };

    // Processar imagem se fornecida
    if (visaImage) {
        try {
            const filename = `visa_${Date.now()}.png`;
            const outputPath = path.join(process.cwd(), 'public', 'assets', filename);

            await sharp(visaImage.buffer)
                .resize(400, 300, { fit: 'inside', withoutEnlargement: true })
                .toFile(outputPath);

            updateData.visa_image = `/assets/${filename}`;
        } catch (err) {
            logger.error('Erro ao processar imagem VISA:', err);
            throw new AppError('Erro ao processar imagem.', 500);
        }
    }

    const data = await settingsService.updateVisaSettings(updateData);

    res.status(200).json({
        success: true,
        message: 'Configurações VISA atualizadas com sucesso.',
        data
    });
});

module.exports = {
    getSettings,
    updateSettings,
    updateInformalRates,
    updateVisaSettings
};
