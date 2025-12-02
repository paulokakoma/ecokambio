#!/bin/bash

#######################################################################
# Script de Instalação Completa - EcoKambio na Contabo
# Este script automatiza todo o processo de deploy
#######################################################################

set -e  # Parar se houver erros

echo "════════════════════════════════════════════════════════"
echo " 🚀 Instalação EcoKambio - Contabo VPS"
echo "════════════════════════════════════════════════════════"
echo ""

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Função para mensagens de sucesso
success() {
    echo -e "${GREEN}✅ $1${NC}"
}

# Função para mensagens de aviso
warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Função para mensagens de erro
error() {
    echo -e "${RED}❌ $1${NC}"
}

# Verificar se está rodando como root
if [ "$EUID" -ne 0 ]; then 
    error "Por favor execute como root (use: sudo bash install_contabo.sh)"
    exit 1
fi

echo "📝 Passo 1: Atualizar sistema..."
apt update && apt upgrade -y
success "Sistema atualizado"

echo ""
echo "📦 Passo 2: Instalar Node.js 20.x..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
    success "Node.js instalado: $(node --version)"
else
    success "Node.js já instalado: $(node --version)"
fi

echo ""
echo "📦 Passo 3: Instalar PM2..."
if ! command -v pm2 &> /dev/null; then
    npm install -g pm2
    success "PM2 instalado"
else
    success "PM2 já instalado"
fi

echo ""
echo "📦 Passo 4: Instalar Nginx..."
# Parar Nginx se estiver rodando
systemctl stop nginx 2>/dev/null || true

# Remover instalações antigas
apt-get remove --purge nginx nginx-common -y 2>/dev/null || true
apt-get autoremove -y

# Instalar Nginx
apt-get install nginx -y
success "Nginx instalado"

echo ""
echo "📦 Passo 5: Instalar Certbot (Let's Encrypt)..."
apt-get install certbot python3-certbot-nginx -y
success "Certbot instalado"

echo ""
echo "📁 Passo 6: Criar diretório da aplicação..."
mkdir -p /var/www/ecokambio
success "Diretório criado: /var/www/ecokambio"

echo ""
echo "════════════════════════════════════════════════════════"
echo " ℹ️  PRÓXIMOS PASSOS MANUAIS"
echo "════════════════════════════════════════════════════════"
echo ""
echo "1️⃣  Fazer upload dos arquivos:"
echo "    scp -r /Users/av/Documents/Projetos/ecokambio-main/* root@SEU_IP:/var/www/ecokambio/"
echo ""
echo "2️⃣  Configurar variáveis de ambiente:"
echo "    nano /var/www/ecokambio/.env"
echo ""
echo "3️⃣  Instalar dependências:"
echo "    cd /var/www/ecokambio"
echo "    npm install --production"
echo "    npm run build:prod"
echo ""
echo "4️⃣  Configurar Nginx:"
echo "    Criar: /etc/nginx/sites-available/ecokambio"
echo "    (Use a configuração do arquivo DEPLOY_CONTABO.md)"
echo ""
echo "5️⃣  Ativar site:"
echo "    ln -s /etc/nginx/sites-available/ecokambio /etc/nginx/sites-enabled/"
echo "    rm -f /etc/nginx/sites-enabled/default"
echo "    nginx -t"
echo "    systemctl reload nginx"
echo ""
echo "6️⃣  Configurar SSL:"
echo "    certbot --nginx -d ecokambio.com -d www.ecokambio.com"
echo ""
echo "7️⃣  Iniciar aplicação:"
echo "    cd /var/www/ecokambio"
echo "    pm2 start server.js --name ecokambio"
echo "    pm2 save"
echo "    pm2 startup"
echo ""
success "Instalação das dependências concluída!"
echo ""
echo "📖 Consulte DEPLOY_CONTABO.md para instruções detalhadas"
