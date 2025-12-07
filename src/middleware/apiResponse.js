const API_VERSION = '1.0.0';

/**
 * Middleware para padronizar respostas da API
 * Adiciona métodos helper ao objeto de resposta
 */
const apiResponse = (req, res, next) => {
    /**
     * Resposta de sucesso padronizada
     * @param {*} data - Dados a retornar
     * @param {number} statusCode - Código HTTP (padrão 200)
     * @param {object} meta - Metadados adicionais
     */
    res.apiSuccess = (data, statusCode = 200, meta = {}) => {
        res.status(statusCode).json({
            success: true,
            data,
            meta: {
                timestamp: new Date().toISOString(),
                version: API_VERSION,
                ...meta
            }
        });
    };

    /**
     * Resposta de erro padronizada
     * @param {string} code - Código do erro
     * @param {string} message - Mensagem de erro
     * @param {number} statusCode - Código HTTP (padrão 400)
     * @param {object} details - Detalhes adicionais do erro
     */
    res.apiError = (code, message, statusCode = 400, details = {}) => {
        res.status(statusCode).json({
            success: false,
            error: {
                code,
                message,
                details
            },
            meta: {
                timestamp: new Date().toISOString(),
                version: API_VERSION
            }
        });
    };

    next();
};

module.exports = apiResponse;
