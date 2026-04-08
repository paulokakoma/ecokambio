const BaseRepository = require('./base.repository');

/**
 * Rate Provider Repository
 * Gerencia operações de banco de dados para provedores de taxas de câmbio
 */
class RateProviderRepository extends BaseRepository {
    constructor() {
        super('rate_providers');
    }

    /**
     * Buscar provedores com suas taxas de câmbio
     */
    async findWithRates(type) {
        const { data, error } = await this.supabase
            .from(this.tableName)
            .select('*, exchange_rates(currency_pair, sell_rate, updated_at)')
            .eq('type', type)
            .order('name', { ascending: true });

        if (error) {
            throw new Error(`Erro ao buscar provedores: ${error.message}`);
        }

        return data || [];
    }

    /**
     * Buscar provedores por tipo
     */
    async findByType(type) {
        return this.findAll({
            filters: { type },
            orderBy: 'name',
            orderDirection: 'asc'
        });
    }

    /**
     * Buscar provedores informais por província
     */
    async findInformalByProvince(province) {
        return this.findAll({
            filters: { type: 'INFORMAL', province },
            orderBy: 'name',
            orderDirection: 'asc'
        });
    }
}

module.exports = new RateProviderRepository();
