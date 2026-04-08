/**
 * Index file for services
 * Centraliza todas as exportações de services
 */

const rateProviderService = require('./rateProvider.service');
const dashboardService = require('./dashboard.service');
const affiliateLinkService = require('./affiliateLink.service');
const supporterService = require('./supporter.service');
const currencyService = require('./currency.service');
const settingsService = require('./settings.service');
const partnerService = require('./partner.service');
const scraperService = require('./scraper.service');

module.exports = {
    rateProviderService,
    dashboardService,
    affiliateLinkService,
    supporterService,
    currencyService,
    settingsService,
    partnerService,
    scraperService
};
