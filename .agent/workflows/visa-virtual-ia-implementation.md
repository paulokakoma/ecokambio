---
description: Plano de Implementação da IA no Visa Virtual
---

# 🤖 Plano de Implementação da IA - Visa Virtual EcoKambio

## 📋 Visão Geral

Este documento detalha o plano completo para implementar e otimizar o assistente de IA "Ana" na página do Visa Virtual da EcoKambio. A IA utiliza o **Google Gemini 2.5 Flash Preview** para fornecer suporte inteligente aos clientes.

---

## 🎯 Objetivos

1. ✅ Configurar a API Gemini de forma segura
2. ✅ Melhorar a personalidade e qualidade das respostas da Ana
3. ✅ Implementar funcionalidades avançadas (navegação, cálculos, suporte)
4. ✅ Otimizar a experiência do usuário
5. ✅ Preparar para produção com segurança e monitoramento

---

## 🔧 Fase 1: Configuração Inicial

### 1.1 Obter API Key do Google Gemini

**Passos:**

1. Acessar [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Fazer login com conta Google
3. Clicar em "Get API Key" ou "Create API Key"
4. Copiar a chave gerada

**Quota Gratuito:**
- ✅ 1500 requisições/dia
- ✅ 15 requisições/minuto
- ✅ Suficiente para testar e lançar MVP

### 1.2 Armazenamento Seguro da API Key

**⚠️ NUNCA FAZER:**
- ❌ Hardcode da key no HTML: `const apiKey = "AIza..."`
- ❌ Commit da key no Git
- ❌ Expor a key em código client-side

**✅ OPÇÕES SEGURAS:**

#### **Opção A: Backend Proxy (RECOMENDADO)**
```javascript
// Criar endpoint no backend Node.js
// server/routes/ai.js
router.post('/api/chat', async (req, res) => {
  const { message } = req.body;
  
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: message }] }] })
    }
  );
  
  const data = await response.json();
  res.json(data);
});
```

**Frontend atualizado:**
```javascript
async function sendMessage() {
  // ... código existente ...
  
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: userPrompt })
  });
  
  const data = await response.json();
  // ... processar resposta ...
}
```

#### **Opção B: Variável de Ambiente (Para Testes Locais)**
```bash
# .env.local
GEMINI_API_KEY=AIzaSy...
```

```javascript
// No HTML, se usar build tools
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
```

---

## 🆓 Fase 1B: ALTERNATIVAS GRATUITAS (Sem Billing Account)

### ⚠️ Problema: Não Tenho Conta de Faturamento

Se não tem billing account ativo, **NÃO PODE** usar a API do Google Gemini. Mas existem **3 alternativas gratuitas** excelentes:

---

### **OPÇÃO 1: HuggingFace Inference API** ⭐ RECOMENDADO

**Vantagens:**
- ✅ 100% Gratuito (sem billing)
- ✅ Sem limite de requisições (rate limit razoável)
- ✅ Modelos de qualidade (Mixtral, Llama, etc.)
- ✅ API muito similar ao Gemini

**Setup (5 minutos):**

1. **Obter Token:**
   - Ir para [HuggingFace](https://huggingface.co/settings/tokens)
   - Criar conta grátis
   - Gerar Access Token (tipo: READ)

2. **Código Atualizado:**

```javascript
const HF_TOKEN = "hf_..."; // Seu token
const HF_MODEL = "mistralai/Mixtral-8x7B-Instruct-v0.1"; // Modelo gratuito

async function sendMessage() {
    const text = chatInput.value.trim();
    if (!text) return;
    
    chatInput.value = '';
    appendUserMessage(text);
    typingIndicator.classList.remove('hidden');

    const prompt = `${systemPrompt}\n\nUSER: ${text}\n\nRESPOND ONLY WITH JSON:`;

    try {
        const response = await fetch(
            `https://api-inference.huggingface.co/models/${HF_MODEL}`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${HF_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    inputs: prompt,
                    parameters: {
                        max_new_tokens: 500,
                        temperature: 0.7,
                        return_full_text: false
                    }
                })
            }
        );

        const data = await response.json();
        typingIndicator.classList.add('hidden');
        
        // Parse resposta
        let aiText = data[0].generated_text.trim();
        
        // Extrair JSON
        let jsonMatch = aiText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const result = JSON.parse(jsonMatch[0]);
            processAIResponse(result);
        } else {
            appendBotMessage(aiText);
        }

    } catch (error) {
        console.error(error);
        typingIndicator.classList.add('hidden');
        appendBotMessage("Erro de conexão. Tenta de novo! 😅");
    }
}

