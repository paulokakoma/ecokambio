
const express = require("express");
const http = require("http");
const https = require("https"); // Importar o módulo https
const path = require("path");
const session = require("express-session");
const compression = require("compression");
const cookieParser = require("cookie-parser");
const app = express();
const websocket = require("./src/websocket");

// O Railway (e outras plataformas modernas) gere o SSL/TLS externamente.
// A nossa aplicação deve sempre correr um servidor HTTP simples.
const server = http.createServer(app);

// Initialize WebSocket
websocket.init(server);

const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

// Config & Utils
const config = require("./src/config/env");

// Middleware
const subdomainMiddleware = require("./src/middleware/subdomain");
const isAdmin = require("./src/middleware/auth");

// Routes
const authRoutes = require("./src/routes/authRoutes");
const publicRoutes = require("./src/routes/publicRoutes");
const adminRoutes = require("./src/routes/adminRoutes");
const viewRoutes = require("./src/routes/viewRoutes");

// Scraper
const scraperController = require("./src/controllers/scraperController");

// Middleware para forçar HTTPS removido
// const enforceHttps = ...

// Security Middleware
// app.use(enforceHttps);
console.log("SERVER STARTED - NO HTTPS ENFORCEMENT");
app.use(helmet({
    contentSecurityPolicy: false,
}));
app.use(compression()); // Enable Gzip compression
app.use(cookieParser(config.session.secret)); // Parse signed cookies
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api/', limiter); // Apply rate limiting to API routes

// Trust the first proxy (Railway/Cloudflare)
// Required for secure cookies to work correctly behind a proxy
app.set('trust proxy', 1);

// Session Configuration
// Use MemoryStore for serverless/Vercel, FileStore for local development
let sessionStore;
if (process.env.VERCEL || !config.isDevelopment) {
    // In Vercel or production, use default MemoryStore (session data in memory)
    sessionStore = undefined;
} else {
    // In local development, use FileStore
    const FileStore = require("session-file-store")(session);
    sessionStore = new FileStore({
        path: './sessions',
        ttl: 30 * 24 * 60 * 60, // 30 days
        retries: 0
    });
}

app.use(session({
    store: sessionStore,
    secret: config.session.secret,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
        secure: !config.isDevelopment,
        httpOnly: true,
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        sameSite: 'lax',
        domain: config.isDevelopment ? undefined : config.session.cookieDomain
    }
}));

// Static Files with Caching
const staticOptions = {
    index: false,
    maxAge: '1d', // Cache static files for 1 day
    etag: true
};

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

app.use(express.static("public", staticOptions));
app.use('/admin/assets', isAdmin, express.static(path.join(__dirname, 'private'), staticOptions));

// API Route for Frontend Configuration
// Esta rota fornece as chaves públicas necessárias para o frontend inicializar o Supabase.
app.get('/api/config', (req, res) => {
    res.json({
        supabaseUrl: config.supabase.url,
        supabaseAnonKey: config.supabase.anonKey
    });
});

// Apply subdomain middleware to detect admin.localhost vs localhost
app.use(subdomainMiddleware);

// API Routes
app.use("/api", authRoutes);
app.use("/api", publicRoutes);

// Scraper API Routes (Public)
app.get("/api/scraper/health", scraperController.getHealth);
app.get("/api/scraper/last-results", scraperController.getLastResults);

// Scraper API Routes (Protected)
app.post("/api/scraper/trigger", isAdmin, scraperController.triggerScraper);

// Admin API Routes (Protected)
app.use("/api", isAdmin, adminRoutes);

// Health Check
app.get('/health', (req, res) => res.status(200).send('OK'));

// View Routes - handles subdomain routing
app.use('/', viewRoutes);

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

// Scheduler
const scheduler = require('./webscraper/scheduler');

// Start Server
server.listen(config.port, '0.0.0.0', () => {
    console.log(`✅ Server running on port ${config.port}`);
    console.log(`   Environment: ${config.isDevelopment ? 'Development' : 'Production'}`);

    // Start scraper scheduler in production
    if (!config.isDevelopment) {
        try {
            const scraperScheduler = require('./webscraper/scheduler');
            scraperScheduler.start();
            console.log('📅 Scraper scheduler started (runs every 4 hours)');
        } catch (error) {
            console.error('⚠️  Failed to start scraper scheduler:', error.message);
        }
    } else {
        console.log('ℹ️  Scraper scheduler disabled in development mode');
        console.log('   Use: npm run scrape to test manually');
        console.log(`Servidor a correr em desenvolvimento:`);
        console.log(`  📱 Página Principal: http://localhost:${config.port}`);
        console.log(`  🔐 Admin: http://admin.localhost:${config.port}`);
    }
}).on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
        console.error(`\n❌ ERRO: A porta ${config.port} já está em uso.`);
        console.error('   Verifique se outra instância do servidor já não está a correr e tente novamente.');
        process.exit(1);
    }
});

module.exports = app;
