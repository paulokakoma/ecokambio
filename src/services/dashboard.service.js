const { exchangeRateRepository, activityLogRepository, partnerClickRepository } = require('../repositories');
const logger = require('../config/logger');

/**
 * Dashboard Service
 * Contém a lógica de negócio para estatísticas e dashboard
 */
class DashboardService {
    /**
     * Obter estatísticas do dashboard
     */
    async getStats() {
        try {
            const lastUpdate = await exchangeRateRepository.findLastUpdate();

            return {
                lastUpdate,
                hasData: !!lastUpdate,
                hoursSinceUpdate: lastUpdate
                    ? Math.floor((Date.now() - new Date(lastUpdate).getTime()) / (1000 * 60 * 60))
                    : null
            };
        } catch (error) {
            logger.error('Erro ao buscar estatísticas:', error);
            throw error;
        }
    }

    /**
     * Obter atividade semanal
     */
    async getWeeklyActivity() {
        try {
            const activity = await activityLogRepository.findWeeklyActivity();

            // Agrupar por dia
            const groupedByDay = activity.reduce((acc, log) => {
                const date = new Date(log.created_at).toISOString().split('T')[0];
                if (!acc[date]) {
                    acc[date] = 0;
                }
                acc[date]++;
                return acc;
            }, {});

            // Preencher os últimos 7 dias
            const result = [];
            for (let i = 6; i >= 0; i--) {
                const date = new Date();
                date.setDate(date.getDate() - i);
                const dateStr = date.toISOString().split('T')[0];
                result.push({
                    date: dateStr,
                    count: groupedByDay[dateStr] || 0
                });
            }

            return result;
        } catch (error) {
            logger.error('Erro ao buscar atividade semanal:', error);
            throw error;
        }
    }

    /**
     * Obter estatísticas de tipos de eventos
     */
    async getEventTypeStats() {
        try {
            return await activityLogRepository.countByEventType();
        } catch (error) {
            logger.error('Erro ao buscar estatísticas de eventos:', error);
            throw error;
        }
    }

    /**
     * Obter atividade recente
     */
    async getRecentActivity(limit = 50) {
        try {
            return await activityLogRepository.findRecent(limit);
        } catch (error) {
            logger.error('Erro ao buscar atividade recente:', error);
            throw error;
        }
    }

    /**
     * Obter estatísticas de clicks em parceiros
     */
    async getPartnerClickStats() {
        try {
            return await partnerClickRepository.findStats();
        } catch (error) {
            logger.error('Erro ao buscar estatísticas de parceiros:', error);
            throw error;
        }
    }

    /**
     * Limpar estatísticas
     */
    async clearStats() {
        try {
            return await activityLogRepository.clearOld();
        } catch (error) {
            logger.error('Erro ao limpar estatísticas:', error);
            throw error;
        }
    }
}

module.exports = new DashboardService();
