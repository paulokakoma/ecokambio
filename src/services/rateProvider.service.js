const { rateProviderRepository } = require('../repositories');
const logger = require('../config/logger');

/**
 * Rate Provider Service
 * Contém a lógica de negócio para provedores de taxas de câmbio
 */
class RateProviderService {
    /**
     * Parse de taxas com vários formatos de locale
     */
    parseRate(value) {
        if (value === null || value === undefined) return null;

        let str = String(value).trim();
        // Remove caracteres não numéricos exceto . e ,
        str = str.replace(/[^0-9.,-]+/g, '');

        if (!str) return null;

        // Lógica para determinar separador decimal vs milhar
        if (str.includes('.') && str.includes(',')) {
            const lastDotIndex = str.lastIndexOf('.');
            const lastCommaIndex = str.lastIndexOf(',');

            if (lastDotIndex > lastCommaIndex) {
                str = str.replace(/,/g, '');
            } else {
                str = str.replace(/\./g, '').replace(',', '.');
            }
        } else if (str.includes(',')) {
            str = str.replace(',', '.');
        }

        const num = parseFloat(str);
        return isNaN(num) ? null : num;
    }

    /**
     * Formatar provedores com taxas calculadas
     */
    formatProvidersWithRates(providers) {
        return providers.map(provider => {
            const rates = provider.exchange_rates || [];
            const usdRate = this.parseRate(rates.find(r => r.currency_pair === 'USD/AOA')?.sell_rate);
            const eurRate = this.parseRate(rates.find(r => r.currency_pair === 'EUR/AOA')?.sell_rate);
            const usdtRate = this.parseRate(rates.find(r => r.currency_pair === 'USDT/AOA')?.sell_rate);

            // Determinar last_updated
            let lastUpdated = null;
            if (rates.length > 0) {
                const sortedRates = [...rates].sort((a, b) =
                    new Date(b.updated_at) - new Date(a.updated_at));
                if (sortedRates[0].updated_at) {
                    lastUpdated = sortedRates[0].updated_at;
                }
            }

            // Remover exchange_rates do objeto retornado
            const { exchange_rates, ...providerWithoutRates } = provider;

            return {
                ...providerWithoutRates,
                usd_rate: usdRate || null,
                eur_rate: eurRate || null,
                usdt_rate: usdtRate || null,
                last_updated: lastUpdated
            };
        });
    }

    /**
     * Buscar provedores por tipo
     */
    async getProvidersByType(type) {
        try {
            const providers = await rateProviderRepository.findWithRates(type);
            return this.formatProvidersWithRates(providers);
        } catch (error) {
            logger.error('Erro ao buscar provedores:', error);
            throw error;
        }
    }

    /**
     * Criar novo provedor
     */
    async createProvider(data) {
        try {
            return await rateProviderRepository.create(data);
        } catch (error) {
            logger.error('Erro ao criar provedor:', error);
            throw error;
        }
    }

    /**
     * Atualizar provedor
     */
    async updateProvider(id, data) {
        try {
            return await rateProviderRepository.update(id, data);
        } catch (error) {
            logger.error('Erro ao atualizar provedor:', error);
            throw error;
        }
    }

    /**
     * Eliminar provedor
     */
    async deleteProvider(id) {
        try {
            return await rateProviderRepository.delete(id);
        } catch (error) {
            logger.error('Erro ao eliminar provedor:', error);
            throw error;
        }
    }
}

module.exports = new RateProviderService();
