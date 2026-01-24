/**
 * Auth Controller
 * Handles OTP authentication and JWT generation
 */

const supabase = require('../../config/supabase');
const smsService = require('../services/sms.service');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key-change-me';

// ============================================================================
// CUSTOMER: Send OTP
// ============================================================================
const sendOtp = async (req, res) => {
    try {
        const { phone } = req.body;

        if (!phone) {
            return res.status(400).json({ success: false, message: 'Número de telefone obrigatório' });
        }

        // Generate 4-digit code
        const code = Math.floor(1000 + Math.random() * 9000).toString();

        // Set expiration to 5 minutes from now
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

        // Store OTP
        await supabase
            .from('ecoflix_otp_codes')
            .insert({
                phone,
                code,
                expires_at: expiresAt.toISOString()
            });

        // Send SMS
        await smsService.sendOtpSms(phone, code);

        res.json({
            success: true,
            message: 'Código enviado',
            // Return code in dev for convenience
            devCode: (process.env.NODE_ENV === 'development') ? code : undefined
        });
    } catch (error) {
        console.error('Send OTP error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ============================================================================
// CUSTOMER: Verify OTP
// ============================================================================
const verifyOtp = async (req, res) => {
    try {
        const { phone, code } = req.body;

        if (!phone || !code) {
            return res.status(400).json({ success: false, message: 'Telefone e código são obrigatórios' });
        }

        const { data: otpRecord, error } = await supabase
            .from('ecoflix_otp_codes')
            .select('*')
            .eq('phone', phone)
            .eq('code', code)
            .eq('verified', false)
            .gte('expires_at', new Date().toISOString())
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (error || !otpRecord) {
            // Check for expired/verified just for better error message
            const { data: anyOtp } = await supabase
                .from('ecoflix_otp_codes')
                .select('*')
                .eq('phone', phone)
                .eq('code', code)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (anyOtp) {
                if (anyOtp.verified) return res.status(400).json({ success: false, message: 'Este código já foi usado.' });
                if (new Date(anyOtp.expires_at) < new Date()) return res.status(400).json({ success: false, message: 'Código expirou.' });
            }
            return res.status(400).json({ success: false, message: 'Código inválido.' });
        }

        // Mark as verified
        await supabase
            .from('ecoflix_otp_codes')
            .update({ verified: true })
            .eq('id', otpRecord.id);

        // Create or get user
        let { data: user } = await supabase
            .from('ecoflix_users')
            .select('*')
            .eq('phone', phone)
            .single();

        if (!user) {
            const { data: newUser } = await supabase
                .from('ecoflix_users')
                .insert({ phone, verified_at: new Date() })
                .select()
                .single();
            user = newUser;
        } else if (!user.verified_at) {
            await supabase
                .from('ecoflix_users')
                .update({ verified_at: new Date() })
                .eq('id', user.id);
        }

        // Generate JWT
        const token = jwt.sign(
            { id: user.id, phone: user.phone },
            JWT_SECRET,
            { expiresIn: '15m' }
        );

        res.json({ success: true, user, token });

    } catch (error) {
        console.error('Verify OTP error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ============================================================================
// MIDDLEWARE: OTP Protection
// ============================================================================
const requireOtpAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, message: 'Autenticação necessária (Token ausente)' });
        }

        const token = authHeader.split(' ')[1];

        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            req.user = decoded; // Attach user to request
            next();
        } catch (err) {
            return res.status(403).json({ success: false, message: 'Sessão expirada. Verifique o código novamente.' });
        }
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    sendOtp,
    verifyOtp,
    requireOtpAuth
};
