#!/bin/bash

#######################################################################
# Script de Backup - EcoKambio
# Cria backup dos arquivos importantes da aplicação
#######################################################################

BACKUP_DIR="/root/backups"
APP_DIR="/var/www/ecokambio"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="ecokambio_$DATE.tar.gz"

# Cores
GREEN='\033[0;32m'
NC='\033[0m'

echo "════════════════════════════════════════════════════════"
echo " 💾 Backup EcoKambio"
echo "════════════════════════════════════════════════════════"

# Criar diretório de backup
mkdir -p $BACKUP_DIR

echo ""
echo "📦 Criando backup..."
echo "   Origem: $APP_DIR"
echo "   Destino: $BACKUP_DIR/$BACKUP_FILE"

# Criar backup
cd /var/www
tar -czf $BACKUP_DIR/$BACKUP_FILE \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='logs' \
    --exclude='sessions' \
    ecokambio/.env \
    ecokambio/package.json \
    ecokambio/public \
    ecokambio/private \
    ecokambio/src \
    ecokambio/server.js \
    ecokambio/webscraper 2>/dev/null || true

if [ -f "$BACKUP_DIR/$BACKUP_FILE" ]; then
    SIZE=$(du -h "$BACKUP_DIR/$BACKUP_FILE" | cut -f1)
    echo -e "${GREEN}✅ Backup criado com sucesso!${NC}"
    echo "   Arquivo: $BACKUP_FILE"
    echo "   Tamanho: $SIZE"
    
    # Manter apenas últimos 7 backups
    echo ""
    echo "🧹 Limpando backups antigos..."
    cd $BACKUP_DIR
    ls -t ecokambio_*.tar.gz | tail -n +8 | xargs -r rm
    echo "   Mantidos últimos 7 backups"
    
    echo ""
    echo "📋 Backups disponíveis:"
    ls -lh $BACKUP_DIR/ecokambio_*.tar.gz 2>/dev/null || echo "   Nenhum backup anterior"
else
    echo "❌ Erro ao criar backup"
    exit 1
fi

echo ""
echo "════════════════════════════════════════════════════════"
echo " ✅ Backup concluído!"
echo "════════════════════════════════════════════════════════"
