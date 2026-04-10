/**
 * Server Configuration Module
 * Centraliza configuração do servidor Express
 */

const express = require("express");
const http = require("http");
const path = require("path");
const session = require("express-session");
const compression = require("compression");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const RedisStore = require('connect-redis').default;
const FileStore = require("session-file-store")(session);

const config = require("./env");
const logger = require("./logger");
const { redisClient } = require("./redis");
const websocket = require("../websocket");
const { initSentry, Sentry } = require('./sentry');

/**
 * Create and configure Express app
 */
function createApp() {
    // Initialize Sentry
    initSentry();

    const app = express();
    const server = http.createServer(app);

    // Sentry handlers (must be first)
    app.use(Sentry.Handlers.requestHandler());
    app.use(Sentry.Handlers.tracingHandler());

    // Initialize WebSocket
    websocket.init(server);

    // Security middleware
    app.use(helmet(getHelmetConfig()));
    app.use(compression());
    app.use(cookieParser(config.session.secret));
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // Rate limiting
    const limiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 1000,
        standardHeaders: true,
        legacyHeaders: false,
    });
    app.use('/api/', limiter);

    // Trust first proxy (Cloudflare)
    app.set('trust proxy', 1);

    // Session configuration
    app.use(session(getSessionConfig()));

    // Static files with optimized caching
    setupStaticFiles(app);

    // No-cache headers for sensitive pages
    setupNoCacheRoutes(app);

    return { app, server };
}

/**
 * Helmet security configuration
 */
function getHelmetConfig() {
    return {
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: [
                    "'self'",
                    "'unsafe-inline'",
                    "'unsafe-eval'",
                    "https://cdn.jsdelivr.net",
                    "https://cdn.tailwindcss.com",
                    "https://www.googletagmanager.com",
                    "https://www.google-analytics.com",
                    "https://www.google.com"
                ],
                scriptSrcAttr: ["'unsafe-hashes'", "'unsafe-inline'"],
                styleSrc: [
                    "'self'",
                    "'unsafe-inline'",
                    "https://fonts.googleapis.com",
                    "https://cdnjs.cloudflare.com"
                ],
                fontSrc: [
                    "'self'",
                    "https://fonts.gstatic.com",
                    "https://cdnjs.cloudflare.com"
                ],
                imgSrc: [
                    "'self'",
                    "data:",
                    "https:",
                    "https://www.google-analytics.com",
                    "https://www.google.com"
                ],
                connectSrc: [
                    "'self'",
                    "https://drkjkkpzujwnkghtdokz.supabase.co",
                    "https://www.google-analytics.com",
                    "https://cdn.jsdelivr.net"
                ],
                frameSrc: ["'self'", "https://www.google.com"],
                childSrc: ["'self'"],
                objectSrc: ["'none'"],
                upgradeInsecureRequests: config.isDevelopment ? null : []
            },
        },
        hsts: config.isDevelopment ? false : {
            maxAge: 31536000,
            includeSubDomains: true,
            preload: true
        }
    };
}

/**
 * Session store configuration
 */
function getSessionConfig() {
    let sessionStore;

    if (!process.env.REDIS_URL) {
        sessionStore = new FileStore({
            path: './sessions',
            ttl: 30 * 24 * 60 * 60,
            retries: 0
        });
        logger.info('📁 A utilizar FileStore para gestão de sessões');
    } else {
        sessionStore = new RedisStore({
            client: redisClient,
            prefix: 'ecokambio:sess:',
        });
        logger.info('✅ A utilizar Redis para gestão de sessões');
    }

    return {
        store: sessionStore,
        secret: config.session.secret,
        resave: true,
        saveUninitialized: true,
        rolling: true,
        cookie: {
            secure: !config.isDevelopment,
            httpOnly: true,
            maxAge: 30 * 24 * 60 * 60 * 1000,
            sameSite: 'lax',
            domain: config.isDevelopment ? undefined : config.session.cookieDomain
        }
    };
}

/**
 * Static files configuration with caching strategy
 */
function setupStaticFiles(app) {
    const staticOptions = {
        index: false,
        maxAge: '1d',
        etag: true
    };

    // Images: 1 year (immutable)
    app.use('/assets', express.static(path.join(__dirname, '../../public/assets'), {
        index: false,
        maxAge: '365d',
        immutable: true,
        etag: true,
        setHeaders: (res) => {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
    }));

    // CSS/JS: 7 days
    app.use('/css', express.static(path.join(__dirname, '../../public/css'), {
        index: false,
        maxAge: '7d',
        etag: true,
        setHeaders: (res) => {
            res.setHeader('Cache-Control', 'public, max-age=604800');
        }
    }));

    app.use('/js', express.static(path.join(__dirname, '../../public/js'), {
        index: false,
        maxAge: '7d',
        etag: true,
        setHeaders: (res) => {
            res.setHeader('Cache-Control', 'public, max-age=604800');
        }
    }));

    // Disable cache for exchange_rates.json
    app.get('/exchange_rates.json', (req, res, next) => {
        res.set({
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
            'Surrogate-Control': 'no-store'
        });
        next();
    });

    // Default static files
    app.use(express.static("public", staticOptions));
    app.use('/admin/assets', express.static(path.join(__dirname, '../../private'), staticOptions));

    // EcoFlix static files
    app.use('/netflix', express.static(path.join(__dirname, '../../src/netflix/public'), {
        index: ['index.html'],
        maxAge: config.isDevelopment ? '0' : '1d'
    }));
}

/**
 * No-cache headers for sensitive routes
 */
function setupNoCacheRoutes(app) {
    const noCacheHeaders = (req, res, next) => {
        res.set({
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, private',
            'Pragma': 'no-cache',
            'Expires': '0',
            'Surrogate-Control': 'no-store'
        });
        next();
    };

    app.use('/login', noCacheHeaders);
    app.use('/login.html', noCacheHeaders);
    app.use('/admin', noCacheHeaders);
    app.use('/netflix/adminflix.html', noCacheHeaders);
    app.use('/api/ecoflix/admin', noCacheHeaders);
}

/**
 * Start server
 */
function startServer(server, port) {
    return new Promise((resolve, reject) => {
        server.listen(port, '0.0.0.0', (err) => {
            if (err) {
                if (err.code === 'EADDRINUSE') {
                    console.error(`❌ ERRO FATAL: A porta ${port} encontra-se ocupada!`);
                    process.exit(1);
                }
                reject(err);
                return;
            }

            logger.info(`✅ Servidor a correr na porta ${port}`);
            logger.info(`   Ambiente: ${config.isDevelopment ? 'Desenvolvimento' : 'Produção'}`);
            logger.info('📅 Agendamento via node-cron desativado (Gerido pelo Supercronic)');

            if (config.isDevelopment) {
                logger.info('📱 Plataforma EcoKambio: http://localhost:' + port);
                logger.info('🔐 Painel Administrativo: http://admin.localhost:' + port);
                logger.info('   Use: npm run scrape para testar scraping fora do horário.');
            }

            resolve(server);
        });
    });
}

module.exports = {
    createApp,
    startServer
};
