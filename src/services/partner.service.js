const { partnerClickRepository } = require('../repositories');
const logger = require('../config/logger');

/**
 * Partner Service
 * Contém a lógica de negócio para parceiros
 */
class PartnerService {
    /**
     * Registrar click em parceiro
     */
    async trackClick(partnerId) {
        try {
            return await partnerClickRepository.incrementClick(partnerId);
        } catch (error) {
            logger.error('Erro ao registrar click:', error);
            throw error;
        }
    }

    /**
     * Buscar estatísticas de clicks
     */
    async getClickStats() {
        try {
            return await partnerClickRepository.findStats();
        } catch (error) {
            logger.error('Erro ao buscar estatísticas de clicks:', error);
            throw error;
        }
    }
}

module.exports = new PartnerService();
