const express = require('express');
const router = express.Router();
const multer = require('multer');
const supabase = require('../services/supabase');

const upload = multer({ storage: multer.memoryStorage() });

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const { data, error } = await supabase
      .from('ecopay_profiles')
      .select('*')
      .eq('email', email)
      .eq('password_hash', password)
      .single();

    if (error || !data) {
      return res.status(401).json({ success: false, error: 'Credenciais inválidas' });
    }

    if (data.status !== 'approved') {
      return res.status(403).json({ success: false, error: `Conta ${data.status}` });
    }

    res.json({ success: true, token: data.id, profile: data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Register
router.post('/register', upload.fields([
  { name: 'biFront', maxCount: 1 },
  { name: 'biBack', maxCount: 1 }
]), async (req, res) => {
  try {
    const { name, email, phone, password, walletAddress, walletChain } = req.body;

    // Check if email exists
    const { data: existing } = await supabase
      .from('ecopay_profiles')
      .select('id')
      .eq('email', email)
      .single();

    if (existing) {
      return res.status(400).json({ success: false, error: 'Email já registado' });
    }

    let biFrontUrl = null;
    let biBackUrl = null;

    // Upload KYC if files provided
    if (req.files['biFront'] && req.files['biBack']) {
      const frontFile = req.files['biFront'][0];
      const backFile = req.files['biBack'][0];

      const uploadFront = await supabase.storage
        .from('ecopay_kyc')
        .upload(`bi_front_${Date.now()}_${frontFile.originalname}`, frontFile.buffer, { contentType: frontFile.mimetype });

      const uploadBack = await supabase.storage
        .from('ecopay_kyc')
        .upload(`bi_back_${Date.now()}_${backFile.originalname}`, backFile.buffer, { contentType: backFile.mimetype });

      if (uploadFront.data) biFrontUrl = uploadFront.data.path;
      if (uploadBack.data) biBackUrl = uploadBack.data.path;
    }

    const { data, error } = await supabase
      .from('ecopay_profiles')
      .insert([{
        name,
        email,
        phone,
        password_hash: password,
        wallet_address: walletAddress,
        wallet_chain: walletChain || 'BSC',
        bi_front_url: biFrontUrl,
        bi_back_url: biBackUrl,
        status: biFrontUrl ? 'pending_approval' : 'pending_kyc'
      }])
      .select();

    if (error) throw error;

    res.status(201).json({
      success: true,
      message: biFrontUrl ? 'Conta criada. Aprovação pendente (24h).' : 'Conta criada. Complete o KYC.',
      profile: data[0]
    });

  } catch (error) {
    console.error('Registration Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get Profile
router.get('/profile/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('ecopay_profiles')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error) throw error;
    res.json({ success: true, profile: data });
  } catch (error) {
    res.status(404).json({ success: false, error: 'User not found' });
  }
});

// Update Wallet
router.put('/wallet/:id', async (req, res) => {
  try {
    const { walletAddress, walletChain } = req.body;

    const { error } = await supabase
      .from('ecopay_profiles')
      .update({ wallet_address: walletAddress, wallet_chain: walletChain })
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Check status
router.get('/status/:email', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('ecopay_profiles')
      .select('*')
      .eq('email', req.params.email)
      .single();

    if (error) throw error;
    res.json({ success: true, profile: data });
  } catch (error) {
    res.status(404).json({ success: false, error: 'User not found' });
  }
});

module.exports = router;
