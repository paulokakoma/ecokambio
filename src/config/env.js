const path = require("path");
const dotenv = require("dotenv");

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const requiredVars = [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'ADMIN_PASSWORD_HASH',
    'SESSION_SECRET'
];

// Check for either service key
if (!process.env.SUPABASE_SERVICE_KEY && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    requiredVars.push('SUPABASE_SERVICE_KEY (or SUPABASE_SERVICE_ROLE_KEY)');
}

const missingVars = requiredVars.filter(key => {
    if (key.includes(' (or ')) return false; // Already checked manually above
    return !process.env[key];
});

if (missingVars.length > 0) {
    console.error(`Erro: Variáveis de ambiente em falta: ${missingVars.join(', ')}`);
    process.exit(1);
}

module.exports = {
    port: process.env.PORT || 3000,
    nodeEnv: process.env.NODE_ENV || 'development',
    isDevelopment: process.env.NODE_ENV !== 'production',
    supabase: {
        url: process.env.SUPABASE_URL,
        serviceKey: process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
        anonKey: process.env.SUPABASE_ANON_KEY
    },
    admin: {
        passwordHash: process.env.ADMIN_PASSWORD_HASH,
        secretPath: process.env.ADMIN_SECRET_PATH || '/admin'
    },
    session: {
        secret: process.env.SESSION_SECRET,
        cookieDomain: process.env.COOKIE_DOMAIN
    },
    openai: {
        apiKey: process.env.OPENAI_API_KEY
    },
    requesty: {
        apiKey: process.env.REQUESTY_API_KEY,
        baseUrl: process.env.REQUESTY_BASE_URL || 'https://router.requesty.ai/v1'
    },
    groq: {
        apiKey: process.env.GROQ_API_KEY,
        baseUrl: process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1'
    },
    sheetsSyncToken: process.env.SHEETS_SYNC_TOKEN,
    apiSecretKey: process.env.API_SECRET_KEY
};
