const config = require('../config/env');

const subdomainMiddleware = (req, res, next) => {
    // Em produção com Cloudflare proxy, o host real pode estar em x-forwarded-host
    const host = req.get('x-forwarded-host') || req.get('host') || '';

    // Remove porta do host para análise
    const hostWithoutPort = host.split(':')[0];
    const parts = hostWithoutPort.split('.');

    // Detecta subdomínio admin
    // Em dev: admin.localhost -> parts = ['admin', 'localhost']
    // Em prod: admin.ecokambio.com -> parts = ['admin', 'ecokambio', 'com']
    // Em prod: admin.dominio.com -> parts = ['admin', 'dominio', 'com']
    // localhost -> parts = ['localhost']
    const isAdminSubdomain = parts[0] === 'admin' && parts.length > 1;

    // Define flag no request para uso nas rotas
    req.isAdminSubdomain = isAdminSubdomain;
    req.isMainDomain = !isAdminSubdomain;

    // Debug em desenvolvimento e produção para diagnosticar problemas de roteamento
    console.log(`[SubdomainMiddleware] Method: ${req.method} | Path: ${req.path} | Host: ${host} | X-Forwarded-Host: ${req.get('x-forwarded-host') || 'none'} | Parts: ${JSON.stringify(parts)} | Admin: ${isAdminSubdomain}`);

    next();
};

module.exports = subdomainMiddleware;
