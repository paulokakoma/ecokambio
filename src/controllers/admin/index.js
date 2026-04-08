/**
 * Admin Controllers Index
 * Exporta todos os controllers administrativos
 */

const providersController = require('./providers.controller');
const dashboardController = require('./dashboard.controller');
const affiliatesController = require('./affiliates.controller');
const supportersController = require('./supporters.controller');
const currenciesController = require('./currencies.controller');
const settingsController = require('./settings.controller');
const scraperAdminController = require('./scraperAdmin.controller');
const partnersController = require('./partners.controller');

module.exports = {
    // Providers
    getRateProviders: providersController.getRateProviders,
    handleResourcePost: providersController.handleResourcePost,
    deleteResource: providersController.deleteResource,
    addProvince: providersController.addProvince,
    updateStatus: providersController.updateStatus,
    updateCell: providersController.updateCell,

    // Dashboard
    getDashboardStats: dashboardController.getDashboardStats,
    getWeeklyActivity: dashboardController.getWeeklyActivity,
    getEventTypeStats: dashboardController.getEventTypeStats,
    getRecentActivity: dashboardController.getRecentActivity,
    resetStats: dashboardController.resetStats,

    // Affiliates
    getAffiliateLinks: affiliatesController.getAffiliateLinks,
    createAffiliate: affiliatesController.createAffiliate,
    updateAffiliate: affiliatesController.updateAffiliate,
    deleteAffiliate: affiliatesController.deleteAffiliate,

    // Supporters
    getSupporters: supportersController.getSupporters,
    createSupporter: supportersController.createSupporter,
    updateSupporter: supportersController.updateSupporter,
    deleteSupporter: supportersController.deleteSupporter,

    // Currencies
    getCurrencies: currenciesController.getCurrencies,
    createCurrency: currenciesController.createCurrency,
    updateCurrency: currenciesController.updateCurrency,
    deleteCurrency: currenciesController.deleteCurrency,

    // Settings
    getSettings: settingsController.getSettings,
    updateSettings: settingsController.updateSettings,
    updateInformalRates: settingsController.updateInformalRates,
    updateVisaSettings: settingsController.updateVisaSettings,

    // Scraper Admin
    triggerScraper: scraperAdminController.triggerScraper,
    triggerInformalScraper: scraperAdminController.triggerInformalScraper,
    getHealth: scraperAdminController.getHealth,
    getLastResults: scraperAdminController.getLastResults,
    notifyUpdate: scraperAdminController.notifyUpdate,

    // Partners
    trackPartnerClick: partnersController.trackPartnerClick,
    getPartnerClickStats: partnersController.getPartnerClickStats
};
