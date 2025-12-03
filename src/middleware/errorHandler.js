const config = require('../config/env');
const logger = require('../config/logger');
const Sentry = require('@sentry/node');

/**
 * Classe de erro personalizada para erros operacionais previsíveis.
 * Use esta classe para erros como "item não encontrado", "input inválido", etc.
 * @extends Error
 */
class AppError extends Error {
    constructor(message, statusCode, errors = undefined) {
        super(message);

        this.statusCode = statusCode;
        this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
        this.isOperational = true; // Distingue erros operacionais de erros de programação.
        if (errors) {
            this.errors = errors;
        }

        Error.captureStackTrace(this, this.constructor);
    }
}

const errorHandler = (err, req, res, next) => {
    err.statusCode = err.statusCode || 500;
    err.status = err.status || 'error';

    // Usa o logger Winston para registrar o erro.
    logger.error(err.message, {
        statusCode: err.statusCode,
        message: err.message,
        url: req.originalUrl,
        method: req.method,
        stack: err.stack,
    });

    if (config.isDevelopment) {
        // Em desenvolvimento, envie uma resposta de erro detalhada.
        return res.status(err.statusCode).json({
            status: err.status,
            error: err,
            message: err.message,
            stack: err.stack,
        });
    }

    // Em produção, envie uma resposta genérica para não expor detalhes.
    // Envia o erro para o Sentry, mas apenas se não for um erro operacional esperado (ex: 404).
    if (!err.isOperational) {
        Sentry.captureException(err);
    }

    if (err.isOperational) {
        // Se for um erro operacional (AppError), podemos confiar na mensagem.
        return res.status(err.statusCode).json({
            status: err.status,
            message: err.message,
            ...(err.errors && { errors: err.errors }) // Inclui detalhes do erro se existirem
        });
    }

    // Se for um erro de programação ou desconhecido, envie uma mensagem genérica.
    return res.status(500).json({ status: 'error', message: 'Ocorreu um erro inesperado no servidor.' });
};

module.exports = { errorHandler, AppError };