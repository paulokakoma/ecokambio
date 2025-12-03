const { validationResult } = require('express-validator');
const { AppError } = require('./errorHandler');

/**
 * Middleware que executa as validações e lida com os erros.
 * Ele é projetado para ser usado após um array de regras de validação do express-validator.
 * @param {import('express').Request} req - O objeto de requisição do Express.
 * @param {import('express').Response} res - O objeto de resposta do Express.
 * @param {import('express').NextFunction} next - A função next do Express.
 */
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);

    if (errors.isEmpty()) {
        return next();
    }

    // Formata os erros para serem mais fáceis de consumir no frontend.
    const extractedErrors = errors.array().reduce((acc, err) => {
        if (!acc[err.path]) {
            acc[err.path] = err.msg;
        }
        return acc;
    }, {});

    // Usa nossa classe AppError para um erro operacional claro com status 400.
    return next(new AppError('Dados de entrada inválidos.', 400, extractedErrors));
};

module.exports = { handleValidationErrors };