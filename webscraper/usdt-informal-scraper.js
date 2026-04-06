const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

async function scrapeInformalUSDT() {
    console.log('🚀 Starting Informal Market USDT Scraper...');
    console.log('💡 Strategy: Calcular USDT, ZAR, BRL, GBP com base na taxa Informal USD/AOA e taxas de câmbio da Binance');

    try {
        // 1. Fetch cross rates from Binance
        console.log('📡 Fetching cross rates from Binance...');
        const symbols = '["USDTUSD","USDTZAR","USDTBRL","GBPUSDT"]';
        const binanceResponse = await fetch(`https://api.binance.com/api/v3/ticker/price?symbols=${encodeURIComponent(symbols)}`);

        if (!binanceResponse.ok) {
            throw new Error(`Binance API error: ${binanceResponse.status}`);
        }

        const binanceData = await binanceResponse.json();
        
        let usdtToUsd = 0, usdtToZar = 0, usdtToBrl = 0, gbpToUsdt = 0;
        binanceData.forEach(ticker => {
            if (ticker.symbol === 'USDTUSD') usdtToUsd = parseFloat(ticker.price);
            if (ticker.symbol === 'USDTZAR') usdtToZar = parseFloat(ticker.price);
            if (ticker.symbol === 'USDTBRL') usdtToBrl = parseFloat(ticker.price);
            if (ticker.symbol === 'GBPUSDT') gbpToUsdt = parseFloat(ticker.price);
        });

        if (!usdtToUsd || !usdtToZar || !usdtToBrl || !gbpToUsdt) {
            throw new Error('Missing rates from Binance API');
        }

        console.log(`✅ Binance Rates Loaded: 
        1 USDT = ${usdtToUsd} USD
        1 USDT = ${usdtToZar} ZAR
        1 USDT = ${usdtToBrl} BRL
        1 GBP  = ${gbpToUsdt} USDT`);

        // 2. Get INFORMAL providers
        console.log('📊 Fetching informal market providers...');
        const { data: providers, error: fetchError } = await supabase
            .from('rate_providers')
            .select('id, code, name')
            .eq('type', 'INFORMAL');

        if (fetchError) {
            throw new Error(`Database error: ${fetchError.message}`);
        }

        if (!providers || providers.length === 0) {
            console.log('⚠️  No informal market providers found');
            return;
        }

        console.log(`📋 Found ${providers.length} informal market providers`);

        // 3. For each provider, get USD rate and calculate CROSS rates
        let successCount = 0;
        let errorCount = 0;

        for (const provider of providers) {
            try {
                // Get existing USD/AOA rate
                const { data: usdRate, error: usdError } = await supabase
                    .from('exchange_rates')
                    .select('sell_rate, buy_rate')
                    .eq('provider_id', provider.id)
                    .eq('currency_pair', 'USD/AOA')
                    .single();

                if (usdError || !usdRate) {
                    console.warn(`⚠️  No USD rate found for ${provider.code}, skipping cross rates`);
                    errorCount++;
                    continue;
                }

                console.log(`\n📈 ${provider.code} USD base rates - Buy: ${usdRate.buy_rate.toFixed(2)}, Sell: ${usdRate.sell_rate.toFixed(2)}`);

                // CALCULATION LOGIC:
                // Base: USDT/AOA = (USDT/USD) * (USD/AOA)
                const usdtAoaSell = usdtToUsd * usdRate.sell_rate;
                const usdtAoaBuy = usdtToUsd * usdRate.buy_rate;

                // ZAR/AOA = (USDT/AOA) / (USDT/ZAR)
                const zarAoaSell = usdtAoaSell / usdtToZar;
                const zarAoaBuy = usdtAoaBuy / usdtToZar;

                // BRL/AOA = (USDT/AOA) / (USDT/BRL)
                const brlAoaSell = usdtAoaSell / usdtToBrl;
                const brlAoaBuy = usdtAoaBuy / usdtToBrl;

                // GBP/AOA = (GBP/USDT) * (USDT/AOA)
                const gbpAoaSell = gbpToUsdt * usdtAoaSell;
                const gbpAoaBuy = gbpToUsdt * usdtAoaBuy;

                const updatedAt = new Date().toISOString();
                const newRates = [
                    { provider_id: provider.id, currency_pair: 'USDT/AOA', sell_rate: usdtAoaSell, buy_rate: usdtAoaBuy, updated_at: updatedAt },
                    { provider_id: provider.id, currency_pair: 'ZAR/AOA', sell_rate: zarAoaSell, buy_rate: zarAoaBuy, updated_at: updatedAt },
                    { provider_id: provider.id, currency_pair: 'BRL/AOA', sell_rate: brlAoaSell, buy_rate: brlAoaBuy, updated_at: updatedAt },
                    { provider_id: provider.id, currency_pair: 'GBP/AOA', sell_rate: gbpAoaSell, buy_rate: gbpAoaBuy, updated_at: updatedAt }
                ];

                // Upsert all cross rates
                const { error: upsertError } = await supabase
                    .from('exchange_rates')
                    .upsert(newRates, { onConflict: 'provider_id,currency_pair' });

                if (upsertError) {
                    console.error(`❌ Error updating ${provider.code}:`, upsertError.message);
                    errorCount++;
                } else {
                    console.log(`✅ Updated ${provider.code} Cross Rates:
        - USDT: ${usdtAoaSell.toFixed(2)}
        - ZAR: ${zarAoaSell.toFixed(2)}
        - BRL: ${brlAoaSell.toFixed(2)}
        - GBP: ${gbpAoaSell.toFixed(2)}`);
                    successCount++;
                }
            } catch (err) {
                console.error(`❌ Exception updating ${provider.code}:`, err.message);
                errorCount++;
            }
        }

        console.log('\n📊 Summary:');
        console.log(`   ✅ Successfully updated cross rates for: ${successCount} providers`);
        if (errorCount > 0) {
            console.log(`   ❌ Failed/Skipped: ${errorCount} providers`);
        }
        console.log('\n✨ Informal Market Cross Rates Scraper completed successfully!');

    } catch (error) {
        console.error('\n❌ Fatal error in Informal Market USDT Scraper:');
        console.error(error.message);
        process.exit(1);
    }
}

// Run the scraper
scrapeInformalUSDT();
