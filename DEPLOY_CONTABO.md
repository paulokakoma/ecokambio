# Deploy EcoKambio na Contabo com Nginx

Este guia fornece instruções completas para fazer deploy da aplicação EcoKambio em um servidor Contabo usando Nginx como proxy reverso.

## 📋 Pré-requisitos

- Servidor VPS Contabo (Ubuntu 20.04/22.04)
- Acesso SSH ao servidor
- Domínio configurado: `ecokambio.com` apontando para o IP do servidor
- Credenciais de acesso ao servidor

## 🚀 Passo 1: Conexão ao Servidor

```bash
ssh root@SEU_IP_CONTABO
```

## 📦 Passo 2: Instalação de Dependências

### 2.1 Atualizar o sistema

```bash
apt update && apt upgrade -y
```

### 2.2 Instalar Node.js 20.x

```bash
# Instalar Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Verificar versão
node --version
npm --version
```

### 2.3 Instalar PM2 (Process Manager)

```bash
npm install -g pm2

# Configurar PM2 para iniciar automaticamente
pm2 startup systemd
```

### 2.4 Instalar Nginx

```bash
# Remover instalações antigas (se existirem)
systemctl stop nginx
apt-get remove --purge nginx nginx-common -y
apt-get autoremove -y

# Instalar Nginx
apt-get install nginx -y

# Verificar status
systemctl status nginx
```

### 2.5 Instalar Certbot (Let's Encrypt)

```bash
apt-get install certbot python3-certbot-nginx -y
```

## 📁 Passo 3: Configurar Aplicação

### 3.1 Criar diretório da aplicação

```bash
mkdir -p /var/www/ecokambio
cd /var/www/ecokambio
```

### 3.2 Clonar repositório

```bash
# Se usar Git
git clone https://github.com/SEU_USUARIO/ecokambio.git .

# OU fazer upload via SFTP/SCP dos arquivos locais
# scp -r /Users/av/Documents/Projetos/ecokambio-main/* root@SEU_IP:/var/www/ecokambio/
```

### 3.3 Configurar variáveis de ambiente

```bash
nano .env
```

Cole suas variáveis de ambiente:

```env
NODE_ENV=production
PORT=3000

# Supabase
SUPABASE_URL=sua_url_supabase
SUPABASE_ANON_KEY=sua_key_supabase
SUPABASE_SERVICE_ROLE_KEY=sua_service_key

# Session
SESSION_SECRET=sua_chave_secreta_longa_e_aleatoria
COOKIE_DOMAIN=.ecokambio.com

# Email (se usar)
RESEND_API_KEY=sua_key_resend
```

### 3.4 Instalar dependências

```bash
npm install --production
```

### 3.5 Build CSS (se necessário)

```bash
npm run build:prod
```

## ⚙️ Passo 4: Configurar Nginx

### 4.1 Criar configuração do Nginx

```bash
nano /etc/nginx/sites-available/ecokambio
```

Cole a seguinte configuração:

```nginx
# Configuração HTTP (temporária, antes do SSL)
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
        proxy_read_timeout 86400;
    }

    # Permitir acesso ao Certbot
    location ~ /.well-known/acme-challenge {
        allow all;
    }
}
```

### 4.2 Ativar configuração

```bash
# Criar link simbólico
ln -s /etc/nginx/sites-available/ecokambio /etc/nginx/sites-enabled/

# Remover configuração padrão
rm -f /etc/nginx/sites-enabled/default

# Testar configuração
nginx -t

# Recarregar Nginx
systemctl reload nginx
```

## 🔐 Passo 5: Configurar SSL/HTTPS

### 5.1 Obter certificado SSL gratuito

```bash
certbot --nginx -d ecokambio.com -d www.ecokambio.com
```

Siga as instruções:
- Forneça um email válido
- Aceite os termos
- Escolha redirecionar HTTP para HTTPS (opção 2)

### 5.2 Verificar renovação automática

```bash
# Testar renovação (dry-run)
certbot renew --dry-run

# O certbot criará um cron job automaticamente
systemctl status certbot.timer
```

## 🎯 Passo 6: Iniciar Aplicação com PM2

### 6.1 Iniciar aplicação

```bash
cd /var/www/ecokambio

# Iniciar com PM2
pm2 start server.js --name ecokambio

# Salvar configuração
pm2 save

# Verificar status
pm2 status
pm2 logs ecokambio
```

### 6.2 Configurar monitoramento

```bash
# Ver logs em tempo real
pm2 logs ecokambio

# Ver informações de CPU/memória
pm2 monit

# Reiniciar automaticamente se crashar
pm2 startup
```

## 🔄 Passo 7: Scripts de Manutenção

### 7.1 Script de atualização (`update.sh`)

Crie um script para facilitar atualizações:

```bash
nano /var/www/ecokambio/update.sh
```

