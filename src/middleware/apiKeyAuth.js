const supabase = require('../config/supabase');

/**
 * Optional API key authentication middleware
 * Checks for X-API-Key header and validates it if present
 * Does NOT block requests without a key (that's for public access)
 * If valid key found, attaches to req.apiKey and increases rate limits
 */
const optionalApiKeyAuth = async (req, res, next) => {
    try {
        const apiKey = req.headers['x-api-key'];

        // No API key provided - continue as public API
        if (!apiKey) {
            req.apiKey = null;
            return next();
        }

        // Validate API key format (basic check)
        if (!apiKey.startsWith('eck_live_') && !apiKey.startsWith('eck_test_')) {
            // Invalid format, but don't block - treat as public
            req.apiKey = null;
            return next();
        }

        // Look up key in database
        const { data, error } = await supabase
            .from('api_keys')
            .select('*')
            .eq('key', apiKey)
            .eq('is_active', true)
            .single();

        if (error || !data) {
            // Invalid key, but don't block - treat as public
            req.apiKey = null;
            return next();
        }

        // Valid key found! Attach to request
        req.apiKey = {
            id: data.id,
            key: data.key,
            name: data.name,
            email: data.email,
            tier: data.rate_limit_tier,
            usage_count: data.usage_count
        };

        // Update last_used_at and usage_count asynchronously
        // (non-blocking - fire and forget)
        supabase
            .from('api_keys')
            .update({
                usage_count: data.usage_count + 1,
                last_used_at: new Date().toISOString()
            })
            .eq('id', data.id)
            .then(() => { })
            .catch(err => console.error('Error updating key usage:', err));

        next();

    } catch (error) {
        console.error('API key auth error:', error);
        // On error, treat as public access
        req.apiKey = null;
        next();
    }
};

/**
 * Require d API key authentication (blocks without key)
 * Use this for premium endpoints only
 */
const requiredApiKeyAuth = async (req, res, next) => {
    try {
        const apiKey = req.headers['x-api-key'];

        if (!apiKey) {
            return res.status(401).json({
                success: false,
                error: {
                    code: 'API_KEY_REQUIRED',
                    message: 'API key é obrigatória para este endpoint'
                }
            });
        }

        // Validate format
        if (!apiKey.startsWith('eck_live_') && !apiKey.startsWith('eck_test_')) {
            return res.status(401).json({
                success: false,
                error: {
                    code: 'INVALID_API_KEY_FORMAT',
                    message: 'Formato de API key inválido'
                }
            });
        }

        // Look up key
        const { data, error } = await supabase
            .from('api_keys')
            .select('*')
            .eq('key', apiKey)
            .eq('is_active', true)
            .single();

        if (error || !data) {
            return res.status(401).json({
                success: false,
                error: {
                    code: 'INVALID_API_KEY',
                    message: 'API key inválida ou revogada'
                }
            });
        }

        // Valid key - attach to request
        req.apiKey = {
            id: data.id,
            key: data.key,
            name: data.name,
            email: data.email,
            tier: data.rate_limit_tier,
            usage_count: data.usage_count
        };

        // Update usage (non-blocking)
        supabase
            .from('api_keys')
            .update({
                usage_count: data.usage_count + 1,
                last_used_at: new Date().toISOString()
            })
            .eq('id', data.id)
            .then(() => { })
            .catch(err => console.error('Error updating key usage:', err));

        next();

    } catch (error) {
        console.error('API key auth error:', error);
        return res.status(500).json({
            success: false,
            error: {
                code: 'AUTH_ERROR',
                message: 'Erro ao autenticar API key'
            }
        });
    }
};

module.exports = {
    optional: optionalApiKeyAuth,
    required: requiredApiKeyAuth
};
