const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

async function scrapeInformalUSDT() {
    console.log('🚀 Starting Informal Market USDT Scraper...');
    console.log('💡 Strategy: USDT/AOA = (USDT/USD from Binance) × (USD/AOA informal)');

    try {
        // 1. Fetch USDT/USD rate from Binance
        console.log('📡 Fetching USDT/USD rate from Binance...');
        const binanceResponse = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=USDTUSD');

        if (!binanceResponse.ok) {
            throw new Error(`Binance API error: ${binanceResponse.status}`);
        }

        const binanceData = await binanceResponse.json();
        const usdtToUsd = parseFloat(binanceData.price);

        if (!usdtToUsd || isNaN(usdtToUsd)) {
            throw new Error('Invalid USDT/USD rate from Binance');
        }

        console.log(`✅ USDT/USD rate: ${usdtToUsd.toFixed(4)} (1 USDT = ${usdtToUsd} USD)`);

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

        // 3. For each provider, get USD rate and calculate USDT
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
                    console.warn(`⚠️  No USD rate found for ${provider.code}, skipping USDT`);
                    errorCount++;
                    continue;
                }

                console.log(`📈 ${provider.code} USD rates - Buy: ${usdRate.buy_rate.toFixed(2)}, Sell: ${usdRate.sell_rate.toFixed(2)}`);

                // Calculate USDT rates: USDT/AOA = (USDT/USD) × (USD/AOA)
                const usdtSellRate = usdtToUsd * usdRate.sell_rate;
                const usdtBuyRate = usdtToUsd * usdRate.buy_rate;

                console.log(`💱 ${provider.code} USDT calc: ${usdtToUsd.toFixed(4)} × ${usdRate.sell_rate.toFixed(2)} = ${usdtSellRate.toFixed(2)}`);

                // Upsert USDT rate
                const { error: upsertError } = await supabase
                    .from('exchange_rates')
                    .upsert({
                        provider_id: provider.id,
                        currency_pair: 'USDT/AOA',
                        sell_rate: usdtSellRate,
                        buy_rate: usdtBuyRate,
                        updated_at: new Date().toISOString()
                    }, {
                        onConflict: 'provider_id,currency_pair'
                    });

                if (upsertError) {
                    console.error(`❌ Error updating ${provider.code}:`, upsertError.message);
                    errorCount++;
                } else {
                    console.log(`✅ Updated ${provider.code} - Buy: ${usdtBuyRate.toFixed(2)}, Sell: ${usdtSellRate.toFixed(2)}`);
                    successCount++;
                }
            } catch (err) {
                console.error(`❌ Exception updating ${provider.code}:`, err.message);
                errorCount++;
            }
        }

        console.log('\n📊 Summary:');
        console.log(`   ✅ Successfully updated: ${successCount} providers`);
        if (errorCount > 0) {
            console.log(`   ❌ Failed/Skipped: ${errorCount} providers`);
        }
        console.log(`   💱 USDT/USD: ${usdtToUsd.toFixed(4)}`);
        console.log(`   📊 Source: Binance USDT/USD × Informal USD/AOA`);
        console.log('\n✨ Informal Market USDT Scraper completed successfully!');

    } catch (error) {
        console.error('\n❌ Fatal error in Informal Market USDT Scraper:');
        console.error(error.message);
        process.exit(1);
    }
}

// Run the scraper
scrapeInformalUSDT();
