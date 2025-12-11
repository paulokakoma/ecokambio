# ⏰ EcoKambio - Cron Jobs no Fly.io

Documentação sobre o sistema de cron jobs usando Supercronic no Fly.io.

## Visão Geral

A aplicação EcoKambio usa **Supercronic** para executar tarefas agendadas (cron jobs) dentro do container Docker no Fly.io.

### Por que Supercronic?

- **Container-friendly:** Projetado para rodar em containers Docker
- **Logs estruturados:** Melhor integração com sistemas de log
- **Confiável:** Não depende de cron do sistema
- **Simples:** Usa sintaxe padrão do crontab

## Configuração Atual

### Arquivo: `crontab`

```cron
# Executar scraping a cada 4 horas
0 */4 * * * cd /usr/src/app && npm run scrape:all >> /usr/src/app/logs/cron.log 2>&1

# Log diário dos cron jobs ativos
0 0 * * * echo "Cron jobs ativos: $(date)" >> /usr/src/app/logs/cron-status.log
```

### Tarefas Configuradas

| Tarefa | Schedule | Descrição |
|--------|----------|-----------|
| Scraping de taxas | `0 */4 * * *` | A cada 4 horas, executa todos os scrapers |
| Status log | `0 0 * * *` | Diariamente à meia-noite, registra status |

## Como Funciona

### 1. Inicialização

O script `docker-entrypoint.sh` inicia o Supercronic em background:

```bash
/usr/local/bin/supercronic /usr/src/app/crontab &
```

### 2. Execução

Supercronic lê o arquivo `crontab` e executa os comandos nos horários especificados.

### 3. Logs

Todos os outputs são salvos em `/usr/src/app/logs/cron.log`.

## Verificar Status

### Ver se Supercronic está rodando

```bash
fly ssh console -C "ps aux | grep supercronic"
```

Saída esperada:
```
root  123  0.0  0.1  supercronic /usr/src/app/crontab
```

### Ver logs do cron

```bash
# Logs do Supercronic
fly logs | grep supercronic

# Logs do scraper
fly ssh console -C "tail -f /usr/src/app/logs/cron.log"

# Logs de status
fly ssh console -C "cat /usr/src/app/logs/cron-status.log"
```

## Modificar Schedule

### Opção 1: Editar localmente e fazer deploy

1. Edite o arquivo `crontab`:
```bash
nano crontab
```

2. Altere o schedule (formato cron):
```cron
# A cada 2 horas
0 */2 * * * cd /usr/src/app && npm run scrape:all >> /usr/src/app/logs/cron.log 2>&1

# Todo dia às 6h da manhã
0 6 * * * cd /usr/src/app && npm run scrape:all >> /usr/src/app/logs/cron.log 2>&1
```

3. Deploy:
```bash
fly deploy
```

### Opção 2: Editar diretamente no servidor

```bash
fly ssh console

# Editar crontab
vi /usr/src/app/crontab

# Salvar e reiniciar
exit
fly machine restart
```

## Formato Cron

```
┌───────────── minuto (0 - 59)
│ ┌───────────── hora (0 - 23)
│ │ ┌───────────── dia do mês (1 - 31)
│ │ │ ┌───────────── mês (1 - 12)
│ │ │ │ ┌───────────── dia da semana (0 - 6) (Domingo = 0)
│ │ │ │ │
* * * * * comando a executar
```

### Exemplos Práticos

```cron
# A cada hora
0 * * * * comando

# A cada 6 horas
0 */6 * * * comando

# Todo dia às 3h da manhã
0 3 * * * comando

# Segunda a sexta às 9h
0 9 * * 1-5 comando

# Primeiro dia de cada mês
0 0 1 * * comando

# A cada 30 minutos
*/30 * * * * comando
```

## Executar Tarefa Manualmente

### Executar scraper completo

```bash
fly ssh console -C "cd /usr/src/app && npm run scrape:all"
```

### Executar scrapers específicos

```bash
# Apenas mercado informal
fly ssh console -C "cd /usr/src/app && npm run scrape:informal"

# Apenas USDT
fly ssh console -C "cd /usr/src/app && npm run scrape:usdt"

# Mercado formal
fly ssh console -C "cd /usr/src/app && npm run scrape"
```