function processAIResponse(result) {
    if (result.type === 'nav') {
        performNavigation(result.url, result.message);
    } else if (result.type === 'calc') {
        // ... código de cálculo existente ...
    } else {
        appendBotMessage(result.answer);
    }
}
```

**Modelos Recomendados (Gratuitos):**
- `mistralai/Mixtral-8x7B-Instruct-v0.1` - Excelente qualidade
- `meta-llama/Llama-2-70b-chat-hf` - Muito bom para conversação
- `tiiuae/falcon-40b-instruct` - Rápido e eficiente

---

### **OPÇÃO 2: Chatbot Baseado em Regras** (Sem IA)

**Vantagens:**
- ✅ Zero custos, zero APIs
- ✅ 100% controlo das respostas
- ✅ Resposta instantânea
- ✅ Funciona offline

**Implementação Completa:**

```javascript
const CHAT_RULES = {
    // Preços de serviços
    "netflix": {
        type: "calc",
        items: [
            { name: "Netflix Básico", price: 9.99, currency: "$" },
            { name: "Netflix Standard", price: 15.49, currency: "$" },
            { name: "Netflix Premium", price: 19.99, currency: "$" }
        ]
    },
    "spotify": {
        type: "calc",
        items: [
            { name: "Spotify Premium", price: 10.99, currency: "$" }
        ]
    },
    "youtube": {
        type: "calc",
        items: [
            { name: "YouTube Premium", price: 11.99, currency: "$" }
        ]
    },
    
    // Navegação
    "blog": {
        type: "nav",
        url: "/blog",
        message: "A abrir o blog! 📰"
    },
    "termos": {
        type: "nav",
        url: "/termos",
        message: "Aqui estão os termos! 📄"
    },
    "home": {
        type: "nav",
        url: "/",
        message: "Voltando para a home! 🏠"
    },
    
    // FAQ
    "como funciona|como pagar|processo": {
        type: "qa",
        answer: "É fácil! 💳\n\n1. Escolhe o valor (USD ou EUR)\n2. Clica em 'Pedir no WhatsApp'\n3. Recebes o IBAN\n4. Pagas por transferência em Kz\n5. Envias o comprovativo\n6. Recebes o cartão em **até 2h**!"
    },
    "quanto tempo|demora": {
        type: "qa",
        answer: "O cartão chega em **até 2 horas úteis** depois de confirmares o pagamento! ⚡"
    },
    "onde usar|funciona onde|aceita": {
        type: "qa",
        answer: "Funciona em todo o lado que aceite Visa! 🌍\n\n✅ Netflix, Spotify, YouTube\n✅ Amazon, Shein, AliExpress\n✅ Facebook Ads, Google Ads\n✅ PayPal, Uber, Airbnb"
    },
    "taxas|preço|custo": {
        type: "qa",
        answer: "💰 **Taxas:**\n- Taxa de serviço: **10%**\n- Mínimo: **5 USD** ou **5 EUR**\n- Câmbio aprox: 1 USD = 1200 Kz | 1 EUR = 1300 Kz\n\nExemplo: Cartão de $10 → Pagas ~13.200 Kz"
    },
    "recarregar|recarrega|adicionar mais": {
        type: "qa",
        answer: "Cada cartão é de **uso único**. Quando acabar o saldo, é só pedir um novo! 💳"
    },
    "seguro|confiável|segurança": {
        type: "qa",
        answer: "100% seguro! 🔒\n\n✅ Empresa registada em Angola\n✅ Pagamento por transferência bancária\n✅ Dados criptografados\n✅ Suporte 24/7 no WhatsApp"
    }
};

