const BaseRepository = require('./base.repository');

/**
 * Activity Log Repository
 * Gerencia operações de banco de dados para logs de atividade
 */
class ActivityLogRepository extends BaseRepository {
    constructor() {
        super('activity_logs');
    }

    /**
     * Buscar logs recentes
     */
    async findRecent(limit = 50) {
        const { data, error } = await this.supabase
            .from(this.tableName)
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) {
            throw new Error(`Erro ao buscar logs: ${error.message}`);
        }

        return data || [];
    }

    /**
     * Contar eventos por tipo
     */
    async countByEventType() {
        const { data, error } = await this.supabase
            .from(this.tableName)
            .select('event_type, count')
            .order('count', { ascending: false });

        if (error) {
            throw new Error(`Erro ao contar eventos: ${error.message}`);
        }

        return data || [];
    }

    /**
     * Buscar atividade dos últimos 7 dias
     */
    async findWeeklyActivity() {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const { data, error } = await this.supabase
            .from(this.tableName)
            .select('*')
            .gte('created_at', sevenDaysAgo.toISOString())
            .order('created_at', { ascending: false });

        if (error) {
            throw new Error(`Erro ao buscar atividade semanal: ${error.message}`);
        }

        return data || [];
    }

    /**
     * Limpar logs antigos
     */
    async clearOld() {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const { error } = await this.supabase
            .from(this.tableName)
            .delete()
            .lt('created_at', thirtyDaysAgo.toISOString());

        if (error) {
            throw new Error(`Erro ao limpar logs: ${error.message}`);
        }

        return true;
    }
}

module.exports = new ActivityLogRepository();
