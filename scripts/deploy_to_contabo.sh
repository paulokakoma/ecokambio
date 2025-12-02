#!/bin/bash

#######################################################################
# Script de Deploy Local → Contabo
# Faz upload dos arquivos do projeto local para o servidor Contabo
#######################################################################

# Configurações (EDITE AQUI)
SERVER_IP="212.90.120.135"           # IP do servidor Contabo
SERVER_USER="root"                   # Usuário SSH
SERVER_PATH="/var/www/ecokambio"     # Caminho no servidor
LOCAL_PATH="${PWD}"                  # Diretório local (atual)

# Cores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo "════════════════════════════════════════════════════════"
echo " 🚀 Deploy EcoKambio → Contabo"
echo "════════════════════════════════════════════════════════"
echo ""

# Verificar se IP foi configurado
if [ "$SERVER_IP" = "SEU_IP_CONTABO" ]; then
    echo -e "${RED}❌ Configure o IP do servidor primeiro!${NC}"
    echo "   Edite este script e altere SERVER_IP"
    exit 1
fi

echo "📍 Servidor: $SERVER_USER@$SERVER_IP"
echo "📁 Destino: $SERVER_PATH"
echo ""

# Perguntar confirmação
read -p "Deseja continuar com o deploy? (s/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Ss]$ ]]; then
    echo "❌ Deploy cancelado"
    exit 0
fi

echo ""
echo "📦 1. Fazendo backup no servidor..."
ssh $SERVER_USER@$SERVER_IP "cd $SERVER_PATH && bash scripts/backup.sh" || echo -e "${YELLOW}⚠️  Backup falhou (talvez seja primeiro deploy)${NC}"

echo ""
echo "⬆️  2. Fazendo upload dos arquivos..."

# Criar arquivo temporário de exclusões
cat > /tmp/rsync_exclude.txt << EOF
node_modules/
.git/
.DS_Store
logs/
sessions/
*.log
.env
.env.backup*
npm-debug.log*
.vscode/
.idea/
EOF

# Upload via rsync (mais eficiente que scp)
rsync -avz --progress \
    --exclude-from=/tmp/rsync_exclude.txt \
    --delete \
    $LOCAL_PATH/ $SERVER_USER@$SERVER_IP:$SERVER_PATH/

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Upload concluído${NC}"
else
    echo -e "${RED}❌ Erro no upload${NC}"
    rm /tmp/rsync_exclude.txt
    exit 1
fi

# Limpar arquivo temporário
rm /tmp/rsync_exclude.txt

echo ""
echo "⚙️  3. Instalando dependências no servidor..."
ssh $SERVER_USER@$SERVER_IP << 'ENDSSH'
cd /var/www/ecokambio
npm install --production
npm run build:prod
ENDSSH

echo ""
echo "🔄 4. Reiniciando aplicação..."
ssh $SERVER_USER@$SERVER_IP "pm2 restart ecokambio || pm2 start /var/www/ecokambio/server.js --name ecokambio"

echo ""
echo "════════════════════════════════════════════════════════"
echo -e " ${GREEN}✅ Deploy concluído com sucesso!${NC}"
echo "════════════════════════════════════════════════════════"
echo ""
echo "📊 Ver status: ssh $SERVER_USER@$SERVER_IP 'pm2 status'"
echo "📝 Ver logs: ssh $SERVER_USER@$SERVER_IP 'pm2 logs ecokambio'"
echo "🌐 Acessar: https://ecokambio.com"