async function sendMessage() {
    const text = chatInput.value.trim().toLowerCase();
    if (!text) return;
    
    chatInput.value = '';
    appendUserMessage(text);
    typingIndicator.classList.remove('hidden');
    
    // Simular delay de "pensamento"
    setTimeout(() => {
        typingIndicator.classList.add('hidden');
        
        // Procurar match nas regras
        let matched = false;
        
        for (const [keywords, response] of Object.entries(CHAT_RULES)) {
            const keywordList = keywords.split('|');
            
            if (keywordList.some(kw => text.includes(kw))) {
                matched = true;
                
                if (response.type === 'calc') {
                    showCalculation(response.items);
                } else if (response.type === 'nav') {
                    performNavigation(response.url, response.message);
                } else if (response.type === 'qa') {
                    appendBotMessage(response.answer);
                }
                break;
            }
        }
        
        // Resposta padrão se não encontrou match
        if (!matched) {
            appendBotMessage(
                "Hmm, não tenho certeza sobre isso. 🤔\n\n" +
                "Podes tentar:\n" +
                "- Perguntar sobre **Netflix, Spotify, YouTube**\n" +
                "- Saber **como funciona** o pagamento\n" +
                "- Ou fala direto no WhatsApp! 📱"
            );
        }
    }, 800);
}

function showCalculation(items) {
    const total = items.reduce((sum, item) => sum + item.price, 0);
    const symbol = items[0].currency === 'USD' ? '$' : '€';
    
    let itemsHtml = items.map(i => 
        `<div class="flex justify-between text-xs py-1 border-b border-indigo-50">
            <span class="text-indigo-900/70">${i.name}</span>
            <span class="font-bold text-indigo-700">${symbol}${i.price}</span>
        </div>`
    ).join('');
    
    const html = `
        <div class="p-0 -m-2">
            <div class="bg-indigo-50 p-3 rounded-lg mb-2">
                ${itemsHtml}
                <div class="flex justify-between mt-2 pt-2 border-t border-indigo-200">
                    <span class="font-bold text-indigo-600">Total</span>
                    <span class="font-black text-lg text-indigo-700">${symbol}${total.toFixed(2)}</span>
                </div>
            </div>
            <button onclick="applyValue(${total}, '${items[0].currency}')" 
                    class="w-full bg-indigo-600 text-white text-xs font-bold py-2 rounded-lg hover:bg-indigo-700">
                Usar Valor
            </button>
        </div>`;
    
    appendBotMessage(html);
}
```

**Expandir Regras:**
Para adicionar mais respostas, basta editar o objeto `CHAT_RULES`:

```javascript
"nome_da_regra|palavras|chave": {
    type: "qa",
    answer: "Sua resposta aqui"
}
```

---

### **OPÇÃO 3: Ollama (IA Local)** - Para Devs Avançados

**Vantagens:**
- ✅ 100% Gratuito e privado
- ✅ Sem limites de requisições
- ✅ Dados não saem do servidor
- ✅ Modelos potentes (Llama, Mistral)

**Desvantagens:**
- ❌ Precisa de servidor com GPU (ou CPU boa)
- ❌ Setup mais complexo
- ❌ Não funciona em hospedagem estática

**Setup:**

```bash
# 1. Instalar Ollama no servidor
curl -fsSL https://ollama.com/install.sh | sh

# 2. Baixar modelo (escolher um)
ollama pull llama2        # 7B - Leve
ollama pull mistral       # 7B - Melhor qualidade
ollama pull mixtral       # 47B - Muito bom (precisa GPU)

# 3. Rodar servidor
ollama serve
```

**Backend (Node.js):**

```javascript
// server/routes/ai.js
const express = require('express');
const router = express.Router();

router.post('/api/chat', async (req, res) => {
    const { message } = req.body;
    
    try {
        const response = await fetch('http://localhost:11434/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'mistral',
                prompt: message,
                stream: false
            })
        });
        
        const data = await response.json();
        res.json({ response: data.response });
        
    } catch (error) {
        res.status(500).json({ error: 'AI error' });
    }
});

