const BaseRepository = require('./base.repository');

/**
 * Affiliate Link Repository
 * Gerencia operações de banco de dados para links de afiliados
 */
class AffiliateLinkRepository extends BaseRepository {
    constructor() {
        super('affiliate_links');
    }

    /**
     * Buscar links ordenados por data de criação
     */
    async findAllOrdered() {
        return this.findAll({
            orderBy: 'created_at',
            orderDirection: 'desc'
        });
    }
}

module.exports = new AffiliateLinkRepository();
