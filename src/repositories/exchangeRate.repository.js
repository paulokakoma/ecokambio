const BaseRepository = require('./base.repository');

/**
 * Exchange Rate Repository
 * Gerencia operações de banco de dados para taxas de câmbio
 */
class ExchangeRateRepository extends BaseRepository {
    constructor() {
        super('exchange_rates');
    }

    /**
     * Buscar a última atualização
     */
    async findLastUpdate() {
        const { data, error } = await this.supabase
            .from(this.tableName)
            .select('updated_at')
            .order('updated_at', { ascending: false })
            .limit(1)
            .single();

        if (error && error.code !== 'PGRST116') {
            throw new Error(`Erro ao buscar última atualização: ${error.message}`);
        }

        return data?.updated_at || null;
    }

    /**
     * Contar taxas numa janela temporal
     */
    async countInTimeWindow(start, end) {
        const { count, error } = await this.supabase
            .from(this.tableName)
            .select('*', { count: 'exact', head: true })
            .gte('updated_at', start)
            .lte('updated_at', end);

        if (error) {
            throw new Error(`Erro ao contar taxas: ${error.message}`);
        }

        return count || 0;
    }
}

module.exports = new ExchangeRateRepository();
