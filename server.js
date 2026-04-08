
const express = require("express");
const http = require("http");
const https = require("https"); // Importar o módulo https
const path = require("path");
const session = require("express-session");
const compression = require("compression");
const cookieParser = require("cookie-parser");
const app = express();
const websocket = require("./src/websocket");
const { initSentry, Sentry } = require('./src/config/sentry');
const { redisClient } = require('./src/config/redis');
const RedisStore = require('connect-redis').default;

// Initialize Sentry
initSentry();

// The request handler must be the first middleware on the app
app.use(Sentry.Handlers.requestHandler());
app.use(Sentry.Handlers.tracingHandler());

// Plataformas modernas gerem o SSL/TLS externamente.
// A nossa aplicação corre um servidor HTTP simples.
const server = http.createServer(app);

// Initialize WebSocket
websocket.init(server);


const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

// Config & Utils
const config = require("./src/config/env");
const logger = require("./src/config/logger");


// Middleware
const subdomainMiddleware = require("./src/middleware/subdomain");
const isAdmin = require("./src/middleware/auth");
const { errorHandler } = require("./src/middleware/errorHandler");

// Routes
const authRoutes = require("./src/routes/authRoutes");
const publicRoutes = require("./src/routes/publicRoutes");
const adminRoutes = require("./src/routes/adminRoutes");
const viewRoutes = require("./src/routes/viewRoutes");
const ecoflixRoutes = require("./src/netflix/routes");

// Scraper
const scraperController = require("./src/controllers/scraperController");



// Security Middleware
// app.use(enforceHttps);
app.use(helmet({
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
                "https://www.google-analytics.com"
            ],
            frameSrc: [
                "'self'",
                "https://www.google.com"
            ],
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
}));
app.use(compression()); // Enable Gzip compression
app.use(cookieParser(config.session.secret)); // Parse signed cookies
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Limit each IP to 1000 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
})

    ;
// Legacy rate limiter for old API routes
app.use('/api/', limiter);

// Trust the first proxy (Cloudflare)
// Required for secure cookies to work correctly behind a proxy
app.set('trust proxy', 1);

// Apply subdomain middleware early to detect admin.localhost vs localhost
app.use(subdomainMiddleware);

// Configuração de Sessão
let sessionStore;

if (!process.env.REDIS_URL) {
    // Sem variável Redis (mesmo em Produção): Utiliza sistema de ficheiros para guardar sessões
    const FileStore = require("session-file-store")(session);
    sessionStore = new FileStore({
        path: './sessions',
        ttl: 30 * 24 * 60 * 60, // Duração da sessão: 30 dias
        retries: 0
    });
    logger.info('📁 A utilizar FileStore para gestão de sessões');
} else {
    // Produção ou Desenvolvimento com Redis: Utiliza Redis para escalar as sessões de forma robusta
    sessionStore = new RedisStore({
        client: redisClient,
        prefix: 'ecokambio:sess:', // Prefixo para identificar os dados da aplicação no Redis
    });
    logger.info('✅ A utilizar Redis para gestão de sessões');
}


app.use(session({
    store: sessionStore,
    secret: config.session.secret,
    resave: true,
    saveUninitialized: true,
    rolling: true,
    cookie: {
        secure: !config.isDevelopment,
        httpOnly: true,
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        sameSite: 'lax',
        domain: config.isDevelopment ? undefined : config.session.cookieDomain
    }
}));

// Static Files with Optimized Caching Strategy
// Images: 1 year (immutable, versioned by filename)
// CSS/JS: 7 days (can change with updates)
// HTML: no-cache (always get fresh content)

// Serve images with long-term caching
app.use('/assets', express.static(path.join(__dirname, 'public/assets'), {
    index: false,
    maxAge: '365d', // 1 year
    immutable: true,
    etag: true,
    setHeaders: (res, filepath) => {
        // Images are immutable and can be cached for a long time
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
}));

// Serve CSS and JS with medium-term caching
app.use('/css', express.static(path.join(__dirname, 'public/css'), {
    index: false,
    maxAge: '7d',
    etag: true,
    setHeaders: (res, filepath) => {
        res.setHeader('Cache-Control', 'public, max-age=604800'); // 7 days
    }
}));

app.use('/js', express.static(path.join(__dirname, 'public/js'), {
    index: false,
    maxAge: '7d',
    etag: true,
    setHeaders: (res, filepath) => {
        res.setHeader('Cache-Control', 'public, max-age=604800'); // 7 days
    }
}));

// Disable cache for exchange_rates.json to always get fresh data
app.get('/exchange_rates.json', (req, res, next) => {
    res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Surrogate-Control': 'no-store'
    });
    next();
});

