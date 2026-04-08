/**
 * Supporters Controller
 * Gerencia apoiadores do projeto
 */
const { supporterService } = require('../../services');
const { supporterRepository } = require('../../repositories');
const { catchAsync } = require('../../utils/catchAsync');
const { AppError } = require('../../middleware/errorHandler');
const sharp = require('sharp');
const path = require('path');
const logger = require('../../config/logger');

/**
 * GET /api/admin/supporters
 * Buscar todos os apoiadores
 */
const getSupporters = catchAsync(async (req, res) => {
    const supporters = await supporterService.getAllSupporters();

    res.status(200).json({
        success: true,
        data: supporters
    });
});

/**
 * POST /api/admin/supporter
 * Criar novo apoiador com upload de imagem
 */
const createSupporter = catchAsync(async (req, res) => {
    const { name, url, display_order } = req.body;
    const bannerImage = req.file;

    if (!name) {
        throw new AppError('Nome do apoiador é obrigatório.', 400);
    }

    let imageUrl = null;

    // Processar imagem se fornecida
    if (bannerImage) {
        try {
            const filename = `supporter_${Date.now()}.png`;
            const outputPath = path.join(process.cwd(), 'public', 'assets', filename);

            await sharp(bannerImage.buffer)
                .resize(300, 150, { fit: 'inside', withoutEnlargement: true })
                .toFile(outputPath);

            imageUrl = `/assets/${filename}`;
        } catch (err) {
            logger.error('Erro ao processar imagem:', err);
            throw new AppError('Erro ao processar imagem.', 500);
        }
    }

    const data = await supporterService.createSupporter({
        name,
        url,
        banner_image: imageUrl,
        display_order: display_order || 0,
        created_at: new Date().toISOString()
    });

    res.status(201).json({
        success: true,
        message: 'Apoiador criado com sucesso.',
        data
    });
});

/**
 * PUT /api/admin/supporter/:id
 * Atualizar apoiador
 */
const updateSupporter = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { name, url, display_order } = req.body;

    const updateData = {
        name,
        url,
        display_order,
        updated_at: new Date().toISOString()
    };

    // Se houver nova imagem
    if (req.file) {
        try {
            const filename = `supporter_${Date.now()}.png`;
            const outputPath = path.join(process.cwd(), 'public', 'assets', filename);

            await sharp(req.file.buffer)
                .resize(300, 150, { fit: 'inside', withoutEnlargement: true })
                .toFile(outputPath);

            updateData.banner_image = `/assets/${filename}`;
        } catch (err) {
            logger.error('Erro ao processar imagem:', err);
            throw new AppError('Erro ao processar imagem.', 500);
        }
    }

    const data = await supporterService.updateSupporter(id, updateData);

    res.status(200).json({
        success: true,
        message: 'Apoiador atualizado com sucesso.',
        data
    });
});

/**
 * DELETE /api/admin/supporter/:id
 * Eliminar apoiador
 */
const deleteSupporter = catchAsync(async (req, res) => {
    const { id } = req.params;

    await supporterService.deleteSupporter(id);

    res.status(200).json({
        success: true,
        message: 'Apoiador eliminado com sucesso.'
    });
});

module.exports = {
    getSupporters,
    createSupporter,
    updateSupporter,
    deleteSupporter
};
