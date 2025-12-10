# 🤖 Configuração do n8n para EcoKambio

Guia completo para configurar o n8n no Render e automatizar processos do EcoKambio.

---

## 📋 Índice

1. [O que é n8n](#o-que-é-n8n)
2. [Deploy no Render](#deploy-no-render)
3. [Configuração Inicial](#configuração-inicial)
4. [Primeiro Workflow](#primeiro-workflow)
5. [Integrações Essenciais](#integrações-essenciais)
6. [Workflows Recomendados](#workflows-recomendados)

---

## 🎯 O que é n8n

**n8n** é uma ferramenta de automação de workflows (similar ao Zapier/Make) mas:
- ✅ **Open Source** - Código aberto
- ✅ **Self-hosted** - Deploy na vossa infraestrutura
- ✅ **Gratuito** - Sem limites de execuções
- ✅ **Flexível** - Suporta código JavaScript customizado

---

## 🚀 Deploy no Render

### Passo 1: Criar Novo Web Service

1. Acesse [Render Dashboard](https://dashboard.render.com)
2. Clique em **New** → **Web Service**
3. Escolha **Deploy from Git**
4. Conecte ao repositório: `n8n-io/n8n`
   - Ou use a imagem Docker: `n8nio/n8n:latest`

### Passo 2: Configurar o Service

**Build Command:**
```bash
# Não precisa (usar Docker)
```

**Start Command:**
```bash
n8n start
```

**Environment Variables:**
```env
# Básico
N8N_BASIC_AUTH_ACTIVE=true
N8N_BASIC_AUTH_USER=admin
N8N_BASIC_AUTH_PASSWORD=SuaSenhaForte123!

# Host
N8N_HOST=seu-n8n.onrender.com
N8N_PORT=5678
N8N_PROTOCOL=https

# Webhook
WEBHOOK_URL=https://seu-n8n.onrender.com/

# Timezone
GENERIC_TIMEZONE=Africa/Luanda

# Database (PostgreSQL no Render)
DB_TYPE=postgresdb
DB_POSTGRESDB_HOST=seu-postgres.render.com
DB_POSTGRESDB_PORT=5432
DB_POSTGRESDB_DATABASE=n8n
DB_POSTGRESDB_USER=n8n_user
DB_POSTGRESDB_PASSWORD=sua_db_password
```

### Passo 3: Criar PostgreSQL Database

1. No Render: **New** → **PostgreSQL**
2. Nome: `n8n-database`
3. Copie as credenciais para as variáveis acima

### Passo 4: Deploy

1. Clique em **Create Web Service**
2. Aguarde o deploy (5-10 minutos)
3. Acesse: `https://seu-n8n.onrender.com`
4. Login com as credenciais configuradas

---

## ⚙️ Configuração Inicial

### 1. Primeiro Acesso

Após login, você verá o dashboard do n8n.

### 2. Configurar Credenciais Supabase

1. **Settings** → **Credentials** → **Add Credential**
2. Escolha **Supabase**
3. Configure:
   ```
   Host: https://drkjkkpzujwnkghtdokz.supabase.co
   Service Role Key: sua-service-key
   ```

### 3. Configurar Webhook URL

1. **Settings** → **General**
2. Confirm **Webhook URL**: `https://seu-n8n.onrender.com/`

---

## 🔧 Primeiro Workflow

### Workflow: Notificação de Mudança de Taxas

**Objetivo**: Enviar notificação quando taxas mudarem significativamente.

#### Passo 1: Criar Novo Workflow

1. Click **Add Workflow**
2. Nome: `Notificação Taxas Cambiais`

#### Passo 2: Adicionar Nodes

**1. Webhook Trigger**
```
Node: Webhook
Method: POST
Path: taxas-mudaram
Response: Immediately
```

**2. Filter (Se mudança > 2%)**
```
Node: IF
Condition: {{ $json.mudanca_percentual > 2 }}
```

**3. Send Telegram Message**
```
Node: Telegram
Action: Send Message
Chat ID: seu-chat-id
Message: 
🚨 Alerta de Taxas!

Banco: {{ $json.banco }}
USD: {{ $json.nova_taxa }} AOA
Mudança: {{ $json.mudanca_percentual }}%

#EcoKambio
```

**4. Log to Google Sheets**
```
Node: Google Sheets
Action: Append
Sheet: Histórico Taxas
Values:
- Data: {{ $now }}
- Banco: {{ $json.banco }}
- Taxa anterior: {{ $json.taxa_anterior }}
- Taxa nova: {{ $json.nova_taxa }}
- Mudança: {{ $json.mudanca_percentual }}
```

#### Passo 3: Ativar Workflow

1. Clique em **Active**
2. Copie o Webhook URL

---

## 🔗 Integrações Essenciais

### 1. Supabase

**Uso**: Ler/escrever dados da BD

**Nodes disponíveis:**
- `Supabase` - Query builder
- `HTTP Request` - API REST direta

**Exemplo:**
```javascript
// Get latest rates
SELECT * FROM exchange_rates 
WHERE updated_at > NOW() - INTERVAL '1 hour'
ORDER BY updated_at DESC
```

### 2. Telegram

**Setup:**
1. Crie um bot com [@BotFather](https://t.me/botfather)
2. Copie o Token
3. Adicione credencial no n8n

**Uso**: Notificações, alertas, relatórios

### 3. Google Sheets

**Setup:**
1. Criar Google Service Account
2. Baixar JSON key
3. Adicionar credencial no n8n

**Uso**: Histórico, relatórios, backup

### 4. SendGrid / SMTP

**Setup:**
1. Criar conta SendGrid (Free: 100 emails/dia)
2. Gerar API Key
3. Adicionar credencial no n8n

**Uso**: Email notifications, relatórios

---

## 📊 Workflows Recomendados

### 1. ✅ Backup Diário de BD

```
Schedule Trigger (Daily 00:00)
  ↓
Supabase Query (Get all data)
  ↓
Google Drive (Upload backup)
  ↓
Telegram (Confirmation)
```

### 2. 🚨 Alerta de Falha no Scraper

```
Webhook from EcoKambio API
  ↓
IF (error detected)
  ↓
├─ Telegram (Alert admin)
├─ Email (Technical team)
└─ Google Sheets (Log error)
```

### 3. 📈 Relatório Semanal

```
Schedule Trigger (Monday 9AM)
  ↓
Supabase (Get week statistics)
  ↓
Function (Generate report)
  ↓
├─ Email (Send PDF)
└─ Google Sheets (Archive)
```

### 4. 📱 Post Automático Redes Sociais

```
Webhook (Taxa mudou > 2%)
  ↓
Function (Format message)
  ↓
├─ Twitter (Post update)
├─ Facebook (Post)
└─ Telegram (Channel)
```

### 5. 💬 Notificações WhatsApp Business

```
Schedule Trigger (Daily 8AM)
  ↓
Supabase (Get today rates)
  ↓
Function (Format message)
  ↓
WhatsApp Business API (Send to subscribers)
```

---

## 🔌 Webhooks no EcoKambio

### Adicionar Webhooks à API

**Arquivo**: `webscraper/scheduler.js`

Adicione após scraping bem-sucedido:

```javascript
const axios = require('axios');

async function notifyN8N(data) {
    const n8nWebhook = process.env.N8N_WEBHOOK_URL;
    
    if (!n8nWebhook) return;
    
    try {
        await axios.post(n8nWebhook, {
            tipo: 'taxa_atualizada',
            banco: data.banco,
            taxa_anterior: data.oldRate,
            nova_taxa: data.newRate,
            mudanca_percentual: ((data.newRate - data.oldRate) / data.oldRate * 100).toFixed(2),
            timestamp: new Date().toISOString()
        });
        
        console.log('✅ n8n notificado');
    } catch (error) {
        console.error('❌ Erro ao notificar n8n:', error.message);
    }
}

// Chamar após atualizar taxa
await notifyN8N({
    banco: 'BAI',
    oldRate: 930,
    newRate: 945
});
```

Adicione ao `.env`:
```env
N8N_WEBHOOK_URL=https://seu-n8n.onrender.com/webhook/taxas-mudaram
```

---

## 📝 Workflow JSON Export

### Template: Notificação Básica

```json
{
  "name": "Notificação Taxas EcoKambio",
  "nodes": [
    {
      "parameters": {
        "httpMethod": "POST",
        "path": "taxas-mudaram",
        "responseMode": "onReceived"
      },
      "name": "Webhook",
      "type": "n8n-nodes-base.webhook",
      "position": [250, 300]
    },
    {
      "parameters": {
        "chatId": "SEU_CHAT_ID",
        "text": "=🚨 Taxa Atualizada!\n\nBanco: {{$json[\"banco\"]}}\nNova Taxa: {{$json[\"nova_taxa\"]}} AOA\nMudança: {{$json[\"mudanca_percentual\"]}}%"
      },
      "name": "Telegram",
      "type": "n8n-nodes-base.telegram",
      "credentials": {
        "telegramApi": "Telegram Credentials"
      },
      "position": [450, 300]
    }
  ],
  "connections": {
    "Webhook": {
      "main": [[{"node": "Telegram", "type": "main", "index": 0}]]
    }
  }
}
```

**Para importar:**
1. n8n Dashboard → **Import from File**
2. Cole o JSON acima
3. Configure credenciais
4. Ative o workflow

---

## 🔒 Segurança

### Proteger Webhooks

1. **Basic Auth** sempre ativo
2. **Webhook paths** complexos: `/webhook/xk92jf-taxas-update`
3. **Validate payload** com secret token:

```javascript
// no n8n Function node
if ($json.secret !== 'seu-token-secreto') {
    throw new Error('Unauthorized');
}
```

### Variáveis de Ambiente

Nunca exponha:
- ❌ API Keys
- ❌ Database passwords
- ❌ Webhook URLs públicas

Use sempre variáveis de ambiente no n8n.

---

## 📚 Recursos

- [n8n Documentation](https://docs.n8n.io)
- [n8n Community](https://community.n8n.io)
- [Workflow Templates](https://n8n.io/workflows)
- [Render n8n Guide](https://render.com/docs/deploy-n8n)

---

## ✅ Próximos Passos

1. [ ] Deploy n8n no Render
2. [ ] Configurar credenciais Supabase
3. [ ] Criar primeiro workflow (notificações)
4. [ ] Adicionar webhooks à API do EcoKambio
5. [ ] Testar e ativar workflows

---

**Desenvolvido para EcoKambio by Moko Tech** 🚀