// Serve other static files with default caching
const defaultStaticOptions = {
    index: false,
    maxAge: '1d',
    etag: true
};

app.use(express.static("public", defaultStaticOptions));
app.use('/admin/assets', isAdmin, express.static(path.join(__dirname, 'private'), defaultStaticOptions));

// EcoFlix Module Static Files
app.use('/netflix', express.static(path.join(__dirname, 'src/netflix/public'), {
    index: ['index.html'],
    maxAge: config.isDevelopment ? '0' : '1d'
}));

// ============================================================================
// SEGURANÇA: Desativar cache em páginas de administração
// Isto evita que dispositivos/redes memorizem dados sensíveis de acesso.
// ============================================================================
const noCacheHeaders = (req, res, next) => {
    res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, private',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Surrogate-Control': 'no-store'
    });
    next();
};

// Aplicar não-cache a todos os caminhos que exigem login/visão de administrador
app.use('/login', noCacheHeaders);
app.use('/login.html', noCacheHeaders);
app.use('/admin', noCacheHeaders);
app.use('/netflix/adminflix.html', noCacheHeaders);
app.use('/api/ecoflix/admin', noCacheHeaders);

// Rota para a página "Sobre"
app.get('/sobre', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'sobre.html'));
});

// View Routes - handles all page rendering
app.use('/', viewRoutes);

//=============================================================================
// API ROUTES
//=============================================================================

// API v1 - New standardized API with middleware
const apiResponse = require('./src/middleware/apiResponse');
const apiKeyAuth = require('./src/middleware/apiKeyAuth');
const apiV1Routes = require('./src/routes/api/v1/index');

// Apply API response middleware and optional API key auth to all /api/v1 routes
// The API key auth is optional - it doesn't block requests without a key
// but it enables higher rate limits for those who have one
app.use('/api/v1', apiResponse, apiKeyAuth.optional, apiV1Routes);

// Claude AI Proxy (no rate limit for better UX)


// Legacy API routes - kept for backwards compatibility
// These will redirect to v1 endpoints where possible
app.get('/api/informal-rates', async (req, res, next) => {
    // Forward to v1 endpoint
    req.url = '/api/v1/rates/informal';
    next('route');
});

// API Route for Frontend Configuration (legacy)
app.get('/api/config', (req, res) => {
    res.json({
        supabaseUrl: config.supabase.url,
        supabaseAnonKey: config.supabase.anonKey
    });
});

// Rotas da API (Legado)
app.use("/api", authRoutes); // Contém /login, /logout, etc. Não deve ter `isAdmin` aqui.
app.use("/api", publicRoutes); // Rotas públicas, sem `isAdmin`.

// Rotas de API para o Scraper (Público)
// Usado para saber a saúde e o último sucesso do robô que busca os valores.
app.get("/api/scraper/health", scraperController.getHealth);
app.get("/api/scraper/last-results", scraperController.getLastResults);

// Rotas de API para o Scraper (Protegido - Apenas Admin)
app.post("/api/scraper/trigger", isAdmin, scraperController.triggerScraper);

// Módulo EcoFlix (Rotas API partilhadas de uso misto, o próprio módulo trata a segurança)
app.use("/api/ecoflix", ecoflixRoutes);

// Integração Google Sheets - Exportação (Requer Token específico antes das regras normais do Admin)
const adminController = require('./src/controllers/adminController');
app.get('/api/admin/export-sales-auto', adminController.exportSalesAuto);

// Rotas exclusivas de Admin (Globais e protegidas pelo Middleware `isAdmin`)
app.use("/api", isAdmin, adminRoutes);


