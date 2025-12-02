#!/bin/bash

#######################################################################
# Script de Atualização - EcoKambio
# Atualiza a aplicação no servidor de produção
#######################################################################

set -e

echo "════════════════════════════════════════════════════════"
echo " 🔄 Atualizando EcoKambio"
echo "════════════════════════════════════════════════════════"

# Cores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

APP_DIR="/var/www/ecokambio"

# Verificar se diretório existe
if [ ! -d "$APP_DIR" ]; then
    echo "❌ Erro: Diretório $APP_DIR não encontrado"
    exit 1
fi

cd $APP_DIR

echo ""
echo "📦 1. Fazendo backup da configuração..."
cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
echo -e "${GREEN}✅ Backup criado${NC}"

echo ""
echo "⬇️  2. Baixando atualizações..."
if [ -d ".git" ]; then
    git pull origin main
    echo -e "${GREEN}✅ Código atualizado via Git${NC}"
else
    echo -e "${YELLOW}⚠️  Não é um repositório Git. Atualize os arquivos manualmente.${NC}"
fi

echo ""
echo "📦 3. Instalando dependências..."
npm install --production
echo -e "${GREEN}✅ Dependências instaladas${NC}"

echo ""
echo "🎨 4. Build do CSS..."
npm run build:prod
echo -e "${GREEN}✅ CSS compilado${NC}"

echo ""
echo "🔄 5. Reiniciando aplicação..."
pm2 restart ecokambio
echo -e "${GREEN}✅ Aplicação reiniciada${NC}"

echo ""
echo "════════════════════════════════════════════════════════"
echo " ✅ Atualização concluída!"
echo "════════════════════════════════════════════════════════"
echo ""
pm2 status
echo ""
echo "📊 Para ver logs: pm2 logs ecokambio"
