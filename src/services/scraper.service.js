const { exchangeRateRepository } = require('../repositories');
const { broadcast } = require('../websocket');
const logger = require('../config/logger');

/**
 * Scraper Service
 * Contém a lógica de negócio para o scraper
 */
class ScraperService {
    /**
     * Obter estado de saúde do scraper
     */
    async getHealthStatus() {
        try {
            const lastUpdate = await exchangeRateRepository.findLastUpdate();
            const now = new Date();

            let hoursSinceLastRun = null;
            if (lastUpdate) {
                hoursSinceLastRun = (now - new Date(lastUpdate)) / (1000 * 60 * 60);
            }

            // Contar taxas na janela temporal
            let totalRates = 0;
            if (lastUpdate) {
                const timeWindowStart = new Date(lastUpdate.getTime() - 5 * 60000).toISOString();
                const timeWindowEnd = new Date(lastUpdate.getTime() + 5 * 60000).toISOString();
                totalRates = await exchangeRateRepository.countInTimeWindow(timeWindowStart, timeWindowEnd);
            }

            // Determinar estado
            let status = 'unknown';
            if (!lastUpdate) {
                status = 'never_run';
            } else if (hoursSinceLastRun < 5) {
                status = 'healthy';
            } else if (hoursSinceLastRun < 24) {
                status = 'stale';
            } else {
                status = 'error';
            }

            return {
                status,
                lastRun: lastUpdate,
                hoursSinceLastRun: hoursSinceLastRun ? parseFloat(hoursSinceLastRun.toFixed(2)) : null,
                totalRates,
                message: this._getStatusMessage(status, hoursSinceLastRun)
            };
        } catch (error) {
            logger.error('Erro ao obter estado do scraper:', error);
            throw error;
        }
    }

    /**
     * Obter últimos resultados
     */
    async getLastResults() {
        try {
            const lastUpdate = await exchangeRateRepository.findLastUpdate();
            return {
                lastUpdate,
                success: !!lastUpdate
            };
        } catch (error) {
            logger.error('Erro ao obter últimos resultados:', error);
            throw error;
        }
    }

    /**
     * Notificar atualização via WebSocket
     */
    notifyUpdate() {
        try {
            broadcast({
                type: 'rates_updated',
                timestamp: new Date().toISOString()
            });
            return true;
        } catch (error) {
            logger.error('Erro ao notificar atualização:', error);
            return false;
        }
    }

    /**
     * Mensagem de estado
     */
    _getStatusMessage(status, hoursSinceLastRun) {
        const messages = {
            never_run: 'O scraper ainda não foi executado.',
            healthy: 'O scraper está funcionando corretamente.',
            stale: `O scraper não atualiza há ${Math.floor(hoursSinceLastRun)} horas.`,
            error: `O scraper não atualiza há mais de 24 horas. Verifique o sistema.`,
            unknown: 'Estado desconhecido.'
        };
        return messages[status] || messages.unknown;
    }
}

module.exports = new ScraperService();
