const BaseRepository = require('./base.repository');

/**
 * Currency Repository
 * Gerencia operações de banco de dados para moedas
 */
class CurrencyRepository extends BaseRepository {
    constructor() {
        super('currencies');
    }
}

module.exports = new CurrencyRepository();
