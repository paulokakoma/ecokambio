const { createClient } = require('@supabase/supabase-js');
const config = require('../../../config/env');

// Initialize Supabase Client
const supabase = createClient(config.supabase.url, config.supabase.serviceKey);

// Helper to load transformers dynamically (ESM handling)
const getPipeline = async () => {
    const { pipeline } = await import('@xenova/transformers');
    return pipeline;
};

// Singleton for embedding pipeline
let embeddingPipeline = null;

const loadEmbeddingPipeline = async () => {
    if (!embeddingPipeline) {
        console.log("📥 Loading Embedding Model (Xenova/all-MiniLM-L6-v2)...");
        const pipeline = await getPipeline();
        embeddingPipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    }
};

const chatController = {
    chat: async (req, res) => {
        try {
            const { message } = req.body;

            if (!message) {
                return res.status(400).json({ error: 'Mensagem é obrigatória' });
            }

            // Ensure embedding pipeline is loaded
            await loadEmbeddingPipeline();

            // 1. Generate Embedding for the question (local)
            const output = await embeddingPipeline(message, { pooling: 'mean', normalize: true });
            const queryEmbedding = Array.from(output.data);

            // 2. Search in Supabase (384 dimensions) - Lower threshold for better recall
            const { data: documents, error } = await supabase.rpc('match_documents', {
                query_embedding: queryEmbedding,
                match_threshold: 0.15,
                match_count: 8
            });

            if (error) {
                console.error('Supabase Search Error:', error);
                throw new Error('Erro ao buscar conhecimento.');
            }

            // 3. Construct Context
            const contextText = documents.map(doc => doc.content).join('\n---\n');
            const sources = documents.map(doc => doc.metadata?.source).filter((v, i, a) => a.indexOf(v) === i);

        // 4. Generate Response using Groq AI (Llama 3.3 70B)
        const systemPrompt = `Você é a Ana, assistente virtual inteligente da EcoKambio. Seu foco atual é ajudar utilizadores com o Cartão Visa Virtual.

CONHECIMENTO ESPECIALISTA (VISA VIRTUAL):
- O QUE É: Cartão pré-pago internacional 100% digital. ACEITO EM: Netflix, Spotify, Shein, Alibaba, Amazon, Facebook Ads, Google Ads, OpenAI, etc.
- TAXA DE SERVIÇO: 10% fixos sobre o valor carregado.
- MÍNIMO DE CARREGAMENTO: $5 USD ou $5 EUR.
- PROCESSO: O cliente escolhe o valor -> Clica em "Pedir no WhatsApp" -> Recebe o IBAN -> Paga em Kwanzas (Kz) -> Envia comprovativo -> Recebe os dados do cartão em até 2 horas.
- SEGURANÇA: Empresa angolana registada (NIF 5002764768) sediada no Huambo.

PRINCÍPIOS:
- Tom: Jovem, amigável, direto (Português de Angola: fixe, kumbu, kwanza, etc.)
- Seja DIRETA (máximo 3 frases)
- Use informações DO CONTEXTO se disponíveis
- NUNCA invente preços se não souber
- Se não souber: Sugira falar no WhatsApp (wa.me/244938948994)

LINKS: /termos | /sobre | /fundadores | /visa`;

            const userPrompt = `CONTEXTO:
${contextText || "(vazio)"}

PERGUNTA: ${message}

RESPONDA usando APENAS o contexto. Se o contexto tem a resposta, forneça-a com detalhes.`;

            console.log("🤖 Generating response via Groq AI (Llama 3.3 70B)...");
            console.log("📄 Chunks encontrados:", documents?.length || 0);

            const chatResponse = await fetch(`${config.groq.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${config.groq.apiKey}`
                },
                body: JSON.stringify({
                    model: 'llama-3.1-8b-instant', // Fast model for chat
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userPrompt }
                    ],
                    temperature: 0.4,
                    max_tokens: 250
                })
            });

            if (!chatResponse.ok) {
                const errorText = await chatResponse.text();
                console.error('Groq API Error:', errorText);
                throw new Error('Erro ao gerar resposta');
            }

            const chatData = await chatResponse.json();
            const responseText = chatData.choices[0]?.message?.content || "Desculpe, não consegui processar sua pergunta.";

            // 5. Return response
            res.json({
                response: responseText,
                sources: sources
            });

        } catch (error) {
            console.error('Chat Error:', error);
            res.status(500).json({ error: 'Ocorreu um erro ao processar sua mensagem.' });
        }
    }
};

module.exports = chatController;
