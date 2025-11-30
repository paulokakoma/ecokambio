#!/bin/bash

# Script de Setup para VPS Ubuntu (Contabo)
# Uso: chmod +x setup-vps.sh && ./setup-vps.sh

echo "🚀 Iniciando setup do servidor..."

# 1. Atualizar sistema
echo "📦 Atualizando pacotes do sistema..."
sudo apt update && sudo apt upgrade -y

# 2. Instalar Node.js 20 (LTS)
echo "🟢 Instalando Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verificar instalação
node -v
npm -v

# 3. Instalar dependências do sistema para Puppeteer (Chrome Headless)
echo "🌐 Instalando dependências do Puppeteer..."
sudo apt-get install -y ca-certificates fonts-liberation libasound2t64 libatk-bridge2.0-0 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgbm1 libgcc1 libglib2.0-0 libgtk-3-0 libnspr4 libnss3 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 lsb-release wget xdg-utils

# 4. Instalar PM2 globalmente
echo "⚙️ Instalando PM2..."
sudo npm install -g pm2

# 5. Configurar Firewall (UFW)
echo "🛡️ Configurando Firewall..."
# Permitir SSH (evitar bloqueio)
sudo ufw allow 22
# Permitir porta da aplicação
sudo ufw allow 3000
# Permitir HTTP/HTTPS (para futuro Nginx)
sudo ufw allow 80
sudo ufw allow 443

echo "⚠️ Habilitando firewall..."
sudo ufw --force enable

echo "✅ Setup concluído! O servidor está pronto para receber a aplicação."
echo "📝 Próximos passos:"
echo "1. Clone o repositório"
echo "2. Crie o arquivo .env"
echo "3. Execute 'npm install'"
echo "4. Inicie com 'pm2 start ecosystem.config.js'"
