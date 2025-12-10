# 🚂 Deploy EcoKambio no Railway

Guia completo para fazer deploy da aplicação EcoKambio na plataforma Railway.

## 📋 Índice

- [Pré-requisitos](#-pré-requisitos)
- [Preparação](#-preparação)
- [Deploy Inicial](#-deploy-inicial)
- [Configuração de Variáveis](#-configuração-de-variáveis)
- [Domínio Customizado](#-domínio-customizado)
- [Monitoramento](#-monitoramento)
- [Troubleshooting](#-troubleshooting)
- [Railway CLI](#-railway-cli-opcional)

---

## 🎯 Pré-requisitos

- ✅ Conta no [Railway](https://railway.app) (gratuita ou pago)
- ✅ Repositório Git (GitHub, GitLab ou Bitbucket)
- ✅ Conta Supabase ativa com credenciais
- ✅ Domínio próprio (opcional, para produção)

### Custos Estimados

- **Plano Gratuito**: $5 de crédito/mês (limitado)
- **Plano Developer**: $5/mês + uso (~$5-15/mês total para esta app)
- **Plano Team**: $20/mês + uso

> [!TIP]
> Para testes, o plano gratuito é suficiente. Para produção com scraping 24/7, recomenda-se o plano pago.

---

## 🔧 Preparação

### 1. Verificar Arquivos de Configuração

Certifique-se de que os seguintes arquivos existem no projeto:

```bash
ls -la railway.toml .railwayignore .env.railway.template
```

**Esperado**:
- ✅ `railway.toml` - Configuração do Railway
- ✅ `.railwayignore` - Arquivos a ignorar no deploy
- ✅ `.env.railway.template` - Template de variáveis

### 2. Preparar Variáveis de Ambiente

Copie o template e preencha com suas credenciais:

```bash
cp .env.railway.template .env.railway
nano .env.railway  # ou use seu editor preferido
```

**Variáveis Obrigatórias**:

| Variável | Como Obter |
|----------|------------|
| `SUPABASE_URL` | Supabase Dashboard > Settings > API > Project URL |
| `SUPABASE_ANON_KEY` | Supabase Dashboard > Settings > API > anon public |
| `SUPABASE_SERVICE_KEY` | Supabase Dashboard > Settings > API > service_role |
| `ADMIN_PASSWORD_HASH` | `node scripts/hash-password.js` ou [bcrypt generator](https://bcrypt-generator.com/) |
| `SESSION_SECRET` | `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |

### 3. Commit das Configurações

```bash
git add railway.toml .railwayignore .env.railway.template package.json
git commit -m "Add Railway deployment configuration"
git push origin main
```

> [!WARNING]
> **Nunca faça commit do arquivo `.env.railway` com credenciais reais!** Ele deve ficar apenas local.

---

## 🚀 Deploy Inicial

### Método 1: Via Interface Web (Recomendado)

1. **Acesse Railway**: https://railway.app/new

2. **Deploy from GitHub**:
   - Clique em "Deploy from GitHub repo"
   - Autorize Railway a acessar seu GitHub
   - Selecione o repositório `ecokambio`

3. **Configurar Projeto**:
   - Nome do projeto: `ecokambio-production` (ou o que preferir)
   - Railway detectará automaticamente o `railway.toml`
   - Clique em "Deploy Now"

4. **Primeiro Deploy** (vai falhar - é esperado):
   - O primeiro deploy falhará porque faltam variáveis de ambiente
   - Não se preocupe, vamos configurá-las agora

### Método 2: Via Railway CLI

```bash
# Instalar Railway CLI
npm i -g @railway/cli

# Login
railway login

# Inicializar projeto
railway init

# Deploy
railway up
```

---

## ⚙️ Configuração de Variáveis

### Via Interface Web

1. **Abra seu projeto** no Railway Dashboard

2. **Vá para Settings > Variables**

3. **Clique em "RAW Editor"**

4. **Cole as variáveis** do seu arquivo `.env.railway`:

```env
NODE_ENV=production
PORT=3000
SUPABASE_URL=https://drkjkkpzujwnkghtdokz.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_KEY=eyJhbGc...
ADMIN_PASSWORD_HASH=$2b$12$yiHRJK...
SESSION_SECRET=0QN/qh6Eicr+OPUh...
ADMIN_SECRET_PATH=/acesso-admin-secreto-123
```

5. **Salve as alterações**

6. **Novo Deploy Automático**:
   - Railway fará deploy automaticamente após salvar
   - Acompanhe os logs em "Deployments"

### Via Railway CLI

```bash
# Método 1: Variável por variável
railway variables set SUPABASE_URL=https://your-project.supabase.co
railway variables set SUPABASE_ANON_KEY=your-key-here

# Método 2: Importar de arquivo
railway variables set $(cat .env.railway)
```

---

## 🌐 Domínio Customizado

### 1. Obter URL Temporária

Após o deploy bem-sucedido, Railway fornece uma URL:

```
https://ecokambio-production.up.railway.app
```

Teste esta URL para garantir que a aplicação está funcionando.

### 2. Adicionar Domínio Próprio

**No Railway Dashboard**:

1. Settings > Domains
2. "Custom Domain"
3. Adicione `ecokambio.com`
4. Railway fornecerá registros DNS:

```
Type: CNAME
Name: @
Value: ecokambio-production.up.railway.app
```

**No seu provedor DNS (e.g., Cloudflare, Google Domains)**:

```
# Domínio principal
Type: CNAME
Name: @
Target: ecokambio-production.up.railway.app

# Subdomínio admin
Type: CNAME  
Name: admin
Target: ecokambio-production.up.railway.app
```

> [!TIP]
> Se usar Cloudflare, desative o proxy (nuvem cinza) inicialmente para evitar problemas.

### 3. Aguardar Propagação

- DNS pode levar 5-60 minutos para propagar
- Railway emite certificado SSL automaticamente
- Verifique em: https://ecokambio.com

### 4. Atualizar Variável COOKIE_DOMAIN

Após domínio configurado:

```bash
railway variables set COOKIE_DOMAIN=.ecokambio.com
```

> [!IMPORTANT]
> Note o **ponto (.)** antes do domínio para funcionar com subdomínios.

---

## 📊 Monitoramento

### Logs

**Via Dashboard**:
- Deployments > [Latest] > Logs
- Logs em tempo real com filtros

**Via CLI**:
```bash
railway logs
```

### Healthcheck

Verifique o status da aplicação:

```bash
# Básico
curl https://ecokambio-production.up.railway.app/health

# Detalhado (com teste de DB)
curl https://ecokambio-production.up.railway.app/health?detailed=true
```

**Resposta esperada**:

```json
{
  "status": "OK",
  "timestamp": "2025-12-10T14:00:00.000Z",
  "uptime": 3600,
  "environment": "production",
  "version": "1.0.0",
  "database": "connected"
}
```

### Métricas

Railway Dashboard > Metrics:
- CPU Usage
- Memory Usage
- Network Bandwidth
- Build Times

### Alertas

Configure em Settings > Notifications:
- Deploy failures
- Crash detection
- Resource limits

---

## 🐛 Troubleshooting

### Build Falhou

**Erro**: `playwright install failed`

**Solução**:
```bash
# Verificar se railway:build está correto no package.json
grep "railway:build" package.json

# Deve mostrar:
# "railway:build": "npx playwright install --with-deps chromium && npm run build:prod"
```

---

### App Não Inicia

**Erro**: `ECONNREFUSED` ou timeout

**Verificar**:
1. Logs de deploy: `railway logs`
2. Variáveis de ambiente: Settings > Variables
3. Port binding: Deve usar `0.0.0.0`, não `localhost`

**Solução**:
```javascript
// server.js deve ter:
server.listen(config.port, '0.0.0.0', () => { ... });
```

---

### Variáveis de Ambiente Ausentes

**Erro**: `Variáveis de ambiente em falta: SESSION_SECRET`

**Solução**:
```bash
# Listar variáveis configuradas
railway variables

# Adicionar a faltante
railway variables set SESSION_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")
```

---

### Scraper Não Funciona

**Sintomas**: Taxas não atualizam automaticamente

**Verificação**:
```bash
# Verificar logs do scheduler
railway logs | grep "Scheduler"

# Deve mostrar:
# ✅ Scheduler started at 2025-12-10T14:00:00.000Z
```

**Soluções**:

1. **Playwright não instalado**:
   - Rebuild: Settings > Redeploy
   - Verificar logs de build para "playwright install"

2. **NODE_ENV incorreto**:
   - Scheduler só ativa em production
   - `railway variables set NODE_ENV=production`

3. **Teste manual**:
   ```bash
   # Via Railway CLI (conectar ao shell)
   railway run npm run scrape:all
   ```

---

### Admin Não Acessível

**Erro 404** em `admin.ecokambio.com`

**Causas**:

1. **DNS não configurado**:
   - Verificar CNAME do subdomínio `admin`
   - Testar: `nslookup admin.ecokambio.com`

2. **Cookie domain incorreto**:
   ```bash
   railway variables set COOKIE_DOMAIN=.ecokambio.com
   ```

3. **Código não detecta subdomínio**:
   - Verificar middleware `subdomain.js`
   - Trust proxy configurado: `app.set('trust proxy', 1);`

---

### SSL/HTTPS Issues

Railway gerencia SSL automaticamente, mas se houver problemas:

1. **Remover domínio** e adicionar novamente
2. **Aguardar propagação**: 5-30 minutos
3. **Verificar Cloudflare**: Se usar, mode "DNS only" (não proxied)

---

## 🖥️ Railway CLI (Opcional)

### Instalação

```bash
npm install -g @railway/cli
```

### Comandos Úteis

```bash
# Login
railway login

# Listar projetos
railway list

# Conectar a um projeto
railway link

# Ver variáveis
railway variables

# Ver logs em tempo real
railway logs

# Executar comando no ambiente Railway
railway run node webscraper/run-all-scrapers.js

# Deploy manual
railway up

# Abrir dashboard
railway open

# Shell no container
railway shell
```

### Desenvolvimento Local com Variáveis Railway

```bash
# Rodar localmente com variáveis do Railway
railway run npm run dev
```

---

## 📝 Checklist de Deploy

Use este checklist ao fazer deploy:

### Pré-Deploy

- [ ] Código commitado e pushed para GitHub
- [ ] Arquivos de configuração presentes (`railway.toml`, etc.)
- [ ] `.env.railway` preenchido localmente (não commitado)
- [ ] Testado localmente: `npm run railway:build && npm start`

### Deploy

- [ ] Projeto criado no Railway
- [ ] Repositório conectado
- [ ] Variáveis de ambiente configuradas
- [ ] Build completou com sucesso
- [ ] App acessível via URL Railway

### Pós-Deploy

- [ ] Healthcheck retorna `200 OK`
- [ ] Página principal carrega
- [ ] Taxas de câmbio aparecem
- [ ] API responde corretamente
- [ ] Logs mostram scheduler ativo
- [ ] Domínio customizado configurado (se aplicável)
- [ ] Admin acessível
- [ ] SSL/HTTPS funciona

### Validação Final

- [ ] Testar de navegador anônimo
- [ ] Verificar em mobile
- [ ] Confirmar scraping automático (aguardar 4 horas ou trigger manual)
- [ ] Monitorar métricas por 24h

---

## 🎓 Recursos Adicionais

- [Documentação Railway](https://docs.railway.app/)
- [Railway Discord](https://discord.gg/railway)
- [Playwright Docs](https://playwright.dev/)
- [Supabase Docs](https://supabase.com/docs)

---

## 🆘 Suporte

Se encontrar problemas:

1. **Logs**: Sempre verifique primeiro `railway logs`
2. **Healthcheck**: Teste `/health?detailed=true`
3. **Railway Status**: https://railway.statuspage.io/
4. **Discord Railway**: Comunidade muito ativa

---

**Desenvolvido com ❤️ para deploy fácil no Railway**
