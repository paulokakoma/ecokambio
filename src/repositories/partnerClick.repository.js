const BaseRepository = require('./base.repository');

/**
 * Partner Click Repository
 * Gerencia operações de banco de dados para clicks em parceiros
 */
class PartnerClickRepository extends BaseRepository {
    constructor() {
        super('partner_clicks');
    }

    /**
     * Incrementar contador de clicks
     */
    async incrementClick(partnerId) {
        const { data, error } = await this.supabase
            .from(this.tableName)
            .upsert({
                partner_id: partnerId,
                click_count: 1,
                last_clicked: new Date().toISOString()
            }, {
                onConflict: 'partner_id',
                ignoreDuplicates: false
            });

        if (error) {
            throw new Error(`Erro ao registrar click: ${error.message}`);
        }

        return data;
    }

    /**
     * Buscar estatísticas de clicks
     */
    async findStats() {
        const { data, error } = await this.supabase
            .from(this.tableName)
            .select('*')
            .order('click_count', { ascending: false });

        if (error) {
            throw new Error(`Erro ao buscar estatísticas: ${error.message}`);
        }

        return data || [];
    }
}

module.exports = new PartnerClickRepository();
