/**
 * SMS Service — TelcoSMS (telcosms.co.ao)
 *
 * Provedor local angolano com cobertura direta à Unitel e Movicel.
 * API Reference: https://documenter.getpostman.com/view/9777660/2sAXjDeayT
 *
 * Endpoints:
 *   POST https://www.telcosms.co.ao/api/v2/send_message
 *   GET  https://www.telcosms.co.ao/api/v2/check_balance?api_key_app=...
 *
 * Autenticação: api_key_app no body / query string (formato: prd...)
 *
 * SMS_PROVIDER=FAKE → console log (desenvolvimento local)
 * SMS_PROVIDER=TELCO → TelcoSMS (produção)
 */

const axios = require('axios');
const supabase = require('../../../src/config/supabase');
const fs = require('fs');
const path = require('path');

const TELCO_BASE_URL = 'https://www.telcosms.co.ao/api/v2';
const TELCO_API_KEY = process.env.TELCO_API_KEY;
const SMS_PROVIDER = (process.env.SMS_PROVIDER || 'TELCO').toUpperCase();

const SETTINGS_FILE = path.join(__dirname, '../settings.json');

// Zero-width space (U+200B) — invisível, mas força o TelcoSMS a usar Unicode (UCS-2).
// Em GSM-7, o @ mapeia para 0x00 (null terminator) e o gateway corta a mensagem.
// Com Unicode, o @ chega inteiro. Mensagens ficam limitadas a 70 caracteres por SMS.
const UNICODE_MARKER = '\u200B';

const getSupportNumber = () => {
    try {
        if (fs.existsSync(SETTINGS_FILE)) {
            const settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
            if (settings.SUPPORT_WHATSAPP) {
                const num = settings.SUPPORT_WHATSAPP.replace('+', '');
                return '+' + num;
            }
        }
    } catch (e) {
        console.error('[SMS] Erro ao ler settings.json:', e.message);
    }
    return '+244927862935'; // Default fallback
};

// ============================================================================
// Phone Normalization
// ============================================================================

/**
 * Normaliza o número para formato local angolano (9 dígitos).
 * TelcoSMS é um provedor local — aceita números angolanos sem prefixo +244.
 */
const normalizePhone = (phone) => {
    if (!phone) return '';
    let clean = phone.replace(/[^0-9+]/g, '');
    if (clean.startsWith('+244')) return clean.slice(4);
    if (clean.startsWith('244') && clean.length === 12) return clean.slice(3);
    return clean.replace(/[^0-9]/g, '');
};

// ============================================================================
// Histórico de SMS
// ============================================================================
const logSmsToDb = async (phone, message, status, errorMsg = null) => {
    try {
        const payload = {
            phone: phone,
            message: message,
            status: status, // 'SENT' or 'FAILED'
        };
        if (errorMsg) {
            payload.error_msg = errorMsg;
        }
        // Try inserting into the log table. Will fail gracefully if table doesn't exist yet
        await supabase.from('ecoflix_sms_logs').insert([payload]);
    } catch (e) {
        console.error(`[SMS-Log] Failed to log SMS to database: ${e.message}`);
    }
};

// ============================================================================
// Envio de SMS
// ============================================================================

/**
 * Envia um SMS via TelcoSMS.
 * @param {string} to   - Número do destinatário (qualquer formato, normalizado internamente)
 * @param {string} text - Corpo da mensagem
 * @returns {Promise<{ success: boolean, messageId?: string, error?: string }>}
 */
