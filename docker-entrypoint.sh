#!/bin/sh
set -e

echo "🚀 EcoKambio - Iniciando container..."

# Criar diretório de logs se não existir
mkdir -p /usr/src/app/logs

# Supercronic desativado - Agendamento agora gerido pelo node-cron no server.js
# para evitar duplicar execuções e garantir maior fiabilidade
# if [ -f /usr/src/app/crontab.md ]; then
#   echo "🕐 Iniciando Supercronic para cron jobs (via crontab.md)..."
#   /usr/local/bin/supercronic /usr/src/app/crontab.md >> /usr/src/app/logs/supercronic.log 2>&1 &
#   echo "✅ Supercronic iniciado em background"
# elif [ -f /usr/src/app/crontab ]; then
#   echo "🕐 Iniciando Supercronic para cron jobs..."
#   /usr/local/bin/supercronic /usr/src/app/crontab >> /usr/src/app/logs/supercronic.log 2>&1 &
#   echo "✅ Supercronic iniciado em background"
# else
#   echo "⚠️  Arquivo crontab não encontrado, cron jobs não serão executados"
# fi
echo "📅 Agendamento via Supercronic desativado (usando node-cron no server.js)"

# Iniciar o Worker (processador de filas BullMQ) em background
if [ -z "$REDIS_URL" ]; then
  echo "⚠️  REDIS_URL não definida. O Worker (BullMQ) NÃO será iniciado para evitar erros."
else
  echo "👷 Iniciando Worker em background..."
  npm run worker >> /usr/src/app/logs/worker.log 2>&1 &
fi

# Iniciar aplicação principal
echo "🌐 Iniciando aplicação Node.js..."
exec npm start
