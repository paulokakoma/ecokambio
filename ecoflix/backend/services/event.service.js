const supabase = require('../../../src/config/supabase');
const smsService = require('./sms.service');

const TABLE = 'ecoflix_events';
const MAX_EVENTS = 100;

const normalizeTargetPhone = (phone) => {
    if (!phone) return null;
    const normalized = smsService.normalizePhone(phone);
    return normalized || null;
};

const emit = async ({ audience, target_phone = null, type, payload = {} }) => {
    if (!audience || !type) return { success: false, message: 'Evento inválido' };

    try {
        const { error } = await supabase
            .from(TABLE)
            .insert({
                audience,
                target_phone: normalizeTargetPhone(target_phone),
                type,
                payload
            });

        if (error) {
            console.warn(`[EcoFlix Events] Falha ao gravar "${type}": ${error.message}`);
            return { success: false, message: error.message };
        }

        return { success: true };
    } catch (error) {
        console.warn(`[EcoFlix Events] Erro ao gravar "${type}": ${error.message}`);
        return { success: false, message: error.message };
    }
};

const emitAdmin = (type, payload = {}) => emit({ audience: 'admin', type, payload });

const emitUser = (phone, type, payload = {}) => emit({
    audience: 'phone',
    target_phone: phone,
    type,
    payload
});

const listForAdmin = async ({ since = 0 } = {}) => {
    try {
        const { data, error } = await supabase
            .from(TABLE)
            .select('id, audience, target_phone, type, payload, created_at')
            .in('audience', ['admin', 'all'])
            .gt('id', Number(since) || 0)
            .order('id', { ascending: true })
            .limit(MAX_EVENTS);

        if (error) {
            console.warn(`[EcoFlix Events] Poll admin falhou: ${error.message}`);
            return [];
        }

        return data || [];
    } catch (error) {
        console.warn(`[EcoFlix Events] Poll admin erro: ${error.message}`);
        return [];
    }
};

const listForUser = async ({ phone, since = 0 } = {}) => {
    const normalizedPhone = normalizeTargetPhone(phone);
    if (!normalizedPhone) return [];

    try {
        const minId = Number(since) || 0;
        const [targeted, global] = await Promise.all([
            supabase
                .from(TABLE)
                .select('id, audience, target_phone, type, payload, created_at')
                .eq('target_phone', normalizedPhone)
                .gt('id', minId)
                .order('id', { ascending: true })
                .limit(MAX_EVENTS),
            supabase
                .from(TABLE)
                .select('id, audience, target_phone, type, payload, created_at')
                .in('audience', ['user', 'all'])
                .is('target_phone', null)
                .gt('id', minId)
                .order('id', { ascending: true })
                .limit(MAX_EVENTS)
        ]);

        const errors = [targeted.error, global.error].filter(Boolean);
        if (errors.length > 0) {
            console.warn(`[EcoFlix Events] Poll user falhou: ${errors.map(e => e.message).join('; ')}`);
        }

        const events = [
            ...(targeted.data || []),
            ...(global.data || [])
        ];

        return events
            .sort((a, b) => a.id - b.id)
            .slice(0, MAX_EVENTS);
    } catch (error) {
        console.warn(`[EcoFlix Events] Poll user erro: ${error.message}`);
        return [];
    }
};

module.exports = {
    emit,
    emitAdmin,
    emitUser,
    listForAdmin,
    listForUser,
    normalizeTargetPhone
};
