const express = require('express');
const router = express.Router();
const path = require('path');
const config = require('../../src/config/env');

// ============================================================================
// SEGURANÇA: Desativar cache em páginas de administração
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

// Serve o frontend React
router.use('/', express.static(path.join(__dirname, '../frontend/dist'), {
    index: ['index.html'],
    maxAge: config.isDevelopment ? '0' : '1d'
}));

// Rota fallback para o React Router na Home
router.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend/dist", "index.html"));
});

// Arquivos Estáticos do Admin (assets e afins do painel antigo)
router.use('/admin', express.static(path.join(__dirname, 'public'), {
    index: false,
    maxAge: config.isDevelopment ? '0' : '1d',
    etag: true,
    lastModified: true
}));

// Rota protegida para o Painel Admin do EcoFlix
router.get("/admin", noCacheHeaders, (req, res) => {
    // Check signed cookie for admin authentication
    if (req.signedCookies.admin_auth !== 'true') {
        return res.redirect('/ecoflix/login?redirect=/ecoflix/admin');
    }
    res.sendFile(path.join(__dirname, "public", "adminflix.html"));
});

// Rota para a página de Login própria do EcoFlix
router.get("/login", noCacheHeaders, (req, res) => {
    // Se já estiver logado, vai direto para o admin
    if (req.signedCookies.admin_auth === 'true') {
        return res.redirect('/ecoflix/admin');
    }
    res.sendFile(path.join(__dirname, "public", "login.html"));
});

module.exports = router;
