# 🚀 Deploy Railway - Passos Finais

## ✅ Status Atual

- ✅ Projeto criado: `ecokambio-production`
- ✅ Código uploadado para Railway
- ✅ Serviço criado automaticamente
- ⏳ Build aguardando variáveis de ambiente

---

## 📋 Próximos Passos

### 1. Configurar Variáveis de Ambiente (AGORA)

O Railway Dashboard foi aberto automaticamente. Siga estes passos:

**No Railway Dashboard**:

1. Clique no card do serviço (deve mostrar "Build failed" ou similar)
2. Vá para a aba **"Variables"**
3. Clique em **"RAW Editor"**
4. **Cole o conteúdo abaixo** (já está pronto com suas credenciais):

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

5. Clique em **"Update Variables"**
6. Railway fará **redeploy automático** com as variáveis configuradas

---

### 2. Acompanhar o Build

Após salvar as variáveis:

1. Vá para a aba **"Deployments"**
2. Clique no deployment mais recente
3. Acompanhe os logs em tempo real

**O que esperar**:
- ✅ Build: ~3-5 minutos (instalando Playwright browsers)
- ✅ Deploy: Aplicação iniciará automaticamente
- ✅ URL gerada: `https://seu-projeto.up.railway.app`

---

### 3. Verificar Deploy

Quando o build completar:

**No Railway Dashboard**:
- Settings > **Domains** → Copie a URL fornecida

**No terminal**:
```bash
# Verificar status
railway status

# Abrir aplicação no navegador
railway open

# Ver logs em tempo real
railway logs
```

**Testar healthcheck**:
```bash
# Substitua pela URL do Railway
curl https://seu-projeto.up.railway.app/health
```

**Resposta esperada**:
```json
{
  "status": "OK",
  "timestamp": "2025-12-10T14:20:00.000Z",
  "uptime": 120,
  "environment": "production",
  "version": "1.0.0"
}
```

---

## 🐛 Se o Build Falhar

### Build Timeout

Se o build demorar muito ou falhar:

1. **Verificar logs**: Aba "Deployments" > Último deploy > Logs
2. **Problemas comuns**:
   - ❌ **Playwright falhou**: Normal na primeira vez, refaça deploy
   - ❌ **Variáveis faltando**: Verifique todas foram adicionadas
   - ❌ **Out of memory**: Railway precisa de mais recursos (upgrade plan)

### Refazer Deploy

Se necessário:

```bash
# Via CLI
railway up --detach

# Ou no Dashboard
Deployments > três pontinhos > Redeploy
```

---

## ✅ Checklist Final

Após deploy bem-sucedido:

- [ ] Aplicação acessível via URL Railway
- [ ] `/health` endpoint retorna JSON
- [ ] Página principal carrega
- [ ] Taxas de câmbio aparecem (se houver dados no Supabase)
- [ ] Logs mostram "Scraper scheduler started"

---

## 🎯 Próximos Passos (Depois do Deploy)

1. **Domínio Customizado** (Opcional):
   - Settings > Domains > Add Domain
   - Configurar DNS conforme instruções em `RAILWAY_DEPLOY.md`

2. **Monitoramento**:
   - Configurar alertas em Settings > Notifications
   - Verificar métricas em Metrics tab

3. **Scraping Manual** (Testar):
   ```bash
   railway run npm run scrape:all
   ```

---

## 📞 Links Úteis

- **Projeto Railway**: https://railway.com/project/85bb7ba7-2c83-464c-bf95-ede08aaa24c0
- **Guia Completo**: `RAILWAY_DEPLOY.md`
- **Suporte Railway**: https://help.railway.app

---

**💡 Dica**: Deixe esta janela do Railway Dashboard aberta para acompanhar o progresso do build!
