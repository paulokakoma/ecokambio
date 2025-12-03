const config = require('../config/env');

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

    // Log detalhado do erro no console do servidor, independentemente do ambiente.
    console.error('💥 OCORREU UM ERRO 💥', {
        message: err.message,
        url: req.originalUrl,
        method: req.method,
        stack: err.stack, // A stack é útil para depuração
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