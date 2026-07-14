/**
 * Auth Controller
 * Handles OTP authentication and JWT generation
 */

const supabase = require('../../../src/config/supabase');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const smsService = require('../services/sms.service');

const JWT_SECRET = process.env.JWT_SECRET;
const OTP_COOLDOWN_SECONDS = 120; // 2 minutes between OTP sends per phone

// ============================================================================
// CUSTOMER: Register (Step 1: Request OTP)
// ============================================================================
const registerRequest = async (req, res) => {
    try {
        const { phone } = req.body;

        if (!phone) {
            return res.status(400).json({ success: false, message: 'Telefone é obrigatório' });
        }

        // Check if user already exists
        const { data: existingUser } = await supabase
            .from('ecoflix_users')
            .select('*')
            .eq('phone', phone)
            .single();

        if (!existingUser) {
            // Create user (unverified)
            const { error: insertError } = await supabase
                .from('ecoflix_users')
                .insert({ 
                    phone, 
                    verified_at: null // Unverified account
                });

            if (insertError) throw insertError;
        }

        // --- Rate Limiting: Prevent OTP spam ---
        const cooldownThreshold = new Date(Date.now() - OTP_COOLDOWN_SECONDS * 1000);
        const { data: recentOtp } = await supabase
            .from('ecoflix_otp_codes')
            .select('created_at')
            .eq('phone', phone)
            .eq('verified', false)
            .gte('created_at', cooldownThreshold.toISOString())
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (recentOtp) {
            const sentAt = new Date(recentOtp.created_at);
            const secondsElapsed = Math.floor((Date.now() - sentAt.getTime()) / 1000);
            const secondsRemaining = OTP_COOLDOWN_SECONDS - secondsElapsed;
            return res.status(429).json({
                success: false,
                message: `Aguarde ${secondsRemaining} segundos antes de solicitar um novo código.`,
                retryAfter: secondsRemaining
            });
        }
        // --- Fim do Rate Limiting ---

        // Generate 4-digit code
        const code = Math.floor(1000 + Math.random() * 9000).toString();
        const expiresAt = new Date(Date.now() + 10 * 60000); // 10 minutes

        // Delete old unused codes for this phone
        await supabase.from('ecoflix_otp_codes').delete().eq('phone', phone).eq('verified', false);

        // Store new code
        const { error: otpError } = await supabase
            .from('ecoflix_otp_codes')
            .insert([{ phone, code, expires_at: expiresAt, verified: false }]);

        if (otpError) throw otpError;

        // Send SMS
        const smsResponse = await smsService.sendOtpSms(phone, code);
        
        let devCode = null;
        if (process.env.SMS_PROVIDER === 'FAKE' || process.env.NODE_ENV !== 'production') {
            devCode = code; // Only for local testing convenience
        }

        if (smsResponse.success) {
            res.json({ success: true, message: 'Código SMS enviado', devCode });
        } else {
            // Se falhar o SMS mas quisermos permitir teste:
            res.json({ success: true, message: 'Erro no SMS, mas código gerado.', devCode });
        }

    } catch (error) {
        console.error('Register Request error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ============================================================================
// CUSTOMER: Register (Step 2: Verify OTP)
// ============================================================================
const registerVerify = async (req, res) => {
    try {
        const { phone, code } = req.body;

        if (!phone || !code) {
            return res.status(400).json({ success: false, message: 'Telefone e código são obrigatórios.' });
        }

        // Verify OTP (Aceita 0000 como código mestre para ultrapassar falhas de SMS)
        let query = supabase
            .from('ecoflix_otp_codes')
            .select('*')
            .eq('phone', phone)
            .eq('verified', false)
            .gte('expires_at', new Date().toISOString())
            .order('created_at', { ascending: false })
            .limit(1);

        if (code !== '0000') {
            query = query.eq('code', code);
        }

        const { data: otpRecords, error: otpError } = await query;

        if (otpError || !otpRecords || otpRecords.length === 0) {
            return res.status(400).json({ success: false, message: 'Código inválido ou expirado.' });
        }

        const otpRecord = otpRecords[0];

        // Mark OTP as verified
        await supabase
            .from('ecoflix_otp_codes')
            .update({ verified: true })
            .eq('id', otpRecord.id);

        // Mark User as verified
        const { data: updatedUser, error: updateError } = await supabase
            .from('ecoflix_users')
            .update({ verified_at: new Date() })
            .eq('phone', phone)
            .select()
            .single();

        if (updateError) throw updateError;

        // Generate JWT
        const token = jwt.sign(
            { id: updatedUser.id, phone: updatedUser.phone },
            JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.json({ 
            success: true, 
            message: 'Conta verificada com sucesso', 
            user: { id: updatedUser.id, phone: updatedUser.phone }, 
            token 
        });

    } catch (error) {
        console.error('Register Verify error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ============================================================================
// CUSTOMER: Login
// ============================================================================
const login = async (req, res) => {
    try {
        const { phone, password } = req.body;

        if (!phone || !password) {
            return res.status(400).json({ success: false, message: 'Telefone e senha são obrigatórios' });
        }

        // Find user
        const { data: user, error } = await supabase
            .from('ecoflix_users')
            .select('*')
            .eq('phone', phone)
            .single();

        if (error || !user) {
            return res.status(400).json({ success: false, message: 'Número ou senha inválidos.' });
        }

        // If user has no password (old OTP user), prompt them to set a password via register flow
        if (!user.password) {
            return res.status(400).json({ success: false, errorCode: 'NO_PASSWORD', message: 'Conta sem senha. Crie uma palavra-passe para continuar.' });
        }

        // Verify password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ success: false, message: 'Número ou senha inválidos.' });
        }

        // Verify if account is active
        if (user.verified_at === null) {
            return res.status(403).json({ success: false, errorCode: 'UNVERIFIED', message: 'Conta não verificada. Por favor conclua o registo com o código SMS.' });
        }

        // Generate JWT
        const token = jwt.sign(
            { id: user.id, phone: user.phone },
            JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.json({ success: true, message: 'Login bem-sucedido', user: { id: user.id, phone: user.phone }, token });

    } catch (error) {
        console.error('Login error:', error);
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
    registerRequest,
    registerVerify,
    login,
    requireOtpAuth
};
