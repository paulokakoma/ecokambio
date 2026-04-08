const { currencyRepository } = require('../repositories');
const logger = require('../config/logger');

/**
 * Currency Service
 * Contém a lógica de negócio para moedas
 */
class CurrencyService {
    /**
     * Buscar todas as moedas
     */
    async getAllCurrencies() {
        try {
            return await currencyRepository.findAll({
                orderBy: 'name',
                orderDirection: 'asc'
            });
        } catch (error) {
            logger.error('Erro ao buscar moedas:', error);
            throw error;
        }
    }

    /**
     * Criar nova moeda
     */
    async createCurrency(data) {
        try {
            return await currencyRepository.create(data);
        } catch (error) {
            logger.error('Erro ao criar moeda:', error);
            throw error;
        }
    }

    /**
     * Atualizar moeda
     */
    async updateCurrency(id, data) {
        try {
            return await currencyRepository.update(id, data);
        } catch (error) {
            logger.error('Erro ao atualizar moeda:', error);
            throw error;
        }
    }

    /**
     * Eliminar moeda
     */
    async deleteCurrency(id) {
        try {
            return await currencyRepository.delete(id);
        } catch (error) {
            logger.error('Erro ao eliminar moeda:', error);
            throw error;
        }
    }
}

module.exports = new CurrencyService();
