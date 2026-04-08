const { supporterRepository } = require('../repositories');
const logger = require('../config/logger');

/**
 * Supporter Service
 * Contém a lógica de negócio para apoiadores
 */
class SupporterService {
    /**
     * Buscar todos os apoiadores
     */
    async getAllSupporters() {
        try {
            return await supporterRepository.findAllOrdered();
        } catch (error) {
            logger.error('Erro ao buscar apoiadores:', error);
            throw error;
        }
    }

    /**
     * Criar novo apoiador
     */
    async createSupporter(data) {
        try {
            return await supporterRepository.create(data);
        } catch (error) {
            logger.error('Erro ao criar apoiador:', error);
            throw error;
        }
    }

    /**
     * Atualizar apoiador
     */
    async updateSupporter(id, data) {
        try {
            return await supporterRepository.update(id, data);
        } catch (error) {
            logger.error('Erro ao atualizar apoiador:', error);
            throw error;
        }
    }

    /**
     * Eliminar apoiador
     */
    async deleteSupporter(id) {
        try {
            return await supporterRepository.delete(id);
        } catch (error) {
            logger.error('Erro ao eliminar apoiador:', error);
            throw error;
        }
    }
}

module.exports = new SupporterService();
