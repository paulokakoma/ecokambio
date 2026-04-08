/**
 * Affiliates Controller
 * Gerencia links de afiliados
 */
const { affiliateLinkService } = require('../../services');
const { affiliateLinkRepository } = require('../../repositories');
const { catchAsync } = require('../../utils/catchAsync');
const { AppError } = require('../../middleware/errorHandler');

/**
 * GET /api/admin/affiliate_links
 * Buscar todos os links de afiliados
 */
const getAffiliateLinks = catchAsync(async (req, res) => {
    const links = await affiliateLinkService.getAllLinks();

    res.status(200).json({
        success: true,
        data: links
    });
});

/**
 * POST /api/admin/affiliate
 * Criar novo link de afiliado
 */
const createAffiliate = catchAsync(async (req, res) => {
    const { name, url, description } = req.body;

    if (!name || !url) {
        throw new AppError('Nome e URL são obrigatórios.', 400);
    }

    const data = await affiliateLinkService.createLink({
        name,
        url,
        description,
        created_at: new Date().toISOString()
    });

    res.status(201).json({
        success: true,
        message: 'Link de afiliado criado com sucesso.',
        data
    });
});

/**
 * PUT /api/admin/affiliate/:id
 * Atualizar link de afiliado
 */
const updateAffiliate = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { name, url, description } = req.body;

    const data = await affiliateLinkService.updateLink(id, {
        name,
        url,
        description,
        updated_at: new Date().toISOString()
    });

    res.status(200).json({
        success: true,
        message: 'Link de afiliado atualizado com sucesso.',
        data
    });
});

/**
 * DELETE /api/admin/affiliate/:id
 * Eliminar link de afiliado
 */
const deleteAffiliate = catchAsync(async (req, res) => {
    const { id } = req.params;

    await affiliateLinkService.deleteLink(id);

    res.status(200).json({
        success: true,
        message: 'Link de afiliado eliminado com sucesso.'
    });
});

module.exports = {
    getAffiliateLinks,
    createAffiliate,
    updateAffiliate,
    deleteAffiliate
};
