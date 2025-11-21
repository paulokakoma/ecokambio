const express = require("express");
const http = require("http");
const https = require("https"); // Importar o módulo https
const path = require("path");
const session = require("express-session");
const compression = require("compression");
const FileStore = require('session-file-store')(session);
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
const enforceHttps = require("./src/middleware/security");

// Routes
const authRoutes = require("./src/routes/authRoutes");
const publicRoutes = require("./src/routes/publicRoutes");
const adminRoutes = require("./src/routes/adminRoutes");
const viewRoutes = require("./src/routes/viewRoutes");

// Security Middleware
app.use(enforceHttps);
app.use(helmet({
    contentSecurityPolicy: false,
}));
app.use(compression()); // Enable Gzip compression

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api/', limiter); // Apply rate limiting to API routes

// Session Configuration
app.use(session({
    store: new FileStore({
        path: path.join(__dirname, 'sessions'),
        ttl: 30 * 24 * 60 * 60,
        logFn: function () { }
    }),
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

// Routes
app.use('/api', authRoutes);
app.use('/api', publicRoutes);
app.use('/api', adminRoutes);

// Health Check
app.get('/health', (req, res) => res.status(200).send('OK'));

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

// Start Server
server.listen(config.port, '0.0.0.0', () => {
    if (config.isDevelopment) {
        console.log(`Servidor a correr em desenvolvimento:`);
        console.log(`  📱 Página Principal: http://localhost:${config.port}`);
        console.log(`  🔐 Admin: http://admin.localhost:${config.port}`);
    } else {
        console.log(`Servidor a correr em produção na porta ${config.port}`);
    }
}).on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
        console.error(`\n❌ ERRO: A porta ${config.port} já está em uso.`);
        console.error('   Verifique se outra instância do servidor já não está a correr e tente novamente.');
        process.exit(1);
    }
});

module.exports = app;
