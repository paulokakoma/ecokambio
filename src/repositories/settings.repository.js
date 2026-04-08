const BaseRepository = require('./base.repository');

/**
 * Settings Repository
 * Gerencia operações de banco de dados para configurações
 */
class SettingsRepository extends BaseRepository {
    constructor() {
        super('settings');
    }

    /**
     * Buscar configurações ativas
     */
    async findActive() {
        const { data, error } = await this.supabase
            .from(this.tableName)
            .select('*')
            .eq('is_active', true)
            .single();

        if (error && error.code !== 'PGRST116') {
            throw new Error(`Erro ao buscar configurações: ${error.message}`);
        }

        return data;
    }
}

module.exports = new SettingsRepository();
