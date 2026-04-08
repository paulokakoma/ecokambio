const BaseRepository = require('./base.repository');

/**
 * Supporter Repository
 * Gerencia operações de banco de dados para apoiadores
 */
class SupporterRepository extends BaseRepository {
    constructor() {
        super('supporters');
    }

    /**
     * Buscar apoiadores ordenados por display_order
     */
    async findAllOrdered() {
        return this.findAll({
            orderBy: 'display_order',
            orderDirection: 'asc'
        });
    }
}

module.exports = new SupporterRepository();
