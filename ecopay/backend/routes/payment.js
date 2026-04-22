const express = require('express');
const router = express.Router();
const supabase = require('../services/supabase');
const bybit = require('../services/bybit');

// Constants (Should be in .env but using here for clarity)
const USDT_AOA_RATE = parseFloat(process.env.USDT_AOA_RATE || '1200');
const NETWORK_FEE = parseFloat(process.env.NETWORK_FEE_USDT || '1');

// Test Endpoint: Instant Withdraw (Bypasses verification for testing)
router.post('/instant-withdraw', async (req, res) => {
  try {
    const { address, amount, chain } = req.body;
    console.log(`[TEST] Executing instant withdraw: ${amount} USDT to ${address} (${chain})`);
    const result = await bybit.createWithdrawal(address, amount, 'USDT', chain || 'BSC');
    if (result.retCode === 0) {
      res.json({ success: true, message: 'Saque processado com sucesso!', data: result.result });
    } else {
      res.status(400).json({ success: false, message: `Erro Bybit (${result.retCode}): ${result.retMsg}` });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 1. Create Purchase Order
router.post('/create-order', async (req, res) => {
  try {
    const { profileId, amountUsdt } = req.body;

    // Verify profile is approved
    const { data: profile, error: profileError } = await supabase
      .from('ecopay_profiles')
      .select('*')
      .eq('id', profileId)
      .single();

    if (profileError || profile.status !== 'approved') {
      return res.status(403).json({ success: false, error: 'User wallet not approved yet.' });
    }

    const totalAoa = (parseFloat(amountUsdt) + NETWORK_FEE) * USDT_AOA_RATE;

    // TODO: Call PayPay Africa API to generate Entity/Reference here
    const mockReference = `REF-${Math.floor(Math.random() * 90000) + 10000}`;
    const mockEntity = '90000';

    // Save transaction
    const { data: transaction, error: txError } = await supabase
      .from('ecopay_transactions')
      .insert([{
        profile_id: profileId,
        amount_usdt: amountUsdt,
        amount_aoa: totalAoa,
        exchange_rate: USDT_AOA_RATE,
        network_fee: NETWORK_FEE,
        payment_ref: mockReference,
        payment_status: 'awaiting_payment'
      }])
      .select();

    if (txError) throw txError;

    res.json({
      success: true,
      order: transaction[0],
      paymentData: {
        entity: mockEntity,
        reference: mockReference,
        amount: totalAoa
      }
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2. Webhook for PayPay Africa Liquidation
router.post('/webhook/paypay', async (req, res) => {
  try {
    // TODO: Validate webhook signature from PayPay Africa
    const { reference, status } = req.body;

    if (status !== 'PAID') {
       return res.json({ success: true, message: 'Status not paid' });
    }

    // Find transaction
    const { data: tx, error: txError } = await supabase
      .from('ecopay_transactions')
      .select('*, ecopay_profiles(*)')
      .eq('payment_ref', reference)
      .single();

    if (txError || !tx) throw new Error('Transaction not found');

    if (tx.payment_status === 'liquidated') {
      return res.json({ success: true, message: 'Already liquidated' });
    }

    // Mark as paid
    await supabase.from('ecopay_transactions').update({ payment_status: 'paid_fiat' }).eq('id', tx.id);

    // EXECUTE BYBIT WITHDRAWAL
    console.log(`Executing Bybit withdraw to ${tx.ecopay_profiles.wallet_address}...`);
    const withdrawResult = await bybit.createWithdrawal(
      tx.ecopay_profiles.wallet_address,
      tx.amount_usdt,
      'USDT',
      tx.ecopay_profiles.wallet_chain
    );

    // Finalize
    await supabase.from('ecopay_transactions').update({
      payment_status: 'liquidated',
      bybit_withdraw_id: withdrawResult.result?.withdrawId || 'N/A'
    }).eq('id', tx.id);

    res.json({ success: true, message: 'Payment confirmed and USDT sent!' });

  } catch (error) {
    console.error('Webhook Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
