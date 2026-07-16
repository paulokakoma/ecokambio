const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

async function scrapeFormalUSDT() {
    console.log('🚀 Starting USDT Scraper for Binance Provider...');

    try {
        // 1. Get Binance provider
        console.log('📊 Fetching Binance provider...');
        const { data: binanceProvider, error: providerError } = await supabase
            .from('rate_providers')
            .select('id')
            .eq('code', 'BINANCE')
            .single();

        if (providerError || !binanceProvider) {
            throw new Error('Binance provider not found. Please run: scripts/create-binance-provider.sql');
        }

        console.log(`✅ Found Binance provider (ID: ${binanceProvider.id})`);

        // 2. Fetch USDT/AOA from Coinbase
        console.log('📡 Fetching USDT/AOA rate from Coinbase...');
        const coinbaseResponse = await fetch('https://api.coinbase.com/v2/exchange-rates?currency=USDT');

        if (!coinbaseResponse.ok) {
            throw new Error(`Coinbase API error: ${coinbaseResponse.status}`);
        }

        const coinbaseData = await coinbaseResponse.json();
        const usdtAoa = parseFloat(coinbaseData.data.rates.AOA);

        if (!usdtAoa || isNaN(usdtAoa)) {
            throw new Error('Invalid USDT/AOA rate from Coinbase');
        }

        console.log(`✅ USDT/AOA: ${usdtAoa.toFixed(2)} AOA`);

        // 3. Fetch USDT/USD from Binance (with CoinGecko fallback)
        console.log('📡 Fetching USDT/USD rate...');
        let usdtUsd = null;

        // Try Binance first
        const binanceEndpoints = [
            'https://api.binance.com/api/v3/ticker/price?symbol=USDTUSD',
            'https://api1.binance.com/api/v3/ticker/price?symbol=USDTUSD',
            'https://api2.binance.com/api/v3/ticker/price?symbol=USDTUSD',
            'https://api3.binance.com/api/v3/ticker/price?symbol=USDTUSD',
        ];

        for (const endpoint of binanceEndpoints) {
            try {
                const resp = await fetch(endpoint);
                if (resp.ok) {
                    const data = await resp.json();
                    usdtUsd = parseFloat(data.price);
                    if (usdtUsd && !isNaN(usdtUsd)) break;
                }
            } catch (e) {
                continue;
            }
        }

        // Fallback to CoinGecko if Binance is geo-blocked
        if (!usdtUsd) {
            console.log('⚠️  Binance unavailable, trying CoinGecko...');
            const cgResp = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=usd');
            if (cgResp.ok) {
                const cgData = await cgResp.json();
                usdtUsd = cgData.tether?.usd;
            }
        }

        if (!usdtUsd || isNaN(usdtUsd)) {
            throw new Error('Could not fetch USDT/USD from any source');
        }

        console.log(`✅ USDT/USD: ${usdtUsd.toFixed(6)} USD`);

        // 4. Calculate USDT/EUR using BNA rates
        console.log('💱 Calculating USDT/EUR...');
        const { data: bnaProvider } = await supabase
            .from('rate_providers')
            .select('id')
            .eq('code', 'BNA')
            .single();

        if (!bnaProvider) {
            throw new Error('BNA provider not found for EUR calculation');
        }

        const { data: eurRate } = await supabase
            .from('exchange_rates')
            .select('sell_rate')
            .eq('provider_id', bnaProvider.id)
            .eq('currency_pair', 'EUR/AOA')
            .single();

        const { data: usdRate } = await supabase
            .from('exchange_rates')
            .select('sell_rate')
            .eq('provider_id', bnaProvider.id)
            .eq('currency_pair', 'USD/AOA')
            .single();

        if (!eurRate || !usdRate) {
            throw new Error('Could not fetch EUR or USD rates from BNA');
        }

        // EUR/USD = (EUR/AOA) / (USD/AOA)
        const eurUsd = eurRate.sell_rate / usdRate.sell_rate;
        // USDT/EUR = USDT/USD / EUR/USD
        const usdtEur = usdtUsd / eurUsd;

        console.log(`✅ USDT/EUR: ${usdtEur.toFixed(6)} EUR`);

        // 5. Store all three rates for Binance provider
        console.log('💾 Storing rates in database...');

        const ratesToInsert = [
            {
                provider_id: binanceProvider.id,
                currency_pair: 'USDT/AOA',
                sell_rate: usdtAoa,
                updated_at: new Date().toISOString()
            },
            {
                provider_id: binanceProvider.id,
                currency_pair: 'USDT/USD',
                sell_rate: usdtUsd,
                updated_at: new Date().toISOString()
            },
            {
                provider_id: binanceProvider.id,
                currency_pair: 'USDT/EUR',
                sell_rate: usdtEur,
                updated_at: new Date().toISOString()
            }
        ];

        const { error: upsertError } = await supabase
            .from('exchange_rates')
            .upsert(ratesToInsert, {
                onConflict: 'provider_id,currency_pair'
            });

        if (upsertError) {
            throw new Error(`Database error: ${upsertError.message}`);
        }

        console.log('\n📊 Summary:');
        console.log(`   ✅ Provider: Binance`);
        console.log(`   🪙 USDT/AOA: ${usdtAoa.toFixed(2)} AOA`);
        console.log(`   💵 USDT/USD: ${usdtUsd.toFixed(6)} USD`);
        console.log(`   💶 USDT/EUR: ${usdtEur.toFixed(6)} EUR`);
        console.log(`   📊 Sources: Coinbase (AOA) + Binance (USD) + BNA (EUR calc)`);
        console.log('\n✨ USDT Scraper completed successfully!');

    } catch (error) {
        console.error('\n❌ Fatal error in USDT Scraper:');
        console.error(error.message);
        process.exit(1);
    }
}

// Run the scraper
scrapeFormalUSDT();
