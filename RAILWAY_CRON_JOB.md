# 🕒 Railway Cron Job - Scraping Automático

Serviço separado de cron job para executar scraping de taxas de câmbio no Railway.

## 📦 O Que É

Um **serviço independente** que roda no Railway apenas para executar o scraping em horários programados, separado do servidor web principal.

---

## ✅ Vantagens

- **Isolamento**: Não afeta performance do servidor web
- **Escalabilidade**: Pode ter recursos próprios
- **Monitoramento**: Logs separados e específicos
- **Resiliência**: Se o web server cair, o cron continua
- **Flexibilidade**: Pode ter schedule diferente do padrão

---

## 🚀 Como Adicionar no Railway

### Passo 1: Fazer Deploy do Web Server Primeiro

Certifique-se de que o serviço principal (GitHub Repo) já está deployado.

### Passo 2: Adicionar Cron Job Service

1. **No Railway Dashboard do projeto `ecokambio-production`**:

2. **Clique em `+ New`**

3. **Selecione `GitHub Repo`** (mesmo repositório)
   - Repositório: `paulokakoma/ecokambio`
   - Branch: `main`

4. **Configurar o Serviço**:
   - Nome: `ecokambio-cron` (para diferenciar)
   - Root Directory: `/` (mesmo diretório)

5. **Settings → Service**:
   - **Start Command**: `node railway-cron.js`
   - **Build Command**: (vazio, usa o mesmo do repo)

6. **Variables** (copie do serviço principal + adicione):
   ```env
   NODE_ENV=production
   SUPABASE_URL=https://drkjkkpzujwnkghtdokz.supabase.co
   SUPABASE_ANON_KEY=eyJhbGc...
   SUPABASE_SERVICE_KEY=eyJhbGc...
   
   # Configuração do Cron
   CRON_SCHEDULE=0 */4 * * *
   RUN_ON_START=true
   TZ=Africa/Luanda
   ```

7. **Deploy** → Railway inicia o cron job

---

## ⚙️ Configuração do Schedule

Use a variável `CRON_SCHEDULE` para controlar quando executar:

| Valor | Descrição |
|-------|-----------|
| `0 */4 * * *` | A cada 4 horas (padrão) |
| `0 */2 * * *` | A cada 2 horas |
| `0 */6 * * *` | A cada 6 horas |
| `0 9,15,21 * * *` | Às 9h, 15h e 21h |
| `*/30 * * * *` | A cada 30 minutos |
| `0 * * * *` | A cada hora |

**Formato**: `minuto hora dia mês dia-da-semana`

Gerador: https://crontab.guru/

---

## 📊 Variáveis de Ambiente

| Variável | Obrigatória | Padrão | Descrição |
|----------|-------------|--------|-----------|
| `CRON_SCHEDULE` | Não | `0 */4 * * *` | Schedule do cron job |
| `RUN_ON_START` | Não | `false` | Executar scraping ao iniciar |
| `TZ` | Não | `UTC` | Timezone (ex: `Africa/Luanda`) |
| `NODE_ENV` | Sim | - | `production` |
| `SUPABASE_URL` | Sim | - | URL do Supabase |
| `SUPABASE_SERVICE_KEY` | Sim | - | Service key do Supabase |

---

## 📝 Logs

No Railway Dashboard → Cron Service → Logs:

```
[2025-12-10T15:00:00.000Z] 🚀 Railway Cron Job iniciado
[2025-12-10T15:00:00.000Z] 📅 Schedule: 0 */4 * * *
[2025-12-10T15:00:00.000Z] ✅ Cron job agendado e ativo
[2025-12-10T15:00:00.000Z] ⏰ Próxima execução: 2025-12-10T19:00:00.000Z
[2025-12-10T19:00:00.000Z] ⏰ Iniciando scraping job...
[2025-12-10T19:02:15.000Z] ✅ Scraping completado em 135.42s
```

---

## 🔍 Monitoramento

### Verificar Status

```bash
# Via Railway CLI
railway logs -s ecokambio-cron --follow
```

### Métricas

Railway Dashboard → Cron Service → Metrics:
- CPU usage
- Memory usage
- Restart count

---

## 🛑 Desativar Scheduler do Servidor Principal

Se usar este cron job, **desative** o scheduler no `server.js`:

**Opção 1: Variável de Ambiente**

No serviço web, adicione:
```env
DISABLE_SCHEDULER=true
```

**Opção 2: Remover do Código** (não recomendado)

Comente em `server.js`:
```javascript
// if (!config.isDevelopment) {
//     const scraperScheduler = require('./webscraper/scheduler');
//     scraperScheduler.start();
// }
```

---

## 💰 Custos

Railway cobra por **recursos usados**:

- **Cron Job**: ~$0.50-2/mês (low usage)
- **Web Server**: ~$3-8/mês
- **PostgreSQL**: ~$1-3/mês

**Total estimado**: $5-13/mês (dentro do plano Developer)

---

## 🔄 Arquitetura Final

```
Railway Project: ecokambio-production
│
├── 📦 Web Server (Node.js)
│   ├── Serve website & API
│   ├── Responde requisições HTTP
│   └── Scheduler DESABILITADO
│
├── ⏰ Cron Job (Node.js)
│   ├── Executa scraping a cada 4h
│   ├── Atualiza Supabase
│   └── Logs dedicados
│
└── 🗄️ PostgreSQL
    ├── Armazena sessões
    └── Compartilhado entre os 2 serviços
```

---

## ✅ Checklist de Deploy

- [ ] Web server deployado e funcionando
- [ ] PostgreSQL adicionado
- [ ] Cron job service criado
- [ ] `railway-cron.js` commitado no GitHub
- [ ] Variáveis configuradas no cron service
- [ ] Start command configurado: `node railway-cron.js`
- [ ] `DISABLE_SCHEDULER=true` no web server
- [ ] Logs do cron mostram "agendado e ativo"
- [ ] Primeira execução completou com sucesso

---

## 🐛 Troubleshooting

### Cron Job Não Inicia

**Sintomas**: Service crashes imediatamente

**Verificar**:
```bash
railway logs -s ecokambio-cron
```

**Soluções**:
1. Confirmar `node railway-cron.js` no Start Command
2. Verificar variáveis de ambiente obrigatórias
3. Confirmar `node-cron` está em `package.json`

---

### Scraping Falha

**Sintomas**: Logs mostram erro ao executar

**Verificar**:
- Credenciais Supabase corretas
- Playwright instalado (via `railway:build`)
- Timeout não muito curto

**Solução**:
```env
# Aumentar timeout se necessário
SCRAPER_TIMEOUT=600000
```

---

### Não Executa no Horário

**Sintomas**: Passam horas sem executar

**Verificar**:
1. `CRON_SCHEDULE` está correta
2. Timezone configurado (`TZ`)
3. Service está rodando (não crashou)

**Teste**:
```env
# Testar com schedule mais frequente
CRON_SCHEDULE=*/5 * * * *
```

---

## 📚 Recursos

- [Crontab Guru](https://crontab.guru/) - Testar schedules
- [Railway Docs](https://docs.railway.app/)
- [node-cron Docs](https://www.npmjs.com/package/node-cron)

---

**🎉 Pronto! Scraping automático rodando 24/7 no Railway!**