```bash
#!/bin/bash
echo "🔄 Atualizando EcoKambio..."

cd /var/www/ecokambio

# Fazer backup da configuração
cp .env .env.backup

# Baixar atualizações (Git)
git pull origin main

# Instalar novas dependências
npm install --production

# Build CSS
npm run build:prod

# Reiniciar aplicação
pm2 restart ecokambio

echo "✅ Atualização concluída!"
pm2 status
```

```bash
chmod +x /var/www/ecokambio/update.sh
```

### 7.2 Script de backup (`backup.sh`)

```bash
nano /var/www/ecokambio/backup.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/root/backups"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR
cd /var/www

tar -czf $BACKUP_DIR/ecokambio_$DATE.tar.gz \
    ecokambio/.env \
    ecokambio/public \
    ecokambio/private

echo "✅ Backup criado: ecokambio_$DATE.tar.gz"
```

```bash
chmod +x /var/www/ecokambio/backup.sh
```

## 📊 Passo 8: Verificação e Testes

### 8.1 Verificar serviços

```bash
# Nginx
systemctl status nginx

# PM2
pm2 status

# Aplicação Node.js
pm2 logs ecokambio --lines 50
```

### 8.2 Testar o site

```bash
# Verificar HTTP (deve redirecionar para HTTPS)
curl -I http://ecokambio.com

# Verificar HTTPS
curl -I https://ecokambio.com

# Ver logs Nginx
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

### 8.3 Testar no navegador

Abra no navegador:
- https://ecokambio.com
- https://www.ecokambio.com

## 🛠️ Comandos Úteis

### Nginx

```bash
# Verificar configuração
nginx -t

# Recarregar configuração
systemctl reload nginx

# Reiniciar Nginx
systemctl restart nginx

# Ver logs
tail -f /var/log/nginx/error.log
tail -f /var/log/nginx/access.log
```

### PM2

```bash
# Ver status
pm2 status

# Ver logs
pm2 logs ecokambio

# Reiniciar app
pm2 restart ecokambio

# Parar app
pm2 stop ecokambio

# Deletar app
pm2 delete ecokambio

# Ver uso de recursos
pm2 monit
```

### Certbot

```bash
# Renovar certificados
certbot renew

# Listar certificados
certbot certificates

# Testar renovação
certbot renew --dry-run
```

## 🐛 Solução de Problemas

### App não inicia

```bash
# Ver logs
pm2 logs ecokambio --lines 100

# Verificar variáveis de ambiente
cat /var/www/ecokambio/.env

# Testar manualmente
cd /var/www/ecokambio
node server.js
```

### Nginx erro 502 Bad Gateway

```bash
# Verificar se app está rodando
pm2 status

# Verificar porta
netstat -tuln | grep 3000

# Ver logs Nginx
tail -f /var/log/nginx/error.log
```

### Certificado SSL não funciona

```bash
# Verificar certificados
certbot certificates

# Renovar forçado
certbot renew --force-renewal
```

### Problemas de permissão

```bash
# Corrigir permissões
chown -R www-data:www-data /var/www/ecokambio
chmod -R 755 /var/www/ecokambio
```

## 📈 Otimizações Recomendadas

### 1. Configurar firewall

```bash
# Instalar UFW
apt-get install ufw -y

# Permitir SSH, HTTP e HTTPS
ufw allow ssh
ufw allow 'Nginx Full'

# Ativar firewall
ufw enable
ufw status
```

### 2. Configurar swap (se pouca RAM)

```bash
# Criar arquivo swap de 2GB
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile

# Tornar permanente
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

### 3. Monitoramento com PM2

```bash
# Instalar PM2 Plus (opcional, para monitoramento online)
pm2 plus
```

## 🔄 Atualização da Aplicação

### Método 1: Via Git

```bash
cd /var/www/ecokambio
git pull
npm install --production
npm run build:prod
pm2 restart ecokambio
```

### Método 2: Via Script

```bash
/var/www/ecokambio/update.sh
```

### Método 3: Upload manual via SFTP

```bash
# Do seu computador local
scp -r public/* root@SEU_IP:/var/www/ecokambio/public/
scp server.js root@SEU_IP:/var/www/ecokambio/

# No servidor
pm2 restart ecokambio
```

## 📝 Notas Importantes

1. **Backup Regular**: Execute backup antes de cada atualização
2. **Logs**: Monitore logs regularmente com `pm2 logs`
3. **Updates**: Mantenha o sistema atualizado com `apt update && apt upgrade`
4. **SSL**: Certificados renovam automaticamente, mas verifique mensalmente
5. **Segurança**: Altere senha root e desabilite login root via SSH

## 🆘 Suporte

Se encontrar problemas:

1. Verifique logs: `pm2 logs ecokambio`
2. Verifique Nginx: `tail -f /var/log/nginx/error.log`
3. Teste configuração: `nginx -t`
4. Reinicie serviços: `systemctl restart nginx && pm2 restart ecokambio`

---

✅ **Deploy concluído com sucesso!** Seu site está disponível em https://ecokambio.com
