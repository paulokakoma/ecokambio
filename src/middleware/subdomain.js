const config = require('../config/env');

const subdomainMiddleware = (req, res, next) => {
    const forwardedHost = req.get('x-forwarded-host') || '';
    const host = req.get('host') || '';

    let isAdminSubdomain = false;
    let isAdminFlixSubdomain = false;

    if (forwardedHost.startsWith('admin.ecokambio.com') || forwardedHost.startsWith('admin.')) {
        isAdminSubdomain = true;
    } else if (forwardedHost.startsWith('adminflix.ecokambio.com') || forwardedHost.startsWith('adminflix.')) {
        isAdminFlixSubdomain = true;
    } else if (host.startsWith('admin.ecokambio.com') || host.startsWith('admin.')) {
        isAdminSubdomain = true;
    } else if (host.startsWith('adminflix.ecokambio.com') || host.startsWith('adminflix.')) {
        isAdminFlixSubdomain = true;
    } else {
        // Fallback for localhost and other cases
        const hostWithoutPort = host.split(':')[0];
        const parts = hostWithoutPort.split('.');
        if (parts[0] === 'admin' && parts.length > 1) {
            isAdminSubdomain = true;
        } else if (parts[0] === 'adminflix' && parts.length > 1) {
            isAdminFlixSubdomain = true;
        }
    }

    req.isAdminSubdomain = isAdminSubdomain;
    req.isAdminFlixSubdomain = isAdminFlixSubdomain;
    req.isMainDomain = !isAdminSubdomain && !isAdminFlixSubdomain;

    if (process.env.NODE_ENV === 'development') {
        const userLog = req.session ? (req.session.user ? JSON.stringify(req.session.user) : 'Guest') : 'NoSessionModule';
        const cookieLog = req.headers.cookie ? 'Yes' : 'No';
        console.log(`[SubdomainMiddleware] Method: ${req.method} | Path: ${req.path} | Host: ${host} | SID: ${req.sessionID} | Cookie: ${cookieLog} | User: ${userLog}`);
    }

    next();
};

module.exports = subdomainMiddleware;
