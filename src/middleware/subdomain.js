const config = require('../config/env');

const subdomainMiddleware = (req, res, next) => {
    const forwardedHost = req.get('x-forwarded-host') || '';
    const host = req.get('host') || '';

    let isAdminSubdomain = false;

    if (forwardedHost.startsWith('admin.ecokambio.com') || forwardedHost.startsWith('admin.')) {
        isAdminSubdomain = true;
    } else if (host.startsWith('admin.ecokambio.com') || host.startsWith('admin.')) {
        isAdminSubdomain = true;
    } else {
        // Fallback for localhost and other cases
        const hostWithoutPort = host.split(':')[0];
        const parts = hostWithoutPort.split('.');
        isAdminSubdomain = parts[0] === 'admin' && parts.length > 1;
    }

    req.isAdminSubdomain = isAdminSubdomain;
    req.isMainDomain = !isAdminSubdomain;

    console.log(`[SubdomainMiddleware] Method: ${req.method} | Path: ${req.path} | Host: ${host} | X-Forwarded-Host: ${forwardedHost || 'none'} | Admin: ${isAdminSubdomain}`);

    next();
};

module.exports = subdomainMiddleware;