const sendSms = async (to, text, { forceUnicode = false } = {}) => {
    let cleanText = text;
    if (forceUnicode) {
        cleanText += UNICODE_MARKER;
    }

    // FAKE mode — apenas para desenvolvimento local
    if (SMS_PROVIDER === 'FAKE') {
        console.log(`[SMS-FAKE] 📨 To: ${to} | Body: "${cleanText}"`);
        await logSmsToDb(to, cleanText, 'SENT');
        return { success: true, messageId: 'fake_' + Date.now() };
    }

    if (!TELCO_API_KEY) {
        const err = '[SMS-TelcoSMS] TELCO_API_KEY não configurado no .env';
        console.error(err);
        await logSmsToDb(to, cleanText, 'FAILED', err);
        return { success: false, error: err };
    }

    const recipient = normalizePhone(to);

    // Validate phone: must be exactly 9 digits (Angolan number)
    if (!/^\d{9}$/.test(recipient)) {
        const err = `[SMS] Número inválido: "${to}" → normalizado para "${recipient}". A ignorar envio.`;
        console.error(err);
        await logSmsToDb(to, cleanText, 'FAILED', err);
        return { success: false, error: err };
    }

    try {
        const url = `${TELCO_BASE_URL}/send_message`;

        const payload = {
            message: {
                api_key_app: TELCO_API_KEY,
                phone_number: recipient,
                message_body: cleanText
            }
        };

        console.log(`[SMS-TelcoSMS] Enviando SMS...`);

        const response = await axios.post(url, payload, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 15000
        });

        const data = response.data;

        // TelcoSMS retorna erro via status HTTP ou campo de erro no body
        if (response.status !== 200 || data?.error || data?.status === 'error') {
            const errMsg = data?.message || data?.error || 'TelcoSMS erro desconhecido';
            console.error(`[SMS-TelcoSMS] ❌ Erro: ${errMsg}`);
            await logSmsToDb(recipient, cleanText, 'FAILED', errMsg);
            return { success: false, error: errMsg };
        }

        console.log(`[SMS-TelcoSMS] ✅ Enviado com sucesso`);
        await logSmsToDb(recipient, cleanText, 'SENT');
        return { success: true, data };

    } catch (error) {
        const errMsg = error.response?.data?.message
            || error.response?.data
            || error.message;

        console.error(`[SMS-TelcoSMS] ❌ Falha:`, errMsg);
        const errorString = typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg);
        await logSmsToDb(recipient, cleanText, 'FAILED', errorString);
        return {
            success: false,
            error: errorString
        };
    }
};

// ============================================================================
// Consultar Saldo
// ============================================================================

/**
 * Consulta o saldo de SMS disponível na conta TelcoSMS.
 * @returns {Promise<object>}
 */
const checkBalance = async () => {
    if (!TELCO_API_KEY) {
        return { success: false, error: 'TELCO_API_KEY não configurado' };
    }

    try {
        const response = await axios.get(`${TELCO_BASE_URL}/check_balance`, {
            params: { api_key_app: TELCO_API_KEY },
            timeout: 10000
        });
        return { success: true, data: response.data };
    } catch (error) {
        return { success: false, error: error.message };
    }
};

// ============================================================================
// Templates de SMS
// ============================================================================

/**
 * Envia código OTP de verificação.
 * @param {string} phone
 * @param {string} code - Código de 4 dígitos
 */
const sendOtpSms = async (phone, code) => {
    const message = `EcoFlix: O seu código é ${code}. Válido por 10 min.`;
    return sendSms(phone, message);
};

/**
 * Envia credenciais Netflix após pagamento confirmado.
 * @param {string} phone
 * @param {{ email: string, password: string, profile: string, pin: string, plan_type: string, expires_at: string }} creds
 */
const sendDeliverySms = async (phone, creds) => {
    let message = `Pagamento confirmado!\nEmail: ${creds.email || 'N/A'}`;
    message += `\nSenha: ${creds.password || 'N/A'}`;
    if (creds.profile) message += `\nPerfil: ${creds.profile}`;
    if (creds.pin && creds.pin !== 'N/A') message += `\nPIN: ${creds.pin}`;
    return sendSms(phone, message, { forceUnicode: true });
};


/**
 * Envia notificação de stock esgotado ao cliente.
 * @param {string} phone
 * @param {string} planType - Tipo de plano comprado
 */
