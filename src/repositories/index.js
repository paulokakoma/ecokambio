/**
 * Index file for repositories
 * Centraliza todas as exportações de repositories
 */

const BaseRepository = require('./base.repository');
const rateProviderRepository = require('./rateProvider.repository');
const affiliateLinkRepository = require('./affiliateLink.repository');
const supporterRepository = require('./supporter.repository');
const currencyRepository = require('./currency.repository');
const settingsRepository = require('./settings.repository');
const exchangeRateRepository = require('./exchangeRate.repository');
const activityLogRepository = require('./activityLog.repository');
const partnerClickRepository = require('./partnerClick.repository');

module.exports = {
    BaseRepository,
    rateProviderRepository,
    affiliateLinkRepository,
    supporterRepository,
    currencyRepository,
    settingsRepository,
    exchangeRateRepository,
    activityLogRepository,
    partnerClickRepository
};
