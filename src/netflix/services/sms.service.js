const axios = require('axios');
let twilioClient;

try {
    const twilio = require('twilio');
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
        twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    }
} catch (e) {
    console.warn('[SMS] Twilio module not found or failed to load:', e.message);
}

// Configuration
const SMS_PROVIDER = process.env.SMS_PROVIDER || 'MIMO'; // 'MIMO' or 'TWILIO'

// Mimo Config
const MIMO_HOST = process.env.MIMO_API_HOST || 'http://52.30.114.86:8080';
const MIMO_BASE = process.env.MIMO_API_BASE || '/mimosms/v1';
const MIMO_TOKEN = process.env.MIMO_API_TOKEN;
const MIMO_SENDER_ID = process.env.MIMO_SENDER_ID || 'ECOFLIX';

// Twilio Config
const TWILIO_PHONE = process.env.TWILIO_PHONE_NUMBER;

/**
 * Base SMS Sender
 */
const sendSms = async (to, text) => {
    // 0. Fake Provider (for testing/demos)
    if (SMS_PROVIDER === 'FAKE') {
        console.log(`[SMS-FAKE] 📨 To: ${to} | Body: "${text}"`);
        return { success: true, data: { sid: 'fake_sid_' + Date.now(), status: 'sent' } };
    }

    // 1. Twilio Provider
    if (SMS_PROVIDER === 'TWILIO') {
        // Fallback to Mimo if Twilio fails? No, strictly use configured provider.
        return sendViaTwilio(to, text);
    }

    // 2. Mimo Provider (Default)
    return sendViaMimo(to, text);
};

// --- Specific Methods ---

/**
 * Send OTP for verification
 * @param {string} phone - Format: 923xxxxxx
 * @param {string} code - 4 digit code
 */
const sendOtpSms = async (phone, code) => {
    const message = `EcoFlix: Seu codigo de verificacao e: ${code}`;
    return sendSms(phone, message);
};

/**
 * Send Delivery Credentials
 * @param {string} phone 
 * @param {object} creds { email, password, profile, pin }
 */
const sendDeliverySms = async (phone, creds) => {
    // Format message strictly as requested
    const message = `EcoFlix: Pagamento confirmado! Login: ${creds.email}, Senha: ${creds.password}, Perfil: ${creds.profile}, PIN: ${creds.pin}. Validade: 30 days.`;
    return sendSms(phone, message);
};

// --- Twilio Implementation ---
const sendViaTwilio = async (to, text) => {
    try {
        if (!twilioClient) {
            // Attempt to re-init if env vars were added late?
            const twilio = require('twilio');
            twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        };

        if (!twilioClient) throw new Error('Twilio client not initialized. Check credentials.');
        if (!TWILIO_PHONE) throw new Error('TWILIO_PHONE_NUMBER not set.');

        // Ensure E.164 format for Twilio (start with +)
        let recipient = to.replace(/\s/g, '');
        // If it comes as 923... (9 digits), append +244?
        // User didn't specify country code logic, but Twilio needs it.
        // Assuming Angola +244 if not present.
        if (!recipient.startsWith('+')) {
            if (recipient.length === 9) recipient = '+244' + recipient;
            // if already has 244 prefix without +, add +
            else if (recipient.startsWith('244')) recipient = '+' + recipient;
            else recipient = '+' + recipient; // Fallback
        }

        console.log(`[SMS-TWILIO] Sending to ${recipient}...`);

        const message = await twilioClient.messages.create({
            body: text,
            from: TWILIO_PHONE,
            to: recipient
        });

        console.log(`[SMS-TWILIO] Success: SID ${message.sid}`);
        return { success: true, data: { sid: message.sid } };

    } catch (error) {
        console.error(`[SMS-TWILIO] Failed: ${error.message}`);
        // If invalid number, return specific error
        return { success: false, error: error.message };
    }
};

// --- Mimo Implementation ---
const sendViaMimo = async (to, text) => {
    try {
        if (!MIMO_TOKEN) {
            console.warn('[SMS] No MIMO_API_TOKEN found in usage. SMS not sent.');
            return { success: false, message: 'SMS config missing' };
        }

        let recipient = to.replace(/\D/g, '');
        if (recipient.startsWith('244') && recipient.length > 9) {
            recipient = recipient.substring(3);
        }

        const url = `${MIMO_HOST}${MIMO_BASE}/message/send?token=${MIMO_TOKEN}`;
        const payload = {
            sender: MIMO_SENDER_ID,
            recipients: recipient,
            text: text
        };

        console.log(`[SMS-MIMO] Sending to ${recipient} using SenderID: "${MIMO_SENDER_ID}"...`);

        const response = await axios.post(url, payload, {
            headers: { 'Content-Type': 'application/json' }
        });

        console.log(`[SMS-MIMO] Success: ${response.status}`);
        return { success: true, data: response.data };

    } catch (error) {
        console.error(`[SMS-MIMO] Failed: ${error.message}`);
        if (error.response) {
            console.error('[SMS-MIMO] Response Body:', error.response.data);
            return { success: false, error: error.response.data };
        }
        return { success: false, error: error.message };
    }
};

module.exports = {
    sendSms,
    sendOtpSms,
    sendDeliverySms
};
