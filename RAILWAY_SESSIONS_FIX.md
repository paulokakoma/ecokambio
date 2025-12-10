# 🔧 Configuração de Sessões Persistentes no Railway

## Problema Resolvido

✅ **MemoryStore Warning eliminado!**

O código foi atualizado para usar **PostgreSQL** para armazenar sessões em produção, eliminando o warning:
```
Warning: connect.session() MemoryStore is not designed for a production environment
```

---

## 📦 Como Funciona Agora

### Desenvolvimento Local
- Usa **FileStore** (`./sessions/`)
- Sessões persistem entre restarts

### Produção (Railway)
- Usa **PostgreSQL** via `connect-pg-simple`
- Requer variável `DATABASE_URL`
- Sessões persistem entre deploys
- Tabela `session` criada automaticamente

---

## 🚀 Setup no Railway (OBRIGATÓRIO)

### Opção 1: Adicionar PostgreSQL Plugin (Recomendado)

1. **No Railway Dashboard**:
   - Clique no seu projeto `ecokambio-production`
   - Clique em "+ New" → "Database" → "Add PostgreSQL"

2. **Railway cria automaticamente**:
   - Banco de dados PostgreSQL
   - Variável `DATABASE_URL` no serviço principal

3. **Pronto!** O app detectará automaticamente e usará PostgreSQL para sessões.

---

### Opção 2: Usar Supabase Existente

Se preferir usar o PostgreSQL do Supabase:

1. **No Supabase Dashboard**:
   - Settings → Database → Connection String
   - Copie a "Connection string" (Session mode)
   - Formato: `postgresql://postgres:[YOUR-PASSWORD]@db.xxx.supabase.co:5432/postgres`

2. **No Railway Dashboard**:
   - Variables → RAW Editor
   - Adicione:
   ```env
   DATABASE_URL=postgresql://postgres:your-password@db.xxx.supabase.co:5432/postgres
   ```

3. **Redeploy** → Railway usará Supabase para sessões

---

## 📋 Variáveis Atualizadas para Railway

Cole isto no Railway Dashboard → Variables → RAW Editor:

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

**Nota**: Se adicionar PostgreSQL plugin, Railway adiciona `DATABASE_URL` automaticamente!

---

## ✅ Verificação

Após redeploy, verifique nos logs:

**Com PostgreSQL configurado**:
```
✅ Using PostgreSQL session store for production
```

**Sem DATABASE_URL** (fallback):
```
⚠️  Using MemoryStore - sessions will not persist across deploys
   Add DATABASE_URL environment variable to persist sessions
```

---

## 🎯 Recomendação

**Use PostgreSQL Plugin do Railway** (Opção 1) porque:
- ✅ Mais fácil de configurar (2 cliques)
- ✅ `DATABASE_URL` adicionado automaticamente
- ✅ Backup automático
- ✅ Gerenciado pela Railway
- ✅ ~$1/mês no plano pago

---

## 📊 Commits Necessários

Antes de fazer novo deploy, commit as alterações:

```bash
git add server.js
git commit -m "fix: Use PostgreSQL session store in production"
git push origin main
```

Railway detectará e fará redeploy automaticamente.

---

**🎉 Problema resolvido! Sessões agora persistirão entre deploys.**
