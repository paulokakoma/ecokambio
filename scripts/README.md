# Scripts de Deploy - EcoKambio

Scripts para facilitar o deploy e manutenção do EcoKambio na Contabo.

## 📁 Scripts Disponíveis

### 🚀 `install_contabo.sh`
**Uso**: No servidor Contabo (primeira vez)  
**Executar como**: root

Instala todas as dependências necessárias no servidor:
- Node.js 20.x
- PM2 (Process Manager)
- Nginx
- Certbot (Let's Encrypt)

```bash
# No servidor Contabo
sudo bash install_contabo.sh
```

---

### 📤 `deploy_to_contabo.sh`
**Uso**: No computador local  
**Executar como**: usuário normal

Faz upload do código local para o servidor e reinicia a aplicação.

**Antes de usar**: Edite o script e configure o `SERVER_IP`

```bash
# No computador local
bash scripts/deploy_to_contabo.sh
```

Este script:
1. Faz backup no servidor
2. Faz upload via rsync (eficiente)
3. Instala dependências
4. Build CSS
5. Reinicia aplicação

---

### 🔄 `update.sh`
**Uso**: No servidor Contabo  
**Executar como**: root ou com sudo

Atualiza a aplicação no servidor (via Git).

```bash
# No servidor
bash /var/www/ecokambio/scripts/update.sh
```

Este script:
1. Faz backup do .env
2. Puxa código do Git
3. Instala dependências
4. Build CSS
5. Reinicia PM2

---

### 💾 `backup.sh`
**Uso**: No servidor Contabo  
**Executar como**: root ou com sudo

Cria backup dos arquivos importantes.

```bash
# No servidor
bash /var/www/ecokambio/scripts/backup.sh
```

Backups salvos em: `/root/backups/`  
Mantém últimos 7 backups automaticamente.

---

## 🔧 Configuração Inicial

### 1. Preparar Servidor

```bash
# Conectar ao servidor
ssh root@SEU_IP

# Executar instalação
bash install_contabo.sh
```

### 2. Fazer Upload dos Arquivos

**Opção A**: Via script automatizado (recomendado)

```bash
# No seu computador local
# 1. Editar script e configurar SERVER_IP
nano scripts/deploy_to_contabo.sh

# 2. Executar deploy
bash scripts/deploy_to_contabo.sh
```

**Opção B**: Via SCP manual

```bash
# No seu computador local
scp -r /Users/av/Documents/Projetos/ecokambio-main/* root@SEU_IP:/var/www/ecokambio/
```

### 3. Configurar Variáveis de Ambiente

```bash
# No servidor
nano /var/www/ecokambio/.env
```

### 4. Configurar Nginx

```bash
# Copiar configuração HTTP inicial
cat /var/www/ecokambio/nginx_contabo_http.conf > /etc/nginx/sites-available/ecokambio

# Ativar site
ln -s /etc/nginx/sites-available/ecokambio /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Testar e recarregar
nginx -t
systemctl reload nginx
```

### 5. Instalar SSL

```bash
# No servidor
certbot --nginx -d ecokambio.com -d www.ecokambio.com
```

O Certbot atualizará automaticamente a configuração do Nginx com SSL.

### 6. Iniciar Aplicação

```bash
# No servidor
cd /var/www/ecokambio
npm install --production
npm run build:prod

pm2 start server.js --name ecokambio
pm2 save
pm2 startup
```

---

## 🔄 Fluxo de Trabalho

### Deploy de Atualizações

**Método 1**: Script automatizado (mais rápido)
```bash
# No computador local
bash scripts/deploy_to_contabo.sh
```

**Método 2**: Via Git (se usar repositório)
```bash
# No servidor
bash /var/www/ecokambio/scripts/update.sh
```

### Ver Status

```bash
# No servidor
pm2 status
pm2 logs ecokambio
```

### Criar Backup Manual

```bash
# No servidor
bash /var/www/ecokambio/scripts/backup.sh
```

---

## 🆘 Troubleshooting

### Script não executa
```bash
# Dar permissão de execução
chmod +x scripts/*.sh
```

### Erro de conexão SSH
```bash
# Verificar se pode conectar
ssh root@SEU_IP

# Se erro de chave, adicionar fingerprint
ssh-keyscan SEU_IP >> ~/.ssh/known_hosts
```

### PM2 não encontrado
```bash
# Instalar PM2 globalmente
npm install -g pm2
```

### Nginx erro 502
```bash
# Verificar se app está rodando
pm2 status

# Ver logs
pm2 logs ecokambio
tail -f /var/log/nginx/error.log
```

---

## 📚 Documentação Completa

Para instruções detalhadas, consulte:
- [`DEPLOY_CONTABO.md`](../DEPLOY_CONTABO.md) - Guia completo passo a passo

---

## ⚡ Comandos Rápidos

```bash
# Ver logs em tempo real
pm2 logs ecokambio --lines 100

# Reiniciar aplicação
pm2 restart ecokambio

# Ver uso de recursos
pm2 monit

# Testar Nginx
nginx -t

# Recarregar Nginx
systemctl reload nginx

# Ver versão Node.js
node --version

# Ver certificados SSL
certbot certificates
```
