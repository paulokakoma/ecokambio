#!/bin/sh
set -e

echo "🚀 EcoKambio - Iniciando container..."

# Criar diretório de logs se não existir
mkdir -p /usr/src/app/logs

# Iniciar Supercronic em background para cron jobs
if [ -f /usr/src/app/crontab ]; then
  echo "🕐 Iniciando Supercronic para cron jobs..."
  /usr/local/bin/supercronic /usr/src/app/crontab >> /usr/src/app/logs/supercronic.log 2>&1 &
  echo "✅ Supercronic iniciado em background"
else
  echo "⚠️  Arquivo crontab não encontrado, cron jobs não serão executados"
fi

# Iniciar aplicação principal
echo "🌐 Iniciando aplicação Node.js..."
exec npm start
