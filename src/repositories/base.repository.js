/**
 * Base Repository
 * Classe base para todos os repositories, fornecendo operações CRUD genéricas
 */
const supabase = require('../config/supabase');
const { AppError } = require('../middleware/errorHandler');

class BaseRepository {
    constructor(tableName) {
        this.tableName = tableName;
        this.supabase = supabase;
    }

    /**
     * Buscar todos os registos
     */
    async findAll(options = {}) {
        const { select = '*', orderBy, orderDirection = 'asc', filters = {} } = options;

        let query = this.supabase.from(this.tableName).select(select);

        // Aplicar filtros
        Object.entries(filters).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                query = query.eq(key, value);
            }
        });

        // Ordenação
        if (orderBy) {
            query = query.order(orderBy, { ascending: orderDirection === 'asc' });
        }

        const { data, error } = await query;

        if (error) {
            throw new AppError(`Erro ao buscar ${this.tableName}: ${error.message}`, 500);
        }

        return data || [];
    }

    /**
     * Buscar um registo por ID
     */
    async findById(id, options = {}) {
        const { select = '*' } = options;

        const { data, error } = await this.supabase
            .from(this.tableName)
            .select(select)
            .eq('id', id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return null;
            }
            throw new AppError(`Erro ao buscar ${this.tableName}: ${error.message}`, 500);
        }

        return data;
    }

    /**
     * Criar um novo registo
     */
    async create(data) {
        const { data: result, error } = await this.supabase
            .from(this.tableName)
            .insert(data)
            .select()
            .single();

        if (error) {
            throw new AppError(`Erro ao criar ${this.tableName}: ${error.message}`, 500);
        }

        return result;
    }

    /**
     * Atualizar um registo
     */
    async update(id, data) {
        const { data: result, error } = await this.supabase
            .from(this.tableName)
            .update(data)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            throw new AppError(`Erro ao atualizar ${this.tableName}: ${error.message}`, 500);
        }

        return result;
    }

    /**
     * Eliminar um registo
     */
    async delete(id) {
        const { error } = await this.supabase
            .from(this.tableName)
            .delete()
            .eq('id', id);

        if (error) {
            throw new AppError(`Erro ao eliminar ${this.tableName}: ${error.message}`, 500);
        }

        return true;
    }

    /**
     * Buscar com relacionamentos
     */
    async findWithRelations(relations, options = {}) {
        const { filters = {}, orderBy, orderDirection = 'asc' } = options;

        let selectString = '*';
        if (relations && relations.length > 0) {
            selectString += `, ${relations.join(', ')}`;
        }

        let query = this.supabase.from(this.tableName).select(selectString);

        // Aplicar filtros
        Object.entries(filters).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                query = query.eq(key, value);
            }
        });

        // Ordenação
        if (orderBy) {
            query = query.order(orderBy, { ascending: orderDirection === 'asc' });
        }

        const { data, error } = await query;

        if (error) {
            throw new AppError(`Erro ao buscar ${this.tableName}: ${error.message}`, 500);
        }

        return data || [];
    }

    /**
     * Contar registos
     */
    async count(filters = {}) {
        let query = this.supabase.from(this.tableName).select('*', { count: 'exact', head: true });

        Object.entries(filters).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                query = query.eq(key, value);
            }
        });

        const { count, error } = await query;

        if (error) {
            throw new AppError(`Erro ao contar ${this.tableName}: ${error.message}`, 500);
        }

        return count || 0;
    }
}

module.exports = BaseRepository;