const sendStockOutSms = async (phone, planType = 'N/A') => {
    const message = `EcoFlix: Sem stock. Aguarde as credenciais. Ajuda: ${getSupportNumber()}`;
    return sendSms(phone, message);
};

/**
 * Envia confirmação de renovação de subscrição.
 * @param {string} phone
 * @param {string} newExpiry - Data ISO
 */
const sendRenewalSms = async (phone, newExpiry) => {
    const date = new Date(newExpiry).toLocaleDateString('pt-PT');
    const message = `EcoFlix: Renovação concluída! Nova validade: ${date}`;
    return sendSms(phone, message);
};

/**
 * Envia nova senha da conta mãe em caso de reset de segurança.
 * @param {string} phone
 * @param {{ email: string, password: string, pin?: string }} creds
 */
const sendPasswordUpdateSms = async (phone, creds) => {
    let message = `Senha alterada!\n${creds.email}\nS: ${creds.password}`;
    if (creds.pin) message += `\nPIN: ${creds.pin}`;
    return sendSms(phone, message, { forceUnicode: true });
};

/**
 * Envia notificação de revogação de conta (Violação de Termos).
 * @param {string} phone 
 */
const sendRevokeSms = async (phone, reason = 'Violação de Termos') => {
    const message = `EcoFlix: Conta revogada. Motivo: ${reason}`;
    return sendSms(phone, message);
};

module.exports = {
    normalizePhone,
    sendSms,
    sendOtpSms,
    sendDeliverySms,
    sendStockOutSms,
    sendRenewalSms,
    sendPasswordUpdateSms,
    sendRevokeSms,
    checkBalance
};

const sendSuspendSms = async (phone, reason = 'Violação de Termos') => {
    const message =
        `EcoFlix - Alerta de Conta\n\n` +
        `A sua subscrição foi suspensa.\n` +
        `Motivo: ${reason}\n\n` +
        `Contacte o suporte imediatamente para resolver.`;
    return sendSms(phone, message);
};

const sendRestoreSms = async (phone) => {
    const message =
        `EcoFlix - Conta Restaurada\n\n` +
        `Boas noticias! A sua subscrição foi reactivada e já pode voltar a usar o serviço.`;
    return sendSms(phone, message);
};

const send5DaysExpirySms = async (phone) => {
    const message = `A sua assinatura EcoFlix expira em 5 dias. Evite cortes! Aceda a ecokambio.com/minha-conta para renovar.`;
    return sendSms(phone, message);
};

const sendFinalDayExpirySms = async (phone) => {
    const message = `A sua assinatura EcoFlix termina hoje! Renove agora em ecokambio.com/minha-conta para continuar a assistir.`;
    return sendSms(phone, message);
};

module.exports.sendSuspendSms = sendSuspendSms;
module.exports.sendRestoreSms = sendRestoreSms;
module.exports.send5DaysExpirySms = send5DaysExpirySms;
module.exports.sendFinalDayExpirySms = sendFinalDayExpirySms;

const sendAdminPinExpiredSms = async (adminPhone, email, profileName, newPin) => {
    const message = `ALERTA ECOFLIX!\nPerfil '${profileName}' expirou.\nNovo PIN: ${newPin}\nAltere na Netflix!`;
    return sendSms(adminPhone, message, { forceUnicode: true });
};
module.exports.sendAdminPinExpiredSms = sendAdminPinExpiredSms;

const sendSupportResolutionSms = async (phone, customMessage) => {
    let message = 'EcoFlix: O problema que reportou foi resolvido. Aceda ao seu painel ou contacte-nos se precisar de mais ajuda.';
    if (customMessage && customMessage.trim() !== '') {
        message = `EcoFlix: O seu problema foi resolvido. Mensagem da equipa: ${customMessage}`;
    }
    return sendSms(phone, message);
};
module.exports.sendSupportResolutionSms = sendSupportResolutionSms;
