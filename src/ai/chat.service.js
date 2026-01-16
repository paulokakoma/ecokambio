/**
 * Chat Service - Ana AI Assistant
 * Uses Groq API with Llama for fast responses
 * Integrates with RAG knowledge base stored in Supabase
 */

const { createClient } = require('@supabase/supabase-js');

// Groq API configuration
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_BASE_URL = process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1';
const GROQ_MODEL = 'llama-3.1-8b-instant'; // Fast and capable

// Supabase for RAG
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

// System prompt for Ana
const SYSTEM_PROMPT = `Tu és a Ana, a assistente virtual da EcoKambio - a principal plataforma de taxas de câmbio em Angola.

SOBRE TI:
- És simpática, profissional e prestável
- Respondes sempre em Português de Portugal/Angola
- Usas emojis ocasionalmente para ser mais amigável 😊
- Mantens respostas concisas mas informativas

SOBRE A ECOKAMBIO:
- Fundada em 2023 pela Moko Tech (Huambo, Angola)
- Monitoriza taxas de 6 bancos: BAI, BFA, BPC, BIC, BCI, Yetu
- Compara mercado formal (bancos) com informal (kinguilas)
- Serviços: Comparador de taxas, Calculadora de importação, Cartões Visa Virtual, Netflix Angola
- +50.000 utilizadores mensais
- Contacto: WhatsApp +244 938 948 994 | ecokambio@gmail.com

REGRAS:
1. Se não souberes algo sobre a EcoKambio, sugere contactar via WhatsApp
2. Para taxas de câmbio actuais, indica que podem ver em ecokambio.com
3. Nunca inventar informação - sê honesta se não souberes
4. Para questões sobre Visa Virtual, direcciona para /visa ou WhatsApp
5. Para Netflix, direcciona para /netflix

CONTEXTO ADICIONAL (se fornecido):
{context}`;

/**
 * Get relevant context from knowledge base using vector similarity
 */
async function getRelevantContext(query) {
    try {
        // For now, we'll do a simple text search
        // In production, use embeddings + vector similarity
        const { data: docs, error } = await supabase
            .from('documents')
            .select('content, metadata')
            .limit(3);

        if (error) {
            console.error('Error fetching documents:', error);
            return '';
        }

        if (!docs || docs.length === 0) {
            return '';
        }

        // Join relevant content
        return docs.map(d => d.content).join('\n\n');
    } catch (error) {
        console.error('Error in getRelevantContext:', error);
        return '';
    }
}

/**
 * Send message to Groq API
 */
async function sendToGroq(messages, context = '') {
    const systemPrompt = SYSTEM_PROMPT.replace('{context}', context || 'Nenhum contexto adicional.');

    const response = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${GROQ_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: GROQ_MODEL,
            messages: [
                { role: 'system', content: systemPrompt },
                ...messages
            ],
            temperature: 0.7,
            max_tokens: 500,
            stream: false
        })
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Groq API error: ${error}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
}

/**
 * Main chat function
 */
async function chat(userMessage, conversationHistory = []) {
    try {
        // Get relevant context from knowledge base
        const context = await getRelevantContext(userMessage);

        // Prepare messages
        const messages = [
            ...conversationHistory.slice(-6), // Keep last 6 messages for context
            { role: 'user', content: userMessage }
        ];

        // Send to Groq
        const response = await sendToGroq(messages, context);

        return {
            success: true,
            message: response,
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        console.error('Chat error:', error);
        return {
            success: false,
            message: 'Desculpa, estou com dificuldades técnicas. Por favor, tenta novamente ou contacta-nos via WhatsApp: +244 938 948 994 📱',
            error: error.message
        };
    }
}

/**
 * Health check for the chat service
 */
async function healthCheck() {
    try {
        const response = await fetch(`${GROQ_BASE_URL}/models`, {
            headers: {
                'Authorization': `Bearer ${GROQ_API_KEY}`
            }
        });
        return response.ok;
    } catch {
        return false;
    }
}

module.exports = {
    chat,
    healthCheck,
    getRelevantContext
};
