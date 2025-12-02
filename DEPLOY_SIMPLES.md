# 🚀 Deploy Ultra Simples - 3 Passos

**Devido a problemas de conexão SSH, vamos usar o método mais simples possível.**

---

## ✅ Passo 1: Instalar Dependências no Servidor

Você já está conectado via SSH. **Cole este comando completo** no terminal SSH:

```bash
apt update && apt upgrade -y && \
curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
apt-get install -y nodejs && \
npm install -g pm2 && \
systemctl stop nginx 2>/dev/null || true && \
apt-get remove --purge nginx nginx-common -y 2>/dev/null || true && \
apt-get autoremove -y && \
apt-get install nginx certbot python3-certbot-nginx -y && \
mkdir -p /var/www/ecokambio && \
echo "✅ Instalação concluída! Node: $(node --version), PM2: $(pm2 --version)"
```

Aguarde completar (5-10 minutos).

---

## ✅ Passo 2: Upload dos Arquivos

**Abra um NOVO terminal** no seu Mac e execute:

```bash
cd /Users/av/Documents/Projetos/ecokambio-main

# Crie um arquivo tar local
tar -czf ecokambio.tar.gz \
  --exclude=node_modules \
  --exclude=.git \
  --exclude=.DS_Store \
  --exclude=logs \
  --exclude=sessions \
  --exclude=.env \
  *

# Upload do arquivo tar
scp ecokambio.tar.gz root@212.90.120.135:/root/
```

Senha: `1234`

**Depois, no terminal SSH do servidor**:

```bash
cd /var/www/ecokambio
tar -xzf /root/ecokambio.tar.gz
ls -la
```

---

## ✅ Passo 3: Configurar e Iniciar

**No terminal SSH do servidor**:

```bash
cd /var/www/ecokambio

# Criar .env
cat > .env << 'EOF'
NODE_ENV=production
PORT=3000

# IMPORTANTE: Preencha com seus valores reais!
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

SESSION_SECRET=$(openssl rand -base64 32)
COOKIE_DOMAIN=.ecokambio.com
EOF

# Editar .env para preencher as variáveis Supabase
nano .env
# Ctrl+O para salvar, Ctrl+X para sair

# Instalar dependências
npm install --production

# Build CSS
npm run build:prod

# Iniciar app
pm2 start server.js --name ecokambio
pm2 save
pm2 startup
# Copie e execute o comando que aparecer

# Configurar Nginx
cat > /etc/nginx/sites-available/ecokambio << 'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name ecokambio.com www.ecokambio.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

ln -sf /etc/nginx/sites-available/ecokambio /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# Instalar SSL
certbot --nginx -d ecokambio.com -d www.ecokambio.com

# Ver status
pm2 status
systemctl status nginx
```

---

## ✅ Verificar

```bash
# Ver logs
pm2 logs ecokambio

# Testar
curl -I http://localhost:3000
curl -I http://ecokambio.com
curl -I https://ecokambio.com
```

**Abra no navegador**: https://ecokambio.com

---

## 🔄 Para Atualizar

```bash
# No Mac
cd /Users/av/Documents/Projetos/ecokambio-main
tar -czf ecokambio.tar.gz --exclude=node_modules --exclude=.git --exclude=.env *
scp ecokambio.tar.gz root@212.90.120.135:/root/

# No servidor
cd /var/www/ecokambio
tar -xzf /root/ecokambio.tar.gz
npm install --production
npm run build:prod
pm2 restart ecokambio
```

---

**💡 Este método é 100% confiável!** Não depende de múltiplas conexões SSH.
