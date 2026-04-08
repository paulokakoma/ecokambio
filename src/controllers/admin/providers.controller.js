/**
 * Providers Controller
 * Gerencia provedores de taxas de câmbio
 */
const { rateProviderService } = require('../../services');
const { rateProviderRepository } = require('../../repositories');
const { catchAsync } = require('../../utils/catchAsync');
const { AppError } = require('../../middleware/errorHandler');
const logger = require('../../config/logger');

/**
 * GET /api/admin/rate_providers
 * Buscar provedores por tipo
 */
const getRateProviders = catchAsync(async (req, res) => {
    const { type } = req.query;

    if (!type || (type !== 'FORMAL' && type !== 'INFORMAL')) {
        throw new AppError("É necessário especificar o 'type' (FORMAL ou INFORMAL).", 400);
    }

    const providers = await rateProviderService.getProvidersByType(type);

    res.status(200).json({
        success: true,
        data: providers
    });
});

/**
 * POST /api/admin/:resource
 * Criar novo recurso (propriedade genérica)
 */
const handleResourcePost = (resource, table) => {
    return catchAsync(async (req, res) => {
        logger.info(`Creating ${resource} in ${table}`, req.body);

        const data = await rateProviderService.createProvider({
            ...req.body,
            created_at: new Date().toISOString()
        });

        res.status(201).json({
            success: true,
            message: 'Recurso criado com sucesso.',
            data
        });
    });
};

/**
 * DELETE /api/admin/:resource/:id
 * Eliminar recurso
 */
const deleteResource = catchAsync(async (req, res) => {
    const { resource, id } = req.params;
    const tableMap = {
        rate_providers: 'rate_providers',
        bank: 'rate_providers',
        province: 'rate_providers',
        affiliate: 'affiliate_links',
        currency: 'currencies',
        supporter: 'supporters'
    };

    const tableName = tableMap[resource];
    if (!tableName) {
        throw new AppError('Recurso não encontrado.', 404);
    }

    await rateProviderRepository.delete(id);

    res.status(200).json({
        success: true,
        message: 'Recurso apagado.'
    });
});

/**
 * POST /api/admin/add-province
 * Adicionar província informal
 */
const addProvince = catchAsync(async (req, res) => {
    const { name, province, phone, whatsapp } = req.body;

    if (!name || !province || !phone) {
        throw new AppError('Campos obrigatórios em falta: name, province, phone.', 400);
    }

    const data = await rateProviderService.createProvider({
        name,
        province,
        phone,
        whatsapp,
        type: 'INFORMAL',
        is_active: true,
        created_at: new Date().toISOString()
    });

    res.status(201).json({
        success: true,
        message: 'Província adicionada com sucesso.',
        data
    });
});

/**
 * POST /api/admin/update-status
 * Atualizar status de provedor
 */
const updateStatus = catchAsync(async (req, res) => {
    const { id, is_active } = req.body;

    if (!id) {
        throw new AppError('ID do provedor em falta.', 400);
    }

    const data = await rateProviderService.updateProvider(id, {
        is_active: is_active !== false,
        updated_at: new Date().toISOString()
    });

    res.status(200).json({
        success: true,
        message: 'Status atualizado com sucesso.',
        data
    });
});

/**
 * POST /api/admin/update-cell
 * Atualizar célula (rates informais)
 */
const updateCell = catchAsync(async (req, res) => {
    const { id, field, value } = req.body;

    if (!id || !field) {
        throw new AppError('ID e campo são obrigatórios.', 400);
    }

    const updateData = {
        [field]: value,
        updated_at: new Date().toISOString()
    };

    const data = await rateProviderService.updateProvider(id, updateData);

    res.status(200).json({
        success: true,
        message: 'Célula atualizada com sucesso.',
        data
    });
});

module.exports = {
    getRateProviders,
    handleResourcePost,
    deleteResource,
    addProvince,
    updateStatus,
    updateCell
};
