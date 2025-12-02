# 🚀 Guia Rápido - Deploy Contabo

Referência rápida dos comandos mais usados para deploy e manutenção.

## ⚡ Comandos Essenciais

### Conectar ao Servidor
```bash
ssh root@SEU_IP_CONTABO
```

### Ver Status da Aplicação
```bash
pm2 status
pm2 logs ecokambio
```

### Reiniciar Aplicação
```bash
pm2 restart ecokambio
```

### Ver Logs em Tempo Real
```bash
pm2 logs ecokambio --lines 50
```

### Atualizar Aplicação
```bash
bash /var/www/ecokambio/scripts/update.sh
```

### Fazer Backup
```bash
bash /var/www/ecokambio/scripts/backup.sh
```

---

## 📦 Deploy do Zero

### 1️⃣ No Servidor (primeira vez)
```bash
# Conectar
ssh root@SEU_IP

# Instalar dependências
wget https://SEU_REPO/install_contabo.sh
bash install_contabo.sh
```

### 2️⃣ Upload de Arquivos
```bash
# No computador local
# Editar SERVER_IP no script primeiro!
bash scripts/deploy_to_contabo.sh
```

### 3️⃣ Configurar .env
```bash
# No servidor
nano /var/www/ecokambio/.env
# Colar variáveis de ambiente
```

### 4️⃣ Configurar Nginx
```bash
# Copiar config
cp /var/www/ecokambio/nginx_contabo_http.conf /etc/nginx/sites-available/ecokambio

# Ativar
ln -s /etc/nginx/sites-available/ecokambio /etc/nginx/sites-enabled/
rm /etc/nginx/sites-enabled/default

# Aplicar
nginx -t && systemctl reload nginx
```

### 5️⃣ Instalar SSL
```bash
certbot --nginx -d ecokambio.com -d www.ecokambio.com
```

### 6️⃣ Iniciar App
```bash
cd /var/www/ecokambio
npm install --production
npm run build:prod
pm2 start server.js --name ecokambio
pm2 save
pm2 startup
```

✅ **Pronto!** Acesse: https://ecokambio.com

---

## 🔄 Atualizar Site

### Opção A: Script Automatizado (Recomendado)
```bash
# Do computador local
bash scripts/deploy_to_contabo.sh
```

### Opção B: Via Git
```bash
# No servidor
bash /var/www/ecokambio/scripts/update.sh
```

### Opção C: Manual
```bash
# No servidor
cd /var/www/ecokambio
git pull
npm install --production
npm run build:prod
pm2 restart ecokambio
```

---

## 🛠️ Manutenção

### Verificar Nginx
```bash
nginx -t                    # Testar config
systemctl status nginx      # Ver status
systemctl reload nginx      # Recarregar
tail -f /var/log/nginx/error.log  # Ver erros
```

### Verificar PM2
```bash
pm2 status                  # Status
pm2 monit                   # Uso CPU/RAM
pm2 logs ecokambio          # Logs
pm2 restart ecokambio       # Reiniciar
pm2 stop ecokambio          # Parar
```

### Verificar SSL
```bash
certbot certificates        # Ver certificados
certbot renew              # Renovar
certbot renew --dry-run    # Testar renovação
```

### Verificar Portas
```bash
netstat -tuln | grep 3000  # Verificar porta 3000
netstat -tuln | grep 80    # Verificar porta 80
netstat -tuln | grep 443   # Verificar porta 443
```

### Verificar Processos
```bash
ps aux | grep node         # Processos Node.js
ps aux | grep nginx        # Processos Nginx
```

---

## 🐛 Resolução de Problemas

### App não inicia
```bash
# Ver logs detalhados
pm2 logs ecokambio --lines 100

# Verificar .env
cat /var/www/ecokambio/.env

# Testar manualmente
cd /var/www/ecokambio
node server.js
```

### Erro 502 Bad Gateway
```bash
# 1. Verificar se app está rodando
pm2 status

# 2. Verificar porta
netstat -tuln | grep 3000

# 3. Ver logs
pm2 logs ecokambio
tail -f /var/log/nginx/error.log

# 4. Reiniciar tudo
pm2 restart ecokambio
systemctl restart nginx
```

### Site não abre (DNS)
```bash
# Verificar se domínio aponta para servidor
dig ecokambio.com
nslookup ecokambio.com

# Testar diretamente no IP
curl http://SEU_IP
```

### SSL não funciona
```bash
# Ver certificados
certbot certificates

# Renovar
certbot renew --force-renewal

# Verificar config Nginx
nginx -t
cat /etc/nginx/sites-enabled/ecokambio
```

### Porta 3000 em uso
```bash
# Ver quem está usando
lsof -i :3000

# Matar processo
kill -9 PID

# Ou parar PM2
pm2 stop ecokambio
pm2 delete ecokambio
```

---

## 📊 Monitoramento

### Espaço em Disco
```bash
df -h                      # Geral
du -sh /var/www/ecokambio  # App
du -sh /root/backups       # Backups
```

### Memória
```bash
free -h                    # RAM
pm2 monit                  # Por processo
```

### CPU
```bash
top                        # Geral
htop                       # Melhor visualização
pm2 monit                  # Por processo
```

### Logs
```bash
# Nginx
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log

# PM2
pm2 logs ecokambio

# System
journalctl -xe
```

---

## 🔒 Segurança

### Firewall (Configurar UFW)
```bash
ufw allow ssh
ufw allow 'Nginx Full'
ufw enable
ufw status
```

### Atualizar Sistema
```bash
apt update && apt upgrade -y
```

### Ver Últimos Logins
```bash
last                       # Últimos logins
lastlog                    # Último login por usuário
```

---

## 📁 Estrutura de Diretórios

```
/var/www/ecokambio/        # Aplicação principal
├── server.js              # Servidor Node.js
├── .env                   # Variáveis de ambiente
├── public/                # Arquivos estáticos
├── src/                   # Código fonte
└── scripts/               # Scripts de manutenção

/etc/nginx/
├── sites-available/ecokambio  # Config Nginx
└── sites-enabled/ecokambio    # Link simbólico

/root/backups/             # Backups automáticos
└── ecokambio_*.tar.gz     # Arquivos de backup

/var/log/nginx/            # Logs Nginx
├── access.log
└── error.log
```

---

## 📞 Ajuda Rápida

| Problema | Solução Rápida |
|----------|----------------|
| Site offline | `pm2 restart ecokambio && systemctl restart nginx` |
| Erro 502 | `pm2 logs ecokambio` e verificar erros |
| SSL expirado | `certbot renew` |
| Sem espaço | `du -sh /* \| sort -h` e limpar arquivos |
| Alta CPU | `pm2 monit` e verificar processo |
| Logs grandes | `pm2 flush` para limpar logs PM2 |

---

## 🔗 Links Úteis

- [Guia Completo](DEPLOY_CONTABO.md)
- [Scripts README](scripts/README.md)
- [PM2 Docs](https://pm2.keymetrics.io/docs/)
- [Nginx Docs](https://nginx.org/en/docs/)
- [Certbot Docs](https://certbot.eff.org/)

---

**💡 Dica**: Adicione este arquivo aos favoritos para referência rápida!
