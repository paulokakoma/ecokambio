const express = require('express');
const router = express.Router();
const multer = require('multer');
const supabase = require('../services/supabase');

// Multer setup for memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Register new profile with KYC
router.post('/register', upload.fields([
  { name: 'biFront', maxCount: 1 },
  { name: 'biBack', maxCount: 1 }
]), async (req, res) => {
  try {
    const { name, email, phone, walletAddress, walletChain } = req.body;

    // 1. Upload images to Supabase Storage (ecopay-kyc bucket)
    const frontFile = req.files['biFront'][0];
    const backFile = req.files['biBack'][0];

    const uploadFront = await supabase.storage
      .from('ecopay_kyc')
      .upload(`bi_front_${Date.now()}_${frontFile.originalname}`, frontFile.buffer, {
        contentType: frontFile.mimetype
      });

    const uploadBack = await supabase.storage
      .from('ecopay_kyc')
      .upload(`bi_back_${Date.now()}_${backFile.originalname}`, backFile.buffer, {
        contentType: backFile.mimetype
      });

    if (uploadFront.error || uploadBack.error) {
      throw new Error('Error uploading KYC documents');
    }

    // 2. Create profile in database
    const { data, error } = await supabase
      .from('ecopay_profiles')
      .insert([
        {
          name,
          email,
          phone,
          wallet_address: walletAddress,
          wallet_chain: walletChain,
          bi_front_url: uploadFront.data.path,
          bi_back_url: uploadBack.data.path,
          status: 'pending_approval'
        }
      ])
      .select();

    if (error) throw error;

    res.status(201).json({
      success: true,
      message: 'Registration successful. Your wallet is pending approval (24h).',
      profile: data[0]
    });

  } catch (error) {
    console.error('Registration Error:', error.message);
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
