const rateLimit = require('express-rate-limit');

/**
 * Rate limiters específicos para diferentes tipos de endpoints da API
 * IMPORTANTE: Estes limiters são dinâmicos e consideram API keys
 */

// Rate limiter para endpoints GET (leitura)
// SEM KEY: 20 req/15min | COM KEY: 1000 req/15min (reduzido por segurança)
const apiReadLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: (req) => {
        // Se tem API key válida, aumenta 50x o limite
        if (req.apiKey) {
            return 1000;
        }
        return 20; // Reduzido de 100 para 20 (proteção DoS)
    },
    standardHeaders: true,
    legacyHeaders: false,
    // Skip rate limiting for requests with API keys (they have their own counter)
    skip: (req) => {
        // If has API key, use a separate counter
        return false; // Don't skip, always count
    },
    handler: (req, res) => {
        const limit = req.apiKey ? 1000 : 20;
        res.status(429).json({
            success: false,
            error: {
                code: 'RATE_LIMIT_EXCEEDED',
                message: 'Muitas requisições. Por favor, tente novamente em alguns minutos.',
                details: {
                    limit,
                    windowMs: 900000,
                    tip: req.apiKey ? 'Você já tem uma API key!' : 'Gere uma API key grátis em /developers para 50x mais requests'
                }
            }
        });
    }
});

// Rate limiter para endpoints POST (escrita/conversão)
// SEM KEY: 30 req/15min | COM KEY: 300 req/15min
const apiWriteLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: (req) => {
        if (req.apiKey) {
            return 300; // 10x mais
        }
        return 30; // Público padrão
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        const limit = req.apiKey ? 300 : 30;
        res.status(429).json({
            success: false,
            error: {
                code: 'RATE_LIMIT_EXCEEDED',
                message: 'Muitas requisições. Por favor, tente novamente em alguns minutos.',
                details: {
                    limit,
                    windowMs: 900000,
                    tip: req.apiKey ? 'Você já tem uma API key!' : 'Gere uma API key grátis em /developers para 10x mais requests'
                }
            }
        });
    }
});

// Rate limiter específico para conversão (uso mais intensivo)
// SEM KEY: 60 req/15min | COM KEY: 600 req/15min
const conversionLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: (req) => {
        if (req.apiKey) {
            return 600; // 10x mais
        }
        return 60; // Público padrão
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        const limit = req.apiKey ? 600 : 60;
        res.status(429).json({
            success: false,
            error: {
                code: 'CONVERSION_RATE_LIMIT_EXCEEDED',
                message: 'Limite de conversões excedido. Por favor, tente novamente em alguns minutos.',
                details: {
                    limit,
                    windowMs: 900000,
                    tip: req.apiKey ? 'Você já tem uma API key!' : 'Gere uma API key grátis em /developers para 10x mais conversões'
                }
            }
        });
    }
});

module.exports = {
    apiReadLimiter,
    apiWriteLimiter,
    conversionLimiter
};
