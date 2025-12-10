# 🚀 Deploy Final no Railway - Guia Rápido

## Status Atual

✅ **Código atualizado e pushed para GitHub**
- Session store fix aplicado
- PostgreSQL configurado para produção
- Todas as configurações Railway prontas

---

## 🎯 Deploy via Railway Dashboard (RECOMENDADO)

### Passo 1: Conectar Repositório GitHub

1. **Abra Railway Dashboard**: https://railway.com/project/85bb7ba7-2c83-464c-bf95-ede08aaa24c0

2. **Adicionar Serviço**:
   - Clique em **"+ New"**
   - Selecione **"GitHub Repo"**
   - Escolha **"paulokakoma/ecokambio"** (ou seu fork)
   - Branch: **main**

3. **Railway detecta automaticamente**:
   - `railway.toml` (configurações)
   - `package.json` (dependências)
   - Inicia build automaticamente

---

### Passo 2: Adicionar PostgreSQL (OBRIGATÓRIO)

Enquanto o primeiro deploy roda:

1. No mesmo projeto, clique em **"+ New"**
2. **"Database"** → **"Add PostgreSQL"**
3. Aguarde provisionar (~30 segundos)
4. Railway automaticamente:
   - Cria banco de dados
   - Adiciona `DATABASE_URL` ao serviço principal
   - Conecta os dois serviços

---

### Passo 3: Configurar Variáveis de Ambiente

1. **Clique no card do serviço** (Node.js app)

2. **Aba "Variables"** → **"RAW Editor"**

3. **Cole exatamente isto**:

```env
NODE_ENV=production
PORT=3000
SUPABASE_URL=https://drkjkkpzujwnkghtdokz.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRya2pra3B6dWp3bmtnaHRkb2t6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA1MTQ2MTYsImV4cCI6MjA3NjA5MDYxNn0.5dmxHiD0eU_8jA0P_J6onHTr8RSqpYYlIqnrychdSl8
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRya2pra3B6dWp3bmtnaHRkb2t6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDUxNDYxNiwiZXhwIjoyMDc2MDkwNjE2fQ.4XGLWVpA2zIqNe33_87YeWPuRx1qlfzRNMSOcPhZDqw
ADMIN_PASSWORD_HASH=$2b$12$yiHRJK4glOE15/.Pu7YOx.Snycf/Btw.h6I6CqLhF.Xw4toCzq9IW
SESSION_SECRET=0QN/qh6Eicr+OPUh4iV/4ZlNf6Tuj3l2tujhIKtC3ak=
ADMIN_SECRET_PATH=/acesso-admin-secreto-123
COOKIE_DOMAIN=
```

4. **"Update Variables"**

5. **Railway faz redeploy automaticamente**

> [!NOTE]
> `DATABASE_URL` é adicionado automaticamente quando você adiciona PostgreSQL

---

### Passo 4: Acompanhar o Build

1. **Aba "Deployments"**
2. Clique no deployment em andamento
3. **Veja os logs em tempo real**

**O que esperar**:
```
✅ Installing Playwright browsers... (~2 min)
✅ Building CSS... (~10 sec)
✅ Starting server...
✅ Using PostgreSQL session store for production
✅ Scraper scheduler started
✅ Server running on port 3000
```

**Tempo total**: ~3-5 minutos

---

### Passo 5: Verificar Deployment

Quando o deploy completar (verde):

1. **Settings** → **Domains**
2. Copie a URL fornecida (ex: `https://ecokambio-production.up.railway.app`)

**Teste no navegador**:
```
https://sua-url.railway.app
```

**Teste healthcheck**:
```bash
curl https://sua-url.railway.app/health
```

**Resposta esperada**:
```json
{
  "status": "OK",
  "uptime": 120,
  "environment": "production",
  "version": "1.0.0"
}
```

---

## ✅ Checklist Final

### Deploy Básico
- [ ] Serviço GitHub conectado
- [ ] PostgreSQL adicionado
- [ ] Variáveis de ambiente configuradas
- [ ] Build completou sem erros
- [ ] App acessível via URL

### Validação Funcional
- [ ] Página principal carrega
- [ ] Taxas de câmbio aparecem
- [ ] `/health` retorna JSON
- [ ] Logs mostram "PostgreSQL session store"
- [ ] Logs mostram "Scraper scheduler started"

### Opcional (Depois)
- [ ] Domínio customizado configurado
- [ ] Admin acessível
- [ ] Testar login admin
- [ ] Trigger scraping manual

---

## 🐛 Se Algo Der Errado

### Build Falhou

**Erro comum**: Playwright installation timeout

**Solução**:
1. Deployments → três pontinhos → **Redeploy**
2. Aguarde novamente
3. Na segunda tentativa geralmente funciona

---

### App Não Inicia

**Sintomas**: Deploy verde mas app não responde

**Verificar**:
1. Logs → Procure por erros
2. Variables → Confirme todas estão lá
3. Healthcheck → `/health` responde?

**Solução**:
```bash
# No terminal local
railway logs --follow
```

Procure por:
- ❌ Variáveis faltando
- ❌ Erro de conexão com Supabase
- ❌ Porta incorreta

---

### MemoryStore Warning Ainda Aparece

**Causa**: `DATABASE_URL` não configurado

**Solução**:
1. Confirme PostgreSQL adicionado ao projeto
2. Serviço deve ter `DATABASE_URL` em Variables
3. Se não tiver, adicione manualmente ou reconecte o PostgreSQL

---

## 📊 Próximos Passos (Opcional)

### 1. Domínio Customizado

**No Railway**:
- Settings → Domains → Add Domain
- Siga instruções DNS dele

**Veja guia completo**: `RAILWAY_DEPLOY.md`

### 2. Monitoramento

- Metrics tab → Ver CPU/RAM
- Settings → Notifications → Alertas

### 3. Escalar (Se Necessário)

No futuro, se precisar de mais recursos:
- Settings → Resources
- Ajuste CPU/RAM

---

## 🎉 Pronto!

Quando a URL Railway estiver funcionando:

1. ✅ **Migration completa do servidor atual**
2. ✅ **Pronto para tráfego de produção**
3. ✅ **Auto-deploy em cada push para GitHub**

**Teste final**:
```bash
# No seu terminal
railway open
```

Isso abre sua aplicação no navegador!

---

**Link do Projeto**: https://railway.com/project/85bb7ba7-2c83-464c-bf95-ede08aaa24c0

**Dúvidas?** Consulte `RAILWAY_DEPLOY.md` para troubleshooting detalhado.
