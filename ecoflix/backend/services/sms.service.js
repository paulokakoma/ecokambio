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

const TELCO_BASE_URL = 'https://www.telcosms.co.ao/api/v2';
const TELCO_API_KEY  = process.env.TELCO_API_KEY;
const SMS_PROVIDER   = (process.env.SMS_PROVIDER || 'TELCO').toUpperCase();

// ============================================================================
// Phone Normalization
// ============================================================================

/**
 * Normaliza o número para formato local angolano (9 dígitos).
 * TelcoSMS é um provedor local — aceita números angolanos sem prefixo +244.
 */
const normalizePhone = (phone) => {
    let clean = phone.replace(/[\s\-]/g, '');

    if (clean.startsWith('+244'))   return clean.slice(4);  // remove +244
    if (clean.startsWith('244') && clean.length === 12) return clean.slice(3); // remove 244
    if (clean.length === 9)         return clean;           // já está correto
    return clean;
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
const sendSms = async (to, text) => {
    // FAKE mode — apenas para desenvolvimento local
    if (SMS_PROVIDER === 'FAKE') {
        console.log(`[SMS-FAKE] 📨 To: ${to} | Body: "${text}"`);
        await logSmsToDb(to, text, 'SENT');
        return { success: true, messageId: 'fake_' + Date.now() };
    }

    if (!TELCO_API_KEY) {
        const err = '[SMS-TelcoSMS] TELCO_API_KEY não configurado no .env';
        console.error(err);
        await logSmsToDb(to, text, 'FAILED', err);
        return { success: false, error: err };
    }

    const recipient = normalizePhone(to);

    try {
        const url = `${TELCO_BASE_URL}/send_message`;

        const payload = {
            message: {
                api_key_app: TELCO_API_KEY,
                phone_number: recipient,
                message_body: text
            }
        };

        console.log(`[SMS-TelcoSMS] Enviando para ${recipient}...`);

        const response = await axios.post(url, payload, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 15000
        });

        const data = response.data;

        // TelcoSMS retorna erro via status HTTP ou campo de erro no body
        if (response.status !== 200 || data?.error || data?.status === 'error') {
            const errMsg = data?.message || data?.error || 'TelcoSMS erro desconhecido';
            console.error(`[SMS-TelcoSMS] ❌ Erro: ${errMsg}`);
            await logSmsToDb(recipient, text, 'FAILED', errMsg);
            return { success: false, error: errMsg };
        }

        console.log(`[SMS-TelcoSMS] ✅ Enviado para ${recipient}`);
        await logSmsToDb(recipient, text, 'SENT');
        return { success: true, data };

    } catch (error) {
        const errMsg = error.response?.data?.message
            || error.response?.data
            || error.message;

        console.error(`[SMS-TelcoSMS] ❌ Falha:`, errMsg);
        const errorString = typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg);
        await logSmsToDb(recipient, text, 'FAILED', errorString);
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
    const message = `EcoFlix: Seu codigo de verificacao e: ${code}. Valido por 10 minutos.`;
    return sendSms(phone, message);
};

/**
 * Envia credenciais Netflix após pagamento confirmado.
 * @param {string} phone
 * @param {{ email: string, password: string, profile: string, pin: string }} creds
 */
const sendDeliverySms = async (phone, creds) => {
    let message =
        `Pagamento confirmado!\n\n` +
        `Aqui estão seus dados de acesso:\n` +
        `E-mail: ${creds.email}\n` +
        `Senha: ${creds.password}\n` +
        `Perfil: ${creds.profile}\n` +
        `Pin: ${creds.pin}`;

    const profileName = creds.profile || '';
    if (!profileName.toLowerCase().includes('exclusiva')) {
        message += `\nAVISO: Nao mude a senha para nao perder a conta!`;
    }

    return sendSms(phone, message);
};


/**
 * Envia confirmação de renovação de subscrição.
 * @param {string} phone
 * @param {string} newExpiry - Data ISO
 */
const sendRenewalSms = async (phone, newExpiry) => {
    const date = new Date(newExpiry).toLocaleDateString('pt-PT');
    const message = 
        `EcoFlix - Renovacao Concluida!\n\n` +
        `A sua subscricao foi renovada com sucesso.\n` +
        `Nova Validade: ${date}\n\n` +
        `Obrigado pela sua preferencia!`;
    return sendSms(phone, message);
};

/**
 * Envia nova senha da conta mãe em caso de reset de segurança.
 * @param {string} phone
 * @param {{ email: string, password: string, pin?: string }} creds
 */
const sendPasswordUpdateSms = async (phone, creds) => {
    let message = 
        `EcoFlix - Alerta de Seguranca\n\n` +
        `A senha da sua conta Netflix foi atualizada.\n` +
        `Email: ${creds.email}\n` +
        `Nova Senha: ${creds.password}\n`;
    
    if (creds.pin) {
        message += `O seu PIN mantem-se: ${creds.pin}\n`;
    }
    return sendSms(phone, message);
};

/**
 * Envia notificação de revogação de conta (Violação de Termos).
 * @param {string} phone 
 */
const sendRevokeSms = async (phone, reason = 'Violação de Termos') => {
    const message = 
        `EcoFlix - Alerta de Conta\n\n` +
        `A sua subscricao foi revogada.\n` +
        `Motivo: ${reason}\n\n` +
        `Contacte o suporte se julga ser um erro.`;
    return sendSms(phone, message);
};

module.exports = {
    sendSms,
    sendOtpSms,
    sendDeliverySms,
    sendRenewalSms,
    sendPasswordUpdateSms,
    sendRevokeSms,
    checkBalance
};

const sendSuspendSms = async (phone, reason = 'Violação de Termos') => {
    const message = 
        `EcoFlix - Alerta de Conta\n\n` +
        `A sua subscricao foi suspensa.\n` +
        `Motivo: ${reason}\n\n` +
        `Contacte o suporte imediatamente para resolver.`;
    return sendSms(phone, message);
};

const sendRestoreSms = async (phone) => {
    const message = 
        `EcoFlix - Conta Restaurada\n\n` +
        `Boas noticias! A sua subscricao foi reactivada e ja pode voltar a usar o servico.`;
    return sendSms(phone, message);
};

module.exports.sendSuspendSms = sendSuspendSms;
module.exports.sendRestoreSms = sendRestoreSms;
