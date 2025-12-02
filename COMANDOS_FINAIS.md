# 🚀 Comandos Para Executar no Servidor SSH

**Cole estes comandos no terminal SSH que você tem aberto**

---

## 1. Extrair arquivos

```bash
cd /var/www/ecokambio
tar -xzf /root/ecokambio.tar.gz
ls -la
```

---

## 2. Criar arquivo .env

```bash
cd /var/www/ecokambio

# Gerar SECRET automaticamente
SESSION_SECRET=$(openssl rand -base64 32)

# Criar .env
cat > .env << EOF
NODE_ENV=production
PORT=3000

# IMPORTANTE: Preencha com seus valores reais do Supabase!
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

SESSION_SECRET=$SESSION_SECRET
COOKIE_DOMAIN=.ecokambio.com
EOF

# Editar para adicionar valores Supabase
nano .env
```

**No nano**: 
- Preencha `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `Ctrl+O` para salvar
- `Ctrl+X` para sair

---

## 3. Instalar dependências e build

```bash
cd /var/www/ecokambio

# Instalar dependências
npm install --production

# Build CSS
npm run build:prod
```

---

## 4. Iniciar aplicação com PM2

```bash
cd /var/www/ecokambio

# Iniciar
pm2 start server.js --name ecokambio

# Salvar configuração
pm2 save

# Auto-start no boot
pm2 startup

# IMPORTANTE: Copie e execute o comando que aparecer
```

---

## 5. Configurar Nginx

```bash
# Criar configuração Nginx
cat > /etc/nginx/sites-available/ecokambio << 'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name ecokambio.com www.ecokambio.com 212.90.120.135;

    access_log /var/log/nginx/ecokambio_access.log;
    error_log /var/log/nginx/ecokambio_error.log;

    location ~ /.well-known/acme-challenge {
        allow all;
    }

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
        proxy_read_timeout 86400;
    }
}
EOF

# Ativar site
ln -sf /etc/nginx/sites-available/ecokambio /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Testar configuração
nginx -t

# Recarregar Nginx
systemctl reload nginx
systemctl status nginx
```

---

## 6. Testar

```bash
# Ver logs PM2
pm2 logs ecokambio --lines 20

# Ver status
pm2 status

# Testar localmente
curl -I http://localhost:3000

# Testar Nginx
curl -I http://localhost
```

---

## 7. Instalar SSL (Let's Encrypt)

```bash
certbot --nginx -d ecokambio.com -d www.ecokambio.com
```

**Durante a instalação**:
1. Digite seu email quando solicitado
2. Aceite os termos: `Y`
3. Compartilhar email (opcional): `N`
4. Redirecionar HTTP → HTTPS: `2` (escolha 2)

---

## ✅ Verificação Final

```bash
# Status dos serviços
pm2 status
systemctl status nginx

# Certificado SSL
certbot certificates

# Logs
pm2 logs ecokambio --lines 30
tail -20 /var/log/nginx/error.log
```

**Testar no navegador**:
- http://212.90.120.135
- http://ecokambio.com
- https://ecokambio.com

---

**📝 Pronto! Seu site estará online!** 🚀
