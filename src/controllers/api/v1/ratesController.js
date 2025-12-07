const supabase = require('../../../config/supabase');
const { handleSupabaseError } = require('../../../utils/errorHandler');

/**
 * Get all current exchange rates
 * GET /api/v1/rates
 */
const getAllRates = async (req, res) => {
    try {
        const { data, error } = await supabase.rpc('get_market_data');

        if (error) throw error;

        return res.apiSuccess({
            formal: data.formal || [],
            informal: data.informal || {},
            lastUpdated: data.last_updated || new Date().toISOString()
        });

    } catch (error) {
        console.error('Error fetching all rates:', error);
        return res.apiError(
            'RATES_FETCH_ERROR',
            'Erro ao buscar taxas de câmbio',
            500,
            { message: error.message }
        );
    }
};

/**
 * Get rates for a specific currency
 * GET /api/v1/rates/:currency
 */
const getRatesByCurrency = async (req, res) => {
    try {
        const { currency } = req.params;
        const validCurrencies = ['USD', 'EUR', 'USDT'];

        if (!validCurrencies.includes(currency.toUpperCase())) {
            return res.apiError(
                'INVALID_CURRENCY',
                `Moeda inválida. Moedas suportadas: ${validCurrencies.join(', ')}`,
                400
            );
        }

        const currencyPair = `${currency.toUpperCase()}/AOA`;

        // Fetch from both formal and informal markets
        const { data: formalData, error: formalError } = await supabase
            .from('exchange_rates')
            .select('*, providers(name, logo_url)')
            .eq('currency_pair', currencyPair)
            .order('updated_at', { ascending: false });

        const { data: informalData, error: informalError } = await supabase
            .rpc('get_average_informal_rate', { p_pair: currencyPair })
            .single();

        if (formalError || informalError) {
            throw formalError || informalError;
        }

        return res.apiSuccess({
            currency: currency.toUpperCase(),
            formal: formalData || [],
            informal: informalData || null
        });

    } catch (error) {
        console.error('Error fetching rates by currency:', error);
        return res.apiError(
            'CURRENCY_RATES_FETCH_ERROR',
            'Erro ao buscar taxas da moeda especificada',
            500,
            { message: error.message }
        );
    }
};

/**
 * Get informal market rates
 * GET /api/v1/rates/informal
 */
const getInformalRates = async (req, res) => {
    try {
        const [usdRateRes, eurRateRes, usdtRateRes] = await Promise.all([
            supabase.rpc('get_average_informal_rate', { p_pair: 'USD/AOA' }).single(),
            supabase.rpc('get_average_informal_rate', { p_pair: 'EUR/AOA' }).single(),
            supabase.rpc('get_average_informal_rate', { p_pair: 'USDT/AOA' }).single()
        ]);

        if (usdRateRes.error || eurRateRes.error || usdtRateRes.error) {
            throw usdRateRes.error || eurRateRes.error || usdtRateRes.error;
        }

        return res.apiSuccess({
            USD: usdRateRes.data || 0,
            EUR: eurRateRes.data || 0,
            USDT: usdtRateRes.data || 0
        });

    } catch (error) {
        console.error('Error fetching informal rates:', error);
        return res.apiError(
            'INFORMAL_RATES_FETCH_ERROR',
            'Erro ao buscar taxas do mercado informal',
            500,
            { message: error.message }
        );
    }
};

/**
 * Get formal market rates (banks)
 * GET /api/v1/rates/formal
 */
const getFormalRates = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('exchange_rates')
            .select('*, providers(name, logo_url)')
            .order('updated_at', { ascending: false });

        if (error) throw error;

        // Group by currency
        const grouped = data.reduce((acc, rate) => {
            const [currency] = rate.currency_pair.split('/');
            if (!acc[currency]) {
                acc[currency] = [];
            }
            acc[currency].push(rate);
            return acc;
        }, {});

        return res.apiSuccess(grouped);

    } catch (error) {
        console.error('Error fetching formal rates:', error);
        return res.apiError(
            'FORMAL_RATES_FETCH_ERROR',
            'Erro ao buscar taxas do mercado formal',
            500,
            { message: error.message }
        );
    }
};

/**
 * Get historical rates for the last 30 days
 * GET /api/v1/rates/history
 */
const getHistoricalRates = async (req, res) => {
    try {
        const { currency = 'USD', days = 30 } = req.query;

        const daysAgo = new Date();
        daysAgo.setDate(daysAgo.getDate() - parseInt(days));

        const currencyPair = `${currency.toUpperCase()}/AOA`;

        const { data, error } = await supabase
            .from('exchange_rates')
            .select('currency_pair, buy_rate, sell_rate, updated_at, providers(name)')
            .eq('currency_pair', currencyPair)
            .gte('updated_at', daysAgo.toISOString())
            .order('updated_at', { ascending: true });

        if (error) throw error;

        return res.apiSuccess({
            currency: currency.toUpperCase(),
            period: {
                from: daysAgo.toISOString(),
                to: new Date().toISOString(),
                days: parseInt(days)
            },
            data: data || []
        });

    } catch (error) {
        console.error('Error fetching historical rates:', error);
        return res.apiError(
            'HISTORICAL_RATES_FETCH_ERROR',
            'Erro ao buscar histórico de taxas',
            500,
            { message: error.message }
        );
    }
};

module.exports = {
    getAllRates,
    getRatesByCurrency,
    getInformalRates,
    getFormalRates,
    getHistoricalRates
};
