/**
 * Currencies Controller
 * Gerencia moedas
 */
const { currencyService } = require('../../services');
const { currencyRepository } = require('../../repositories');
const { catchAsync } = require('../../middleware/catchAsync');
const { AppError } = require('../../middleware/errorHandler');

/**
 * GET /api/admin/currencies
 * Buscar todas as moedas
 */
const getCurrencies = catchAsync(async (req, res) => {
    const currencies = await currencyService.getAllCurrencies();

    res.status(200).json({
        success: true,
        data: currencies
    });
});

/**
 * POST /api/admin/currency
 * Criar nova moeda
 */
const createCurrency = catchAsync(async (req, res) => {
    const { code, name, symbol } = req.body;

    if (!code || !name) {
        throw new AppError('Código e nome são obrigatórios.', 400);
    }

    const data = await currencyService.createCurrency({
        code: code.toUpperCase(),
        name,
        symbol,
        created_at: new Date().toISOString()
    });

    res.status(201).json({
        success: true,
        message: 'Moeda criada com sucesso.',
        data
    });
});

/**
 * PUT /api/admin/currency/:id
 * Atualizar moeda
 */
const updateCurrency = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { code, name, symbol, is_active } = req.body;

    const data = await currencyService.updateCurrency(id, {
        code,
        name,
        symbol,
        is_active,
        updated_at: new Date().toISOString()
    });

    res.status(200).json({
        success: true,
        message: 'Moeda atualizada com sucesso.',
        data
    });
});

/**
 * DELETE /api/admin/currency/:id
 * Eliminar moeda
 */
const deleteCurrency = catchAsync(async (req, res) => {
    const { id } = req.params;

    await currencyService.deleteCurrency(id);

    res.status(200).json({
        success: true,
        message: 'Moeda eliminada com sucesso.'
    });
});

module.exports = {
    getCurrencies,
    createCurrency,
    updateCurrency,
    deleteCurrency
};
