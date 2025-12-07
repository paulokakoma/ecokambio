const supabase = require('../../../config/supabase');

/**
 * Convert amount between currencies
 * POST /api/v1/conversion
 * 
 * Body: {
 *   from: 'USD',
 *   to: 'AOA',
 *   amount: 100,
 *   market: 'informal' // or 'formal'
 * }
 */
const convertCurrency = async (req, res) => {
    try {
        const { from, to, amount, market = 'informal' } = req.body;

        // ============================================
        // VALIDAÇÕES DE SEGURANÇA
        // ============================================

        // 1. Validação de presença de parâmetros
        if (!from || !to || amount === undefined || amount === null) {
            return res.apiError(
                'MISSING_PARAMETERS',
                'Parâmetros obrigatórios: from, to, amount',
                400,
                { provided: Object.keys(req.body) }
            );
        }

        // 2. Validação de tipo (prevenir strings, arrays, objects)
        if (typeof amount !== 'number' || isNaN(amount)) {
            return res.apiError(
                'INVALID_AMOUNT_TYPE',
                'O amount deve ser um número válido',
                400,
                { received: typeof amount, value: amount }
            );
        }

        // 3. Validação de valor positivo (prevenir negativos e zero)
        if (amount <= 0) {
            return res.apiError(
                'INVALID_AMOUNT_VALUE',
                'O amount deve ser maior que zero',
                400,
                { received: amount }
            );
        }

        // 4. Validação de limite máximo (prevenir overflow/DoS)
        const MAX_AMOUNT = 1_000_000_000; // 1 bilhão
        if (amount > MAX_AMOUNT) {
            return res.apiError(
                'AMOUNT_TOO_LARGE',
                `O amount máximo permitido é ${MAX_AMOUNT.toLocaleString('pt-PT')}`,
                400,
                { max: MAX_AMOUNT, received: amount }
            );
        }

        // 5. Validação de precisão decimal (máximo 2 casas)
        const amountStr = amount.toString();
        const decimalPlaces = (amountStr.split('.')[1] || '').length;
        if (decimalPlaces > 2) {
            return res.apiError(
                'INVALID_DECIMAL_PRECISION',
                'O amount pode ter no máximo 2 casas decimais',
                400,
                { maxDecimals: 2, received: decimalPlaces, value: amount }
            );
        }

        // 6. Validação de moedas suportadas
        const validCurrencies = ['USD', 'EUR', 'USDT', 'AOA'];
        const fromUpper = from.toUpperCase();
        const toUpper = to.toUpperCase();

        if (!validCurrencies.includes(fromUpper)) {
            return res.apiError(
                'INVALID_SOURCE_CURRENCY',
                `Moeda de origem inválida. Use: ${validCurrencies.join(', ')}`,
                400,
                { received: from, supported: validCurrencies }
            );
        }

        if (!validCurrencies.includes(toUpper)) {
            return res.apiError(
                'INVALID_TARGET_CURRENCY',
                `Moeda de destino inválida. Use: ${validCurrencies.join(', ')}`,
                400,
                { received: to, supported: validCurrencies }
            );
        }

        // 7. Validação de mercado
        const validMarkets = ['informal', 'formal'];
        if (!validMarkets.includes(market)) {
            return res.apiError(
                'INVALID_MARKET',
                'Mercado inválido. Use: informal ou formal',
                400,
                { received: market, supported: validMarkets }
            );
        }

        const parsedAmount = amount; // Já validado como number

        // Handle same currency conversion
        if (fromUpper === toUpper) {
            return res.apiSuccess({
                from: fromUpper,
                to: toUpper,
                amount: parsedAmount,
                converted: parsedAmount,
                rate: 1,
                market,
                timestamp: new Date().toISOString()
            });
        }

        // Get exchange rate based on market
        let rate = null;
        let source = null;

        if (market === 'informal') {
            // Fetch informal rate
            const currencyPair = `${fromUpper}/AOA`;
            const { data, error } = await supabase
                .rpc('get_average_informal_rate', { p_pair: currencyPair })
                .single();

            if (error) throw error;

            rate = data;
            source = 'Mercado Informal (Média)';

        } else if (market === 'formal') {
            // Fetch formal rate (use average of all banks' sell rates)
            const currencyPair = `${fromUpper}/AOA`;
            const { data, error } = await supabase
                .from('exchange_rates')
                .select('sell_rate, providers(name)')
                .eq('currency_pair', currencyPair)
                .order('updated_at', { ascending: false })
                .limit(10);

            if (error) throw error;

            if (!data || data.length === 0) {
                return res.apiError(
                    'RATE_NOT_FOUND',
                    'Taxa de câmbio não encontrada para o mercado formal',
                    404
                );
            }

            // Calculate average of formal rates
            const sum = data.reduce((acc, r) => acc + (r.sell_rate || 0), 0);
            rate = sum / data.length;
            source = 'Mercado Formal (Média de Bancos)';

        } else {
            return res.apiError(
                'INVALID_MARKET',
                'Mercado inválido. Use: informal ou formal',
                400
            );
        }

        if (!rate || rate <= 0) {
            return res.apiError(
                'RATE_NOT_AVAILABLE',
                'Taxa de câmbio não disponível no momento',
                503
            );
        }

        // Calculate conversion
        let converted;
        if (toUpper === 'AOA') {
            // Converting TO AOA
            converted = parsedAmount * rate;
        } else {
            // Converting FROM AOA
            converted = parsedAmount / rate;
        }

        return res.apiSuccess({
            from: fromUpper,
            to: toUpper,
            amount: parsedAmount,
            converted: parseFloat(converted.toFixed(2)),
            rate: parseFloat(rate.toFixed(2)),
            market,
            source,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error converting currency:', error);
        return res.apiError(
            'CONVERSION_ERROR',
            'Erro ao converter moeda',
            500,
            { message: error.message }
        );
    }
};

module.exports = {
    convertCurrency
};
