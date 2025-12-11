# 🚀 EcoKambio - Configuração Inicial no Fly.io

Este guia orienta na configuração inicial da aplicação EcoKambio no Fly.io.

## Pré-requisitos

- Conta no [Fly.io](https://fly.io/app/sign-up) (aceita cartão de crédito, tier gratuito disponível)
- Fly CLI instalado localmente
- Credenciais do Supabase (URL, Anon Key, Service Key)

## 1. Instalar Fly CLI

### macOS
```bash
brew install flyctl
```

### Linux
```bash
curl -L https://fly.io/install.sh | sh
```

### Windows
```powershell
pwsh -Command "iwr https://fly.io/install.ps1 -useb | iex"
```

## 2. Autenticar no Fly.io

```bash
fly auth login
```

Isso abrirá seu navegador para fazer login.

## 3. Preparar Variáveis de Ambiente

Copie as variáveis do arquivo `.env` atual ou use o template:

```bash
cp .env.fly.template .env.fly
```

Edite `.env.fly` com suas credenciais reais:

```bash
# Editar com nano, vim ou seu editor favorito
nano .env.fly
```

**Variáveis obrigatórias:**
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_KEY`
- `ADMIN_PASSWORD_HASH`
- `SESSION_SECRET`

## 4. Iniciar Aplicação no Fly.io

A aplicação já está configurada no `fly.toml`. Para lançá-la:

```bash
# Confirmar que app 'ecokambio' está configurada
fly apps list

# Se não existir, criar:
fly apps create ecokambio --org personal
```

## 5. Configurar Secrets (Variáveis de Ambiente)

Importar todas as variáveis de uma vez:

```bash
fly secrets import < .env.fly
```

Ou definir individualmente:

```bash
fly secrets set SUPABASE_URL="https://seu-projeto.supabase.co"
fly secrets set SUPABASE_ANON_KEY="sua-anon-key"
fly secrets set SUPABASE_SERVICE_KEY="sua-service-key"
fly secrets set ADMIN_PASSWORD_HASH='$2b$12$...'
fly secrets set SESSION_SECRET="seu-session-secret"
fly secrets set ADMIN_SECRET_PATH="/acesso-admin-secreto-123"
```

## 6. Criar Volume para Sessões

O volume persistente armazena sessões de usuários:

```bash
fly volumes create ecokambio_sessions --region ams --size 1
```

**Nota:** A região `ams` (Amsterdam) foi escolhida por estar mais próxima de Angola.

## 7. Deploy Inicial

```bash
fly deploy
```

Isso irá:
1. Construir a imagem Docker
2. Instalar Playwright e dependências
3. Compilar CSS com Tailwind
4. Fazer upload para Fly.io
5. Iniciar a aplicação

**Tempo estimado:** 5-10 minutos na primeira vez.

## 8. Verificar Deployment

### Abrir aplicação no navegador
```bash
fly open
```

### Ver logs em tempo real
```bash
fly logs
```

### Verificar status
```bash
fly status
```

### Testar health check
```bash
curl https://ecokambio.fly.dev/health
```

Deve retornar: `{"status":"ok"}`

## 9. Testar Cron Jobs

Os cron jobs (Supercronic) iniciam automaticamente. Para verificar:

### Ver logs do cron
```bash
fly logs --app ecokambio | grep -i cron
```

### Executar scraper manualmente (teste)
```bash
fly ssh console -C "cd /usr/src/app && npm run scrape:all"
```

## 10. Configurar Domínio Customizado (Opcional)

Se você tem um domínio (ex: `ecokambio.com`):

```bash
fly certs add ecokambio.com
fly certs add www.ecokambio.com
```

Então, configurar DNS com os valores fornecidos pelo Fly.io.

Atualizar variável de cookie:

```bash
fly secrets set COOKIE_DOMAIN=".ecokambio.com"
```

## 11. Backup e Monitoramento

### Criar snapshot do volume
```bash
fly volumes snapshots create ecokambio_sessions
```

### Listar snapshots
```bash
fly volumes snapshots list ecokambio_sessions
```

### Configurar alertas (dashboard web)
Acesse: https://fly.io/dashboard/ecokambio/monitoring

## Troubleshooting

### App não inicia
```bash
# Ver logs detalhados
fly logs

# Verificar configuração
fly config show

# Verificar secrets
fly secrets list
```

### Problemas com Playwright
```bash
# Acessar console do container
fly ssh console

# Verificar instalação do Chromium
chromium-browser --version

# Verificar variável de ambiente
echo $PLAYWRIGHT_BROWSERS_PATH
```

### Volume não monta
```bash
# Listar volumes
fly volumes list

# Verificar região do volume corresponde à região da app
fly status
```

## Próximos Passos

- Consulte [FLY_DEPLOY.md](FLY_DEPLOY.md) para operações diárias
- Configure monitoramento e alertas no dashboard do Fly.io
- Teste todos os endpoints da aplicação
- Configure CI/CD com GitHub Actions (opcional)

## Custos Estimados

Com a configuração atual:
- **Máquinas:** ~$5-10/mês (1 shared CPU, 1GB RAM, ~730h/mês)
- **Volume:** ~$0.15/mês (1GB)
- **Largura de banda:** Primeiros 160GB gratuitos

**Total estimado:** ~$5-11/mês

## Recursos

- [Documentação Oficial Fly.io](https://fly.io/docs/)
- [Fly.io Pricing](https://fly.io/docs/about/pricing/)
- [Fly.io Community](https://community.fly.io/)