## Debugging

### Testar sintaxe do crontab

```bash
fly ssh console -C "/usr/local/bin/supercronic -test /usr/src/app/crontab"
```

### Ver próximas execuções

Supercronic mostra nos logs quando será a próxima execução:

```bash
fly logs | grep "next run"
```

### Verificar erros

```bash
# Erros do Supercronic
fly logs | grep -i "supercronic.*error"

# Erros do scraper
fly ssh console -C "grep -i error /usr/src/app/logs/cron.log | tail -20"
```

## Adicionar Novas Tarefas

### 1. Criar script npm (opcional)

Edite `package.json` para adicionar novo script:

```json
{
  "scripts": {
    "minha-tarefa": "node scripts/minha-tarefa.js"
  }
}
```

### 2. Adicionar ao crontab

```cron
# Executar minha tarefa toda sexta às 18h
0 18 * * 5 cd /usr/src/app && npm run minha-tarefa >> /usr/src/app/logs/cron.log 2>&1
```

### 3. Deploy

```bash
fly deploy
```

## Monitoramento

### Configurar alertas de falha

Crie um script que verifica se o scraper falhou:

```bash
#!/bin/bash
# scripts/check-scraper-health.sh

if grep -q "Error" /usr/src/app/logs/cron.log; then
    # Enviar notificação (ex: webhook, email)
    curl -X POST https://seu-webhook.com/alerta
fi
```

Adicione ao crontab:
```cron
# Verificar saúde a cada hora
0 * * * * /usr/src/app/scripts/check-scraper-health.sh
```

### Ver histórico de execuções

```bash
fly ssh console -C "grep 'Scraping' /usr/src/app/logs/cron.log | tail -50"
```

## Limpar Logs Antigos

### Manual

```bash
fly ssh console -C "echo '' > /usr/src/app/logs/cron.log"
```

### Automático (rotação de logs)

Adicione ao crontab:

```cron
# Manter apenas últimos 7 dias de logs
0 0 * * * find /usr/src/app/logs -name "*.log" -mtime +7 -delete
```

Ou limite tamanho:

```cron
# Truncar log se maior que 10MB
0 0 * * * [ $(stat -f%z /usr/src/app/logs/cron.log) -gt 10485760 ] && truncate -s 0 /usr/src/app/logs/cron.log
```

## Alternativas ao Supercronic

### 1. Scheduled Machines (Fly.io nativo)

Para tarefas isoladas, use Fly Machines agendadas:

```bash
fly machine run --schedule=hourly --command="npm run scrape:all"
```

**Prós:** Isoladas, não afetam app principal
**Contras:** Menos granularidade de schedule

### 2. Fly Cron Manager

App separada para gerenciar cron jobs:

```bash
# Instalar Cron Manager
fly cron create schedules.json
```

**Prós:** Interface web, logs dedicados
**Contras:** Complexidade adicional

### 3. Scheduler in-app (node-cron)

Manter `node-cron` dentro do Node.js:

**Prós:** Simples, sem dependências externas
**Contras:** Reinicia quando app reinicia, duplica em múltiplas instâncias

## Troubleshooting

### Cron não executa

**Verificar:**
1. Supercronic está rodando? `ps aux | grep supercronic`
2. Sintaxe do crontab está correta? `supercronic -test crontab`
3. Permissões dos arquivos? `ls -la crontab`
4. Logs de erro? `tail -f logs/cron.log`

### Tarefa executa mas falha

**Verificar:**
1. Variáveis de ambiente estão disponíveis?
2. Caminho para scripts está correto?
3. Dependências npm estão instaladas?
4. Logs do scraper: `cat logs/cron.log`

### Múltiplas execuções simultâneas

Se o cron roda antes da tarefa anterior terminar, use flock:

```cron
0 */4 * * * flock -n /tmp/scraper.lock -c "cd /usr/src/app && npm run scrape:all"
```

## Recursos

- [Supercronic GitHub](https://github.com/aptible/supercronic)
- [Crontab Guru](https://crontab.guru/) - Gerador de expressões cron
- [Fly.io Scheduled Machines](https://fly.io/docs/machines/guides/scheduled-machines/)
