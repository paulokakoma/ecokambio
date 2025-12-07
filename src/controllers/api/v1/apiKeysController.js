const supabase = require('../../../config/supabase');
const crypto = require('crypto');

/**
 * Generate a secure API key
 * Format: eck_live_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
 */
function generateApiKey() {
    const prefix = 'eck_live_';
    const randomBytes = crypto.randomBytes(24);
    const key = prefix + randomBytes.toString('base64url');
    return key;
}

/**
 * Generate new API key
 * POST /api/v1/keys/generate
 * Body: { name, email, project_description }
 */
const generateKey = async (req, res) => {
    try {
        const { name, email, project_description } = req.body;

        // Validation
        if (!name || !email) {
            return res.apiError(
                'MISSING_PARAMETERS',
                'Nome e email são obrigatórios',
                400
            );
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.apiError(
                'INVALID_EMAIL',
                'Email inválido',
                400
            );
        }

        // Generate key
        const apiKey = generateApiKey();

        // Save to database
        const { data, error } = await supabase
            .from('api_keys')
            .insert([{
                key: apiKey,
                name,
                email,
                project_description: project_description || null,
                rate_limit_tier: 'standard', // 1000 req/15min
                is_active: true
            }])
            .select()
            .single();

        if (error) throw error;

        return res.apiSuccess({
            key: apiKey,
            name: data.name,
            email: data.email,
            rate_limit: '1000 requests / 15 minutes',
            created_at: data.created_at
        }, 201);

    } catch (error) {
        console.error('Error generating API key:', error);
        return res.apiError(
            'KEY_GENERATION_ERROR',
            'Erro ao gerar API key',
            500,
            { message: error.message }
        );
    }
};

/**
 * List user's API keys
 * GET /api/v1/keys/my-keys?email=xxx
 */
const listMyKeys = async (req, res) => {
    try {
        const { email } = req.query;

        if (!email) {
            return res.apiError(
                'MISSING_EMAIL',
                'Email é obrigatório',
                400
            );
        }

        const { data, error } = await supabase
            .from('api_keys')
            .select('id, name, usage_count, last_used_at, created_at, is_active')
            .eq('email', email)
            .order('created_at', { ascending: false });

        if (error) throw error;

        return res.apiSuccess({
            email,
            total: data.length,
            keys: data
        });

    } catch (error) {
        console.error('Error listing keys:', error);
        return res.apiError(
            'LIST_KEYS_ERROR',
            'Erro ao listar keys',
            500,
            { message: error.message }
        );
    }
};

/**
 * Revoke an API key
 * POST /api/v1/keys/revoke
 * Body: { key }
 */
const revokeKey = async (req, res) => {
    try {
        const { key } = req.body;

        if (!key) {
            return res.apiError(
                'MISSING_KEY',
                'API key é obrigatória',
                400
            );
        }

        const { data, error } = await supabase
            .from('api_keys')
            .update({
                is_active: false,
                revoked_at: new Date().toISOString()
            })
            .eq('key', key)
            .select()
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return res.apiError(
                    'KEY_NOT_FOUND',
                    'API key não encontrada',
                    404
                );
            }
            throw error;
        }

        return res.apiSuccess({
            message: 'API key revogada com sucesso',
            key_name: data.name,
            revoked_at: data.revoked_at
        });

    } catch (error) {
        console.error('Error revoking key:', error);
        return res.apiError(
            'REVOKE_KEY_ERROR',
            'Erro ao revogar key',
            500,
            { message: error.message }
        );
    }
};

/**
 * Get key statistics
 * GET /api/v1/keys/:keyId/stats
 */
const getKeyStats = async (req, res) => {
    try {
        const { keyId } = req.params;

        const { data, error } = await supabase
            .from('api_keys')
            .select('name, usage_count, last_used_at, created_at, is_active, rate_limit_tier')
            .eq('id', keyId)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return res.apiError(
                    'KEY_NOT_FOUND',
                    'API key não encontrada',
                    404
                );
            }
            throw error;
        }

        return res.apiSuccess(data);

    } catch (error) {
        console.error('Error fetching key stats:', error);
        return res.apiError(
            'STATS_ERROR',
            'Erro ao buscar estatísticas',
            500,
            { message: error.message }
        );
    }
};

module.exports = {
    generateKey,
    listMyKeys,
    revokeKey,
    getKeyStats
};
