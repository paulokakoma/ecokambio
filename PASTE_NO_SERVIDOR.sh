#!/bin/bash

#######################################################################
# Script de Deploy Ultra Simples
# Cola este conteúdo DIRETAMENTE no terminal SSH do servidor
#######################################################################

echo "════════════════════════════════════════════════════════"
echo " 🚀 Deploy EcoKambio - Instalação Rápida"
echo "════════════════════════════════════════════════════════"

# 1. Atualizar sistema
echo "📦 Atualizando sistema..."
apt update && apt upgrade -y

# 2. Instalar Node.js
echo "📦 Instalando Node.js..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# 3. Instalar PM2
echo "📦 Instalando PM2..."
npm install -g pm2

# 4. Instalar Nginx
echo "📦 Instalando Nginx..."
systemctl stop nginx 2>/dev/null || true
apt-get remove --purge nginx nginx-common -y 2>/dev/null || true
apt-get autoremove -y
apt-get install nginx -y

# 5. Instalar Certbot
echo "📦 Instalando Certbot..."
apt-get install certbot python3-certbot-nginx -y

# 6. Criar diretório
echo "📁 Criando diretório..."
mkdir -p /var/www/ecokambio

echo ""
echo "════════════════════════════════════════════════════════"
echo " ✅ Instalação concluída!"
echo "════════════════════════════════════════════════════════"
echo ""
echo "Versões instaladas:"
echo "  Node.js: $(node --version)"
echo "  NPM: $(npm --version)"
echo "  PM2: $(pm2 --version)"
echo "  Nginx: $(nginx -v 2>&1)"
echo ""
echo "📝 Próximo passo: Fazer upload dos arquivos do projeto"
echo ""
