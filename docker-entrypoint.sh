#!/bin/sh
set -e

echo "🚀 EcoKambio - Iniciando container..."

# Criar diretório de logs se não existir
mkdir -p /usr/src/app/logs

# O Agendamento (cron jobs) passou a ser gerido apenas pelo node-cron no server.js
echo "📅 Agendamento via Supercronic desativado (usando node-cron no server.js)"

# Iniciar o Worker (processador de filas BullMQ) em background
if [ -z "$REDIS_URL" ]; then
  echo "⚠️  REDIS_URL não definida. O Worker (BullMQ) NÃO será iniciado para evitar erros."
else
  echo "👷 Iniciando Worker em background..."
  npm run worker >> /usr/src/app/logs/worker.log 2>&1 &
fi

# Iniciar aplicação principal
echo "🌐 Iniciando aplicação Node.js (Ambiente: $NODE_ENV, Porto: $PORT)..."

# Usamos exec para que o Node seja o PID 1 e receba sinais corretamente
# Mas antes, vamos garantir que o output seja enviado para stdout/stderr sem buffering excessivo
exec npm start
