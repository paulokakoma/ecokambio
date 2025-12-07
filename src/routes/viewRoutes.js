const express = require('express');
const router = express.Router();
const viewController = require('../controllers/viewController');
const config = require('../config/env');

router.get("/", viewController.serveIndex);
router.get("/login", viewController.serveLogin);
router.get("/admin", viewController.serveAdmin);
router.get(config.admin.secretPath, viewController.serveAdminSecret);
router.get("/sobre", viewController.serveAbout);
router.get("/sobre-nos", viewController.serveAbout); // Alias
router.get("/visa", viewController.serveVisa);
router.get("/termos", viewController.serveTerms);
router.get("/termos-e-condicoes", viewController.serveTerms); // Alias
router.get("/privacidade", viewController.servePrivacy);
router.get("/fundadores", viewController.serveFounders);
router.get("/developers", viewController.serveDevelopers);
router.get("/api-docs", viewController.serveApiDocs);
router.get("/robots.txt", viewController.serveRobots);
router.get("/sitemap.xml", viewController.serveSitemap);
router.get("/BingSiteAuth.xml", viewController.serveBingAuth);
router.get("/yandex_*.html", viewController.serveYandexAuth);

// Blog routes
router.get("/blog", viewController.serveBlog);
router.get("/blog/:slug", viewController.serveBlogArticle);

module.exports = router;
