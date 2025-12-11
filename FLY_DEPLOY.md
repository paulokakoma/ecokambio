# 🛫 EcoKambio - Guia de Deploy no Fly.io

Operações de deployment e manutenção da aplicação EcoKambio no Fly.io.

## Deploy Rápido

### Deploy Standard
```bash
fly deploy
```

### Deploy com logs em tempo real
```bash
fly deploy --verbose
```

### Deploy de uma imagem específica
```bash
fly deploy --image-label v1.2.3
```

## Atualizações de Código

### 1. Fazer alterações no código

```bash
# Editar arquivos
git add .
git commit -m "Descrição das mudanças"
git push
```

### 2. Deploy das alterações

```bash
fly deploy
```

**Nota:** O Fly.io faz rolling deployment por padrão, sem downtime.

## Gerenciar Secrets

### Listar secrets configurados
```bash
fly secrets list
```

### Atualizar um secret
```bash
fly secrets set ADMIN_PASSWORD_HASH='$2b$12$novoHashAqui'
```

### Importar vários secrets
```bash
fly secrets import < .env.fly
```

### Remover um secret
```bash
fly secrets unset NOME_DO_SECRET
```

**Importante:** Alterar secrets reinicia automaticamente a aplicação.

## Monitoramento

### Ver logs em tempo real
```bash
fly logs
```

### Ver logs com filtro
```bash
# Apenas erros
fly logs | grep -i error

# Logs do cron
fly logs | grep -i cron

# Logs do Supercronic
fly logs | grep supercronic
```

### Ver status da aplicação
```bash
fly status
```

### Ver métricas (CPU, memória, requisições)
```bash
fly metrics
```

Ou acesse o dashboard web: https://fly.io/dashboard/ecokambio/metrics

## Scaling

### Ver configuração atual
```bash
fly scale show
```

### Aumentar memória
```bash
fly scale memory 2048  # 2GB
```

### Adicionar mais máquinas
```bash
fly scale count 2  # 2 máquinas
```

### Alterar região
```bash
fly regions add gru  # São Paulo
fly regions add jnb  # Johannesburg
```

## Cron Jobs

### Verificar execução do Supercronic

```bash
# Ver se Supercronic está rodando
fly ssh console -C "ps aux | grep supercronic"
```

### Ver logs do cron
```bash
fly ssh console -C "cat /usr/src/app/logs/cron.log"
```

### Executar scraper manualmente
```bash
fly ssh console -C "cd /usr/src/app && npm run scrape:all"
```

### Atualizar schedule do cron

1. Edite o arquivo `crontab` localmente
2. Faça deploy:
```bash
fly deploy
```

Ou altere diretamente:
```bash
fly ssh console
cd /usr/src/app
vi crontab
# Salve e reinicie o container
exit
fly machine restart
```

## Volumes e Sessões

### Listar volumes
```bash
fly volumes list
```

### Ver uso do volume
```bash
fly ssh console -C "df -h /usr/src/app/sessions"
```

### Limpar sessões antigas
```bash
fly ssh console -C "find /usr/src/app/sessions -type f -mtime +7 -delete"
```

### Backup do volume
```bash
fly volumes snapshots create ecokambio_sessions
```

### Restaurar de snapshot
```bash
# Listar snapshots
fly volumes snapshots list ecokambio_sessions

# Criar volume de um snapshot
fly volumes create ecokambio_sessions_restore --snapshot-id snap_xxxxx
```

## SSH e Debug

### Acessar console SSH
```bash
fly ssh console
```

### Executar comando único
```bash
fly ssh console -C "node -v"
```

### Ver variáveis de ambiente
```bash
fly ssh console -C "printenv | sort"
```

### Verificar Playwright
```bash
fly ssh console -C "chromium-browser --version"
```

### Testar scraper
```bash
fly ssh console -C "cd /usr/src/app && npm run scrape:informal"
```

## Troubleshooting

### App não responde

```bash
# Ver logs recentes
fly logs

# Reiniciar aplicação
fly machine restart

# Verificar health check
curl https://ecokambio.fly.dev/health
```

### Deploy falha

```bash
# Ver logs de build
fly logs --deployment

# Testar build localmente
docker build -t ecokambio-test .
docker run -p 3000:3000 ecokambio-test
```

### Problemas com secrets

```bash
# Verificar se secrets estão definidos
fly secrets list

# Re-importar secrets
fly secrets import < .env.fly
```

### Aplicação lenta

```bash
# Ver métricas
fly metrics

# Considerar aumentar recursos
fly scale memory 2048
fly scale count 2
```

### Cron jobs não executam

```bash
# Verificar logs do Supercronic
fly logs | grep supercronic

# Verificar arquivo crontab
fly ssh console -C "cat /usr/src/app/crontab"

# Testar cron manualmente
fly ssh console -C "/usr/local/bin/supercronic -test /usr/src/app/crontab"
```

## Rollback

### Listar releases
```bash
fly releases
```

### Voltar para release anterior
```bash
fly releases rollback
```

### Voltar para release específico
```bash
fly releases rollback v42
```

## Certificados SSL

### Ver certificados
```bash
fly certs list
```

### Adicionar domínio customizado
```bash
fly certs add ecokambio.com
```

### Verificar status do certificado
```bash
fly certs show ecokambio.com
```

## Backup e Recuperação

### Criar snapshot manual
```bash
fly volumes snapshots create ecokambio_sessions
```

### Agendar snapshots automáticos via cron

Adicione ao `crontab`:
```cron
0 2 * * * fly volumes snapshots create ecokambio_sessions
```

### Exportar configuração
```bash
fly config show > fly-config-backup.toml
fly secrets list > secrets-list.txt
```

## CI/CD com GitHub Actions

### Gerar token de deploy
```bash
fly tokens create deploy -x 999999h
```

### Configurar no GitHub

1. Vá em Settings > Secrets > Actions
2. Adicione secret: `FLY_API_TOKEN` com o token gerado
3. Crie `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Fly.io

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: superfly/flyctl-actions/setup-flyctl@master
      - run: flyctl deploy --remote-only
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
```

## Monitoramento Avançado

### Configurar alertas (Dashboard Web)

1. Acesse https://fly.io/dashboard/ecokambio/monitoring
2. Configure alertas para:
   - CPU > 80%
   - Memória > 90%
   - Health checks falhando
   - Erros 5xx

### Integrar com serviços externos

- **Sentry:** Para tracking de erros
- **LogDNA/Datadog:** Para análise de logs
- **UptimeRobot:** Para monitoramento externo

## Comandos Úteis

```bash
# Ver todas as apps na conta
fly apps list

# Ver informações da app
fly info

# Ver histórico de deploys
fly releases

# Pausar app (não cobra)
fly machine stop

# Retomar app
fly machine start

# Destruir app (CUIDADO!)
fly apps destroy ecokambio
```

## Boas Práticas

1. **Sempre teste localmente antes de deploy**
   ```bash
   docker build -t ecokambio-test .
   docker run --env-file .env.fly -p 3000:3000 ecokambio-test
   ```

2. **Use Git tags para releases**
   ```bash
   git tag -a v1.0.0 -m "Release 1.0.0"
   git push origin v1.0.0
   ```

3. **Monitore logs após deploy**
   ```bash
   fly logs &  # Em background
   fly deploy
   ```

4. **Backup antes de mudanças críticas**
   ```bash
   fly volumes snapshots create ecokambio_sessions
   ```

## Recursos Adicionais

- [Fly.io Docs](https://fly.io/docs/)
- [Fly.io Community Forum](https://community.fly.io/)
- [Fly.io Status Page](https://status.flyio.net/)