// Health Check - Enhanced for Fly.io monitoring
app.get('/health', async (req, res) => {
    const healthcheck = {
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: config.nodeEnv,
        version: require('./package.json').version || '1.0.0'
    };

    // Optional: Check Supabase connectivity
    if (req.query.detailed === 'true') {
        try {
            const supabase = require('./src/config/supabase');
            const { error } = await supabase.from('exchange_rates').select('count').limit(1);
            healthcheck.database = error ? 'disconnected' : 'connected';
        } catch (err) {
            healthcheck.database = 'error';
        }
    }

    res.status(200).json(healthcheck);
});

// View Routes - handles subdomain routing
// A lógica de servir os ficheiros principais (index.html vs admin.html)
// é movida diretamente para cá para ser mais explícita e segura.
app.get('*', (req, res, next) => {
    // Se for uma rota de API, ignora e passa para o próximo handler (404)
    if (req.path.startsWith('/api/')) {
        return next();
    }

    if (req.isAdminSubdomain) {
        // Se for subdomínio de admin, verifica se está logado.
        // Se não estiver e não for a página de login, redireciona.
        if (!req.session.user && req.path !== '/login.html') {
            return res.redirect('/login.html');
        }
        // SECURITY: Prevent caching of admin pages
        res.set({
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, private',
            'Pragma': 'no-cache',
            'Expires': '0'
        });
        res.sendFile(path.join(__dirname, 'private', 'admin.html'));
    } else {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    }
});



// 404 Handler - Catch all unhandled requests
app.use((req, res, next) => {
    const host = req.get('host');
    console.log(`[404] Recurso não encontrado: ${req.method} ${req.originalUrl} | Host: ${host}`);

    if (req.accepts('html')) {
        res.status(404).send(`
            <html>
                <head><title>404 - Página Não Encontrada</title></head>
                <body style="font-family: sans-serif; text-align: center; padding: 50px;">
                    <h1>404 - Página Não Encontrada</h1>
                    <p>O recurso que procura não existe nesta aplicação.</p>
                    <p><small>Host: ${host} | Path: ${req.originalUrl}</small></p>
                    <a href="/">Voltar à Página Inicial</a>
                </body>
            </html>
        `);
    } else if (req.accepts('json')) {
        res.status(404).json({ error: 'Not Found', path: req.originalUrl });
    } else {
        res.status(404).type('txt').send('Not Found');
    }
});

// The error handler must be before any other error middleware and after all controllers
app.use(Sentry.Handlers.errorHandler());

// Error Handling Middleware - Deve ser o último middleware
app.use(errorHandler);

// EcoFlix Queues (Producers)
if (process.env.REDIS_URL) {
    require('./src/netflix/services/queue.service');
    require('./src/netflix/services/sms_queue.service');
} else {
    logger.info('⚠️ REDIS_URL não definida: Sistema de filas EcoFlix (BullMQ) desativado no servidor web.');
}

// Scheduler
const scheduler = require('./webscraper/scheduler');

// Inicializador da Aplicação / Arranque do Servidor
// Impede execução se este for importado apenas como módulo de teste
if (require.main === module) {
    server.listen(config.port, '0.0.0.0', () => {
        logger.info(`✅ Servidor a correr na porta ${config.port}`);
        logger.info(`   Ambiente: ${config.isDevelopment ? 'Desenvolvimento' : 'Produção'}`);

        // NOTA: O agendamento via node-cron foi desativado. 
        // Em produção, o web scraping está a ser gerido exclusivamente pelo Supercronic (Docker)
        // que lê o ficheiro 'crontab' na raiz do projeto.
        logger.info('📅 Agendamento via node-cron desativado (Gerido pelo Supercronic)');

        if (config.isDevelopment) {
            logger.info(`Rotas Locais Ativas:`);
            logger.info(`  📱 Plataforma EcoKambio: http://localhost:${config.port}`);
            logger.info(`  🔐 Painel Administrativo: http://admin.localhost:${config.port}`);
            logger.info('   Use também o comando: npm run scrape para testar o scraping fora do horário.');
        }
    }).on('error', (e) => {
        // Deteta colisão de portos (Se o terminal já tiver outro processo ativado na mesma porta)
        if (e.code === 'EADDRINUSE') {
            console.error(`\n❌ ERRO FATAL: A porta ${config.port} encontra-se ocupada!`);
            console.error('   Verifique se outro processo da aplicação está já a utilizar esta porta do computador.');
            process.exit(1);
        }
    });
}

module.exports = app;