module.exports = router;
```

**Frontend:**

```javascript
async function sendMessage() {
    // ... código existente ...
    
    const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userPrompt })
    });
    
    const data = await response.json();
    appendBotMessage(data.response);
}
```

---

## 📊 Comparação de Alternativas

| Característica | HuggingFace | Regras | Ollama | Gemini API |
|---------------|-------------|---------|---------|------------|
| **Custo** | Grátis | Grátis | Grátis | Pago (billing) |
| **Setup** | 5 min | 2 min | 30 min | 5 min |
| **Qualidade** | ⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Velocidade** | Média | Instantânea | Rápida | Rápida |
| **Requisitos** | API Token | Nada | Servidor | Billing |
| **Offline** | ❌ | ✅ | ✅ | ❌ |
| **Escalável** | ✅ | ✅ | ⚠️ | ✅ |

---

## 🏆 Recomendação Final

**Para começar AGORA (5 minutos):**
→ **OPÇÃO 2: Chatbot Baseado em Regras**
- Copy/paste do código acima
- Funciona imediatamente
- Zero dependências

**Para melhor qualidade (10 minutos):**
→ **OPÇÃO 1: HuggingFace**
- Criar conta grátis
- Obter token
- Trocar API endpoint

**Para projeto grande (longo prazo):**
→ **Ollama** ou **Gemini API** (quando tiver billing)

---

## 🎨 Fase 2: Melhorias no Prompt & Personalidade

### 2.1 Prompt System Otimizado

**Versão Melhorada do Contexto:**

```javascript
const contextInfo = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌍 CONTEXTO ECOKAMBIO - ANGOLA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔗 NAVEGAÇÃO:
- Home: /
- Blog: /blog
- Termos e Condições: /termos
- Fundadores: /fundadores
- FAQ: /faq
- Contato WhatsApp: https://wa.me/${WHATSAPP}

💳 PRODUTO: VISA VIRTUAL PRÉ-PAGO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📌 O QUE É:
- Cartão Visa virtual internacional
- 100% digital (número, validade, CVV por WhatsApp)
- Aceito em todas as plataformas que aceitam Visa
- Sem cartão físico

🛍️ ONDE USAR:
✅ Netflix, Spotify, YouTube Premium
✅ Shein, AliExpress, Amazon
✅ Facebook Ads, Google Ads, TikTok Ads
✅ PayPal (recarga), App Store, Google Play
✅ Uber, Airbnb, Booking.com

💰 PREÇOS & TAXAS:
- Mínimo: 5 USD ou 5 EUR
- Taxa de serviço: 10%
- Taxas bancárias: Incluídas no cálculo final
- Câmbio: USD = 1200 AOA | EUR = 1300 AOA (aproximado)

📋 PROCESSO DE COMPRA:
1. Cliente escolhe valor (USD ou EUR) nesta página
2. Clica em "Pedir no WhatsApp"
3. Recebe IBAN da EcoKambio via WhatsApp
4. Faz transferência bancária em Kwanzas (Kz)
5. Envia comprovativo
6. Recebe dados do cartão em até 2h úteis

💳 EXEMPLO PRÁTICO:
Cartão de $10 USD:
→ Conversão: 10 × 1200 = 12.000 Kz
→ Taxa 10%: 12.000 × 1.10 = 13.200 Kz
→ Cliente paga: 13.200 Kz

🔒 SEGURANÇA:
- Dados criptografados
- Pagamento por transferência bancária rastreável
- Suporte 24/7 via WhatsApp
- Empresa registada em Angola

❓ DÚVIDAS FREQUENTES:
Q: Posso recarregar o cartão?
A: Não, cada cartão é de uso único. Para mais fundos, pedir novo cartão.

Q: Quanto tempo demora?
A: Até 2 horas úteis após confirmação do pagamento.

Q: Funciona na Netflix Angola?
A: Sim! Funciona em qualquer plataforma que aceite Visa.

Q: Posso pedir para outra pessoa?
A: Sim, mas o IBAN será enviado para o número que fez o pedido.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
```

### 2.2 Personalidade da Ana (Aprimorada)

```javascript
const systemPrompt = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👩 IDENTITY: ANA - ASSISTENTE ECOKAMBIO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎭 PERSONALIDADE:
- Tom: Jovem, natural, amigável (não corporativo)
- Estilo: Direto ao ponto, sem floreados
- Linguagem: Português de Angola (Kz, bué, fixe)
- Emojis: Sim, mas com moderação (1-2 por mensagem)
- Proibido: "Fico feliz em ajudar", "À disposição", "Consulte o suporte"

