const config = require('../config/env');
const logger = require('../config/logger');


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

    // Usa o logger Winston para registrar o erro (server-side only).
    logger.error(err.message, {
        statusCode: err.statusCode,
        message: err.message,
        url: req.originalUrl,
        method: req.method,
        stack: err.stack,
    });

    // CRITICAL SECURITY: Never leak stack traces in production
    if (config.isDevelopment) {
        // Em desenvolvimento, envie uma resposta de erro detalhada (debugging).
        return res.status(err.statusCode).json({
            success: false,
            error: {
                code: err.code || 'ERROR',
                message: err.message,
                stack: err.stack, // Only in development
                details: err.errors || {}
            },
            meta: {
                timestamp: new Date().toISOString(),
                version: '1.0.0'
            }
        });
    }

    // PRODUCTION: Generic messages only
    if (err.isOperational) {
        // Se for um erro operacional (AppError), podemos confiar na mensagem.
        return res.status(err.statusCode).json({
            success: false,
            error: {
                code: err.code || 'OPERATIONAL_ERROR',
                message: err.message,
                details: err.errors || {}
            },
            meta: {
                timestamp: new Date().toISOString(),
                version: '1.0.0'
            }
        });
    }

    // Se for um erro de programação ou desconhecido, envie uma mensagem genérica.
    // NEVER leak internal details or stack traces
    return res.status(500).json({
        success: false,
        error: {
            code: 'INTERNAL_ERROR',
            message: 'Ocorreu um erro interno. Por favor, tente novamente mais tarde.'
        },
        meta: {
            timestamp: new Date().toISOString(),
            version: '1.0.0'
        }
    });
};

module.exports = { errorHandler, AppError };