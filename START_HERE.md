# 🚀 Deploy Rápido - EcoKambio na Contabo

**Servidor**: 212.90.120.135  
**Domínio**: ecokambio.com

---

## ⚡ Deploy em 4 Passos (Totalmente Automatizado)

### 1️⃣ Instalar Dependências no Servidor
```bash
expect scripts/install_remote.exp
```
Instala: Node.js, PM2, Nginx, Certbot

### 2️⃣ Fazer Deploy da Aplicação
```bash
expect scripts/deploy_auto.exp
```
Faz upload e inicia a aplicação

### 3️⃣ Configurar Nginx
```bash
expect scripts/setup_nginx.exp
```
Configura proxy reverso

### 4️⃣ Instalar SSL (Let's Encrypt)
```bash
expect scripts/install_ssl.exp
```
Instala certificado HTTPS

✅ **Pronto!** Acesse: https://ecokambio.com

---

## 🔄 Atualizar Site (depois do deploy inicial)

```bash
expect scripts/deploy_auto.exp
```

---

## 📋 Configurar .env

Antes do primeiro deploy, configure as variáveis:

```bash
# 1. Conectar ao servidor
ssh root@212.90.120.135

# 2. Editar .env
cd /var/www/ecokambio
cp .env.example .env
nano .env

# 3. Preencher:
# - SUPABASE_URL
# - SUPABASE_ANON_KEY
# - SUPABASE_SERVICE_ROLE_KEY
# - SESSION_SECRET (gerar com: openssl rand -base64 32)

# 4. Reiniciar
pm2 restart ecokambio
```

---

## 🛠️ Comandos Úteis

### Conectar ao Servidor
```bash
ssh root@212.90.120.135
```

### Ver Status
```bash
ssh root@212.90.120.135 'pm2 status'
```

### Ver Logs
```bash
ssh root@212.90.120.135 'pm2 logs ecokambio --lines 50'
```

### Reiniciar App
```bash
ssh root@212.90.120.135 'pm2 restart ecokambio'
```

### Fazer Backup
```bash
ssh root@212.90.120.135 'bash /var/www/ecokambio/scripts/backup.sh'
```

---

## 📁 Scripts Disponíveis

| Script | Descrição | Comando |
|--------|-----------|---------|
| `install_remote.exp` | Instala dependências | `expect scripts/install_remote.exp` |
| `deploy_auto.exp` | Deploy completo | `expect scripts/deploy_auto.exp` |
| `setup_nginx.exp` | Configura Nginx | `expect scripts/setup_nginx.exp` |
| `install_ssl.exp` | Instala SSL | `expect scripts/install_ssl.exp` |

---

## 🔍 Verificação

### Testar HTTP
```bash
curl -I http://212.90.120.135
curl -I http://ecokambio.com
```

### Testar HTTPS
```bash
curl -I https://ecokambio.com
```

### Ver Certificado SSL
```bash
ssh root@212.90.120.135 'certbot certificates'
```

---

## 🆘 Problemas?

### Site não abre
```bash
# Verificar se app está rodando
ssh root@212.90.120.135 'pm2 status'

# Ver logs
ssh root@212.90.120.135 'pm2 logs ecokambio'

# Reiniciar tudo
ssh root@212.90.120.135 'pm2 restart ecokambio && systemctl restart nginx'
```

### SSL não funciona
```bash
# Reinstalar SSL
expect scripts/install_ssl.exp
```

---

## 📚 Documentação Completa

- [DEPLOY_CONTABO.md](DEPLOY_CONTABO.md) - Guia passo a passo detalhado
- [QUICK_REFERENCE.md](QUICK_REFERENCE.md) - Referência de comandos
- [scripts/README.md](scripts/README.md) - Documentação dos scripts

---

**💡 Dica**: Todos os scripts estão configurados com as credenciais do servidor!
