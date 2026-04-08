const { affiliateLinkRepository } = require('../repositories');
const logger = require('../config/logger');

/**
 * Affiliate Link Service
 * Contém a lógica de negócio para links de afiliados
 */
class AffiliateLinkService {
    /**
     * Buscar todos os links
     */
    async getAllLinks() {
        try {
            return await affiliateLinkRepository.findAllOrdered();
        } catch (error) {
            logger.error('Erro ao buscar links de afiliados:', error);
            throw error;
        }
    }

    /**
     * Criar novo link
     */
    async createLink(data) {
        try {
            return await affiliateLinkRepository.create(data);
        } catch (error) {
            logger.error('Erro ao criar link de afiliado:', error);
            throw error;
        }
    }

    /**
     * Atualizar link
     */
    async updateLink(id, data) {
        try {
            return await affiliateLinkRepository.update(id, data);
        } catch (error) {
            logger.error('Erro ao atualizar link de afiliado:', error);
            throw error;
        }
    }

    /**
     * Eliminar link
     */
    async deleteLink(id) {
        try {
            return await affiliateLinkRepository.delete(id);
        } catch (error) {
            logger.error('Erro ao eliminar link de afiliado:', error);
            throw error;
        }
    }
}

module.exports = new AffiliateLinkService();
