# 🔧 Comandos para Executar no Terminal SSH

**Você está conectado ao servidor**: 212.90.120.135

Execute estes comandos **no seu terminal SSH aberto**, na ordem:

---

## 1️⃣ Verificar Sistema Atual

```bash
# Verificar o que já está instalado
echo "=== Verificando instalações ==="
node --version 2>/dev/null || echo "❌ Node.js não instalado"
nginx -v 2>&1 | head -1 || echo "❌ Nginx não instalado"
pm2 --version 2>/dev/null || echo "❌ PM2 não instalado"
certbot --version 2>&1 | head -1 || echo "❌ Certbot não instalado"
```

---

## 2️⃣ Atualizar Sistema

```bash
apt update && apt upgrade -y
```

---

## 3️⃣ Instalar Node.js 20.x

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
node --version
npm --version
```

---

## 4️⃣ Instalar PM2

```bash
npm install -g pm2
pm2 --version
```

---

## 5️⃣ Instalar Nginx

```bash
# Parar nginx se existir
systemctl stop nginx 2>/dev/null || true

# Remover instalações antigas
apt-get remove --purge nginx nginx-common -y 2>/dev/null || true
apt-get autoremove -y

# Instalar
apt-get install nginx -y
nginx -v
```

---

## 6️⃣ Instalar Certbot

```bash
apt-get install certbot python3-certbot-nginx -y
certbot --version
```

---

## 7️⃣ Criar Diretório da Aplicação

```bash
mkdir -p /var/www/ecokambio
ls -la /var/www/
```

---

## ✅ Verificar Instalações

```bash
echo ""
echo "=== ✅ RESUMO DAS INSTALAÇÕES ==="
echo "Node.js: $(node --version)"
echo "NPM: $(npm --version)"
echo "PM2: $(pm2 --version)"
echo "Nginx: $(nginx -v 2>&1)"
echo "Certbot: $(certbot --version | head -1)"
echo ""
echo "Diretório app: /var/www/ecokambio"
ls -la /var/www/ecokambio
```

---

## 📝 Próximos Passos (Depois das Instalações)

Depois de concluir as instalações acima, **feche o SSH** e execute no **seu computador local**:

```bash
# 1. Deploy da aplicação
expect scripts/deploy_auto.exp

# 2. Configurar Nginx
expect scripts/setup_nginx.exp

# 3. Configurar .env (SSH de novo)
ssh root@212.90.120.135
cd /var/www/ecokambio
cp .env.example .env
nano .env
# Preencher variáveis e salvar (Ctrl+O, Enter, Ctrl+X)

# 4. Iniciar aplicação
pm2 start server.js --name ecokambio
pm2 save
pm2 startup
exit

# 5. Instalar SSL (do computador local)
expect scripts/install_ssl.exp
```

---

## 🆘 Se Algo Der Errado

```bash
# Ver logs de instalação
journalctl -xe

# Verificar serviços
systemctl status nginx
systemctl status pm2-root

# Reiniciar
systemctl restart nginx
```

---

**💡 Dica**: Copie e cole cada bloco de comandos no seu terminal SSH!