✅ BOM:
"Ah, o Spotify? Sai a $10/mês. Queres que ponha esse valor no calculador? 🎵"

❌ MAU:
"Olá! Fico muito feliz em poder ajudá-lo com informações sobre o Spotify Premium. 
Por favor, consulte a nossa tabela de preços..."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🧠 REGRAS CRÍTICAS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. BREVIDADE: Máximo 3 frases por resposta (excepto listas)
2. AÇÃO: Sempre oferecer próximo passo ("Quer que calcule?", "Abro o WhatsApp?")
3. HONESTIDADE: Se não sabe, diz "Deixa ver no WhatsApp com a equipa"
4. VELOCIDADE: Respostas em JSON sempre (parsing 100%)
5. CONTEXTO: Usa o contexto fornecido, não inventa informação

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 TIPOS DE RESPOSTA (JSON):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1️⃣ NAVEGAÇÃO: Ir para outra página
{
  "type": "nav",
  "url": "/blog",
  "message": "Bora para o blog! 📝"
}

2️⃣ CÁLCULO: Mostrar preços de serviços
{
  "type": "calc",
  "items": [
    {"name": "Netflix HD", "price": 15.49, "currency": "$"},
    {"name": "Spotify Premium", "price": 10.99, "currency": "$"}
  ],
  "total": 26.48,
  "currency": "USD"
}

3️⃣ SUPORTE: Resposta em texto/markdown
{
  "type": "qa",
  "answer": "O cartão chega em **até 2h** depois do pagamento. Qualquer coisa, manda mensagem! 📱"
}

4️⃣ WHATSAPP: Abrir conversa direta
{
  "type": "whatsapp",
  "message": "Vou abrir o WhatsApp para falares direto com a equipa! 💬"
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 EXEMPLOS DE CONVERSAÇÃO:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

USER: "Quanto custa o Netflix?"
ANA: {"type":"calc","items":[{"name":"Netflix Básico","price":9.99,"currency":"$"}],"total":9.99,"currency":"USD"}

USER: "Como faço para pagar?"
ANA: {"type":"qa","answer":"É fácil! Clica no botão verde, escolhe o valor, e vais receber o IBAN no WhatsApp. Pagas por transferência bancária em Kz 💸"}

USER: "Leva-me ao blog"
ANA: {"type":"nav","url":"/blog","message":"A abrir o blog! 📰"}

USER: "Cartão para Spotify e Netflix"
ANA: {"type":"calc","items":[{"name":"Spotify","price":10.99,"currency":"$"},{"name":"Netflix HD","price":15.49,"currency":"$"}],"total":26.48,"currency":"USD"}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
```

---

## 💡 Fase 3: Funcionalidades Avançadas

### 3.1 Modo WhatsApp Direto

**Adicionar ao código:**

```javascript
// No processamento de resposta da IA
if (result.type === 'whatsapp') {
    appendBotMessage(result.message);
    setTimeout(() => {
        window.open(`https://wa.me/${WHATSAPP}`, '_blank');
    }, 1000);
}
```

### 3.2 Tabela de Preços de Serviços Comuns

**Criar objeto de preços:**

```javascript
const COMMON_SERVICES = {
  "netflix": [
    { name: "Netflix Básico", price: 9.99, currency: "USD" },
    { name: "Netflix Standard", price: 15.49, currency: "USD" },
    { name: "Netflix Premium", price: 19.99, currency: "USD" }
  ],
  "spotify": [
    { name: "Spotify Premium Individual", price: 10.99, currency: "USD" }
  ],
  "youtube": [
    { name: "YouTube Premium", price: 11.99, currency: "USD" }
  ],
  "amazon": [
    { name: "Amazon Prime", price: 14.99, currency: "USD" }
  ],
  "disney": [
    { name: "Disney+ Standard", price: 7.99, currency: "USD" }
  ]
};

// Fornecer ao prompt da IA
const servicesInfo = JSON.stringify(COMMON_SERVICES);
```

### 3.3 Histórico de Conversa

**Manter contexto das últimas 5 mensagens:**

```javascript
let conversationHistory = [];

async function sendMessage() {
  const userMessage = chatInput.value.trim();
  
  // Adicionar ao histórico
  conversationHistory.push({
    role: "user",
    parts: [{ text: userMessage }]
  });
  
  // Limitar histórico
  if (conversationHistory.length > 10) {
    conversationHistory = conversationHistory.slice(-10);
  }
  
  // Enviar com histórico
  const response = await fetch(API_URL, {
    method: 'POST',
    body: JSON.stringify({
      contents: conversationHistory,
      systemInstruction: { parts: [{ text: systemPrompt }] }
    })
  });
  
  // Adicionar resposta ao histórico
  conversationHistory.push({
    role: "model",
    parts: [{ text: aiResponse }]
  });
}
```

### 3.4 Quick Actions Inteligentes

**Botões dinâmicos baseados no contexto:**

```javascript
function updateQuickActions(lastBotMessage) {
  const quickActionsContainer = document.getElementById('quick-actions');
  
  // Se mencionou preço, mostrar "Usar Valor"
  if (lastBotMessage.includes('total')) {
    quickActionsContainer.innerHTML += `
      <button onclick="applyLastCalculation()">
        Usar este valor 💰
      </button>
    `;
  }
  
  // Se mencionou WhatsApp, mostrar botão direto
  if (lastBotMessage.toLowerCase().includes('whatsapp')) {
    quickActionsContainer.innerHTML += `
      <button onclick="window.open('https://wa.me/${WHATSAPP}', '_blank')">
        Abrir WhatsApp 💬
      </button>
    `;
  }
}
```

---

## 🧪 Fase 4: Testes

### 4.1 Casos de Teste

**Cenários de Suporte:**
```
✅ "Quanto custa o Netflix?"
✅ "Como funciona o pagamento?"
✅ "Quanto tempo demora?"
✅ "Posso usar no Spotify?"
✅ "Quero $50 de cartão"
✅ "Leva-me ao blog"
✅ "Quais são os termos?"
```

**Cenários de Erro:**
```
✅ Pergunta fora do contexto: "Qual a capital da França?"
   → Ana deve redirecionar para o tópico
   
✅ Pedido impossível: "Quero cartão grátis"
   → Ana deve explicar as taxas
   
✅ API offline
   → Mostrar mensagem amigável
```

### 4.2 Script de Teste Automatizado

```javascript
// tests/ai-chatbot.test.js
const testCases = [
  {
    input: "Quanto custa Netflix?",
    expectedType: "calc",
    shouldInclude: ["Netflix"]
  },
  {
    input: "Leva-me ao blog",
    expectedType: "nav",
    expectedUrl: "/blog"
  },
  {
    input: "Como pagar?",
    expectedType: "qa",
    shouldInclude: ["transferência", "WhatsApp"]
  }
];

async function runTests() {
  for (const test of testCases) {
    const response = await sendTestMessage(test.input);
    console.assert(
      response.type === test.expectedType,
      `Failed: ${test.input}`
    );
  }
}
```

---

## 🔒 Fase 5: Segurança & Produção

### 5.1 Rate Limiting

**Evitar abuso da API:**

```javascript
const MESSAGE_LIMIT = 10; // Por sessão
const COOLDOWN_MS = 2000; // 2 segundos entre mensagens

let messageCount = 0;
let lastMessageTime = 0;

async function sendMessage() {
  const now = Date.now();
  
  // Cooldown check
  if (now - lastMessageTime < COOLDOWN_MS) {
    appendBotMessage("Calma aí, estou a pensar! 😅");
    return;
  }
  
  // Limite de mensagens
  if (messageCount >= MESSAGE_LIMIT) {
    appendBotMessage(
      "Bora continuar no WhatsApp? Já falamos bué aqui! 📱 " +
      `<a href="https://wa.me/${WHATSAPP}">Clicar aqui</a>`
    );
    return;
  }
  
  messageCount++;
  lastMessageTime = now;
  
  // ... resto do código ...
}
```

### 5.2 Sanitização de Input

```javascript
function sanitizeInput(text) {
  // Remover HTML
  const div = document.createElement('div');
  div.textContent = text;
  let clean = div.innerHTML;
  
  // Limitar tamanho
  clean = clean.substring(0, 500);
  
  return clean;
}

async function sendMessage() {
  const userMessage = sanitizeInput(chatInput.value.trim());
  // ...
}
```

### 5.3 Error Handling Robusto

```javascript
async function sendMessage() {
  try {
    const response = await fetch(API_URL, { /* ... */ });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Validar resposta
    if (!data.candidates || !data.candidates[0]) {
      throw new Error('Invalid API response');
    }
    
    // ... processar ...
    
  } catch (error) {
    console.error('Chat error:', error);
    typingIndicator.classList.add('hidden');
    
    // Mensagens específicas
    if (error.message.includes('429')) {
      appendBotMessage(
        "Tou com muitas mensagens agora 😅 Experimenta daqui a 1 minuto, ou manda WhatsApp!"
      );
    } else if (error.message.includes('API key')) {
      appendBotMessage(
        "Problema técnico aqui... Usa o WhatsApp por agora! 🔧"
      );
    } else {
      appendBotMessage(
        "Ui, a net falhou. Tenta de novo ou fala no WhatsApp! 📱"
      );
    }
  }
}
```

### 5.4 Monitoramento

**Log de métricas:**

```javascript
function logChatMetrics(eventType, data) {
  // Google Analytics 4
  if (typeof gtag !== 'undefined') {
    gtag('event', eventType, {
      event_category: 'AI_Chat',
      ...data
    });
  }
  
  // Console (dev)
  if (location.hostname === 'localhost') {
    console.log('[CHAT METRICS]', eventType, data);
  }
}

// Uso:
logChatMetrics('message_sent', { message_length: text.length });
logChatMetrics('response_received', { response_type: result.type });
logChatMetrics('error_occurred', { error_type: error.message });
```

---

## 📊 Fase 6: Otimizações & Performance

### 6.1 Lazy Loading da API

**Carregar Gemini só quando abrir o chat:**

```javascript
let geminiLoaded = false;

function openChat() {
  chatModal.classList.remove('hidden');
  
  // Carregar API se necessário
  if (!geminiLoaded && !apiKey) {
    loadGeminiAPI();
    geminiLoaded = true;
  }
  
  // ... resto do código ...
}

async function loadGeminiAPI() {
  try {
    const response = await fetch('/api/get-api-key');
    const { key } = await response.json();
    apiKey = key;
  } catch (error) {
    console.error('Failed to load API key');
  }
}
```

### 6.2 Cache de Respostas Comuns

```javascript
const responseCache = new Map();

async function sendMessage() {
  const cacheKey = userMessage.toLowerCase().trim();
  
  // Verificar cache
  if (responseCache.has(cacheKey)) {
    const cached = responseCache.get(cacheKey);
    appendBotMessage(cached);
    return;
  }
  
  // ... chamar API ...
  
  // Guardar em cache (máx 20 respostas)
  if (responseCache.size >= 20) {
    const firstKey = responseCache.keys().next().value;
    responseCache.delete(firstKey);
  }
  responseCache.set(cacheKey, aiResponse);
}
```

### 6.3 Streaming de Resposta

**Para respostas mais longas, mostrar palavra a palavra:**

```javascript
async function streamResponse(text) {
  const words = text.split(' ');
  let currentText = '';
  
  const messageDiv = createBotMessageDiv();
  chatMessages.appendChild(messageDiv);
  
  for (let i = 0; i < words.length; i++) {
    currentText += words[i] + ' ';
    messageDiv.querySelector('.content').innerHTML = currentText;
    scrollToBottom();
    await new Promise(resolve => setTimeout(resolve, 50));
  }
}
```

---

## 📱 Fase 7: Melhorias de UX

### 7.1 Animações de Entrada

```css
@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.fade-in {
  animation: slideUp 0.3s ease-out;
}
```

### 7.2 Indicador de Leitura

```javascript
function showReadIndicator() {
  const lastMessage = chatMessages.lastElementChild;
  const indicator = document.createElement('div');
  indicator.className = "text-[9px] text-indigo-400 mt-1 text-right";
  indicator.innerHTML = '<i data-lucide="check-check" class="w-3 h-3 inline"></i> Lido';
  lastMessage.appendChild(indicator);
  lucide.createIcons();
}
```

### 7.3 Som de Notificação

```javascript
function playNotificationSound() {
  const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10...');
  audio.volume = 0.3;
  audio.play().catch(() => {}); // Ignorar se autoplay bloqueado
}

// Quando recebe mensagem da Ana
appendBotMessage(html);
playNotificationSound();
```

### 7.4 Badge de Mensagens Não Lidas

```html
<!-- No botão de abrir chat -->
<button onclick="openChat()" class="relative ...">
  <i data-lucide="sparkles"></i>
  Assistente IA
  <span id="unread-badge" class="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center hidden">1</span>
</button>
```

```javascript
let unreadCount = 0;

function incrementUnread() {
  if (chatModal.classList.contains('hidden')) {
    unreadCount++;
    document.getElementById('unread-badge').textContent = unreadCount;
    document.getElementById('unread-badge').classList.remove('hidden');
  }
}

function openChat() {
  // Reset
  unreadCount = 0;
  document.getElementById('unread-badge').classList.add('hidden');
  // ...
}
```

---

## 🚀 Fase 8: Deployment Checklist

### ✅ Pré-Deploy

- [ ] API Key configurada em variável de ambiente
- [ ] Backend proxy implementado (se aplicável)
- [ ] Rate limiting ativado
- [ ] Error handling testado
- [ ] Sanitização de inputs validada
- [ ] Cache configurado
- [ ] Analytics integrado

### ✅ Testes Finais

- [ ] Testar todos os casos de uso
- [ ] Testar em mobile (Chrome, Safari)
- [ ] Testar com internet lenta (throttling)
- [ ] Testar com API offline
- [ ] Testar limite de mensagens
- [ ] Verificar acessibilidade (ARIA labels)

### ✅ Monitoramento

- [ ] Dashboard de métricas (GA4)
- [ ] Alertas de erro (Sentry/LogRocket)
- [ ] Monitorar quota da API Gemini
- [ ] Feedback dos usuários

---

## 📈 Fase 9: Expansões Futuras

### 9.1 Multi-idioma

```javascript
const LANGUAGES = {
  pt: { /* prompts em português */ },
  en: { /* prompts em inglês */ },
  fr: { /* prompts em francês */ }
};

let currentLanguage = 'pt';

function setLanguage(lang) {
  currentLanguage = lang;
  systemPrompt = LANGUAGES[lang].systemPrompt;
}
```

### 9.2 Voice Input

```javascript
function startVoiceRecognition() {
  const recognition = new webkitSpeechRecognition();
  recognition.lang = 'pt-AO';
  
  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    chatInput.value = transcript;
    sendMessage();
  };
  
  recognition.start();
}
```

### 9.3 Sentiment Analysis

```javascript
function analyzeSentiment(userMessage) {
  const negative = ['zangado', 'mau', 'não funciona', 'problema'];
  const isNegative = negative.some(word => 
    userMessage.toLowerCase().includes(word)
  );
  
  if (isNegative) {
    // Priorizar resposta empática
    return { sentiment: 'negative', priority: 'high' };
  }
  
  return { sentiment: 'neutral', priority: 'normal' };
}
```

### 9.4 Integração com CRM

```javascript
async function saveChatToRecords(userId, messages) {
  await fetch('/api/crm/conversations', {
    method: 'POST',
    body: JSON.stringify({
      user_id: userId,
      messages: messages,
      timestamp: new Date().toISOString()
    })
  });
}
```

---

## 🎓 Recursos de Referência

### Documentação Oficial
- [Google Gemini API Docs](https://ai.google.dev/docs)
- [Gemini Pricing](https://ai.google.dev/pricing)
- [Best Practices](https://ai.google.dev/docs/best_practices)

### Tutoriais Recomendados
- [Prompt Engineering Guide](https://www.promptingguide.ai/)
- [JSON Mode in Gemini](https://ai.google.dev/docs/json_mode)

### Ferramentas
- [Google AI Studio](https://aistudio.google.com/) - Testar prompts
- [Gemini API Playground](https://ai.google.dev/tutorials/playground)

---

## 📞 Suporte

Para dúvidas sobre implementação:
1. Consultar documentação acima
2. Testar no Google AI Studio
3. Verificar logs do console
4. Contactar equipa técnica via WhatsApp

---

**Criado em:** 2025-12-11  
**Versão:** 1.0  
**Autor:** Antigravity AI  
**Projeto:** EcoKambio Visa Virtual
