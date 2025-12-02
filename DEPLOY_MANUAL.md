# 🎯 Deploy Simplificado - Passo a Passo

Devido a problemas de conexão SSH múltipla, vamos fazer o deploy de forma **manual e confiável**.

---

## Passo 1: Fazer Upload do Script de Instalação

**No seu computador local**, execute:

```bash
cd /Users/av/Documents/Projetos/ecokambio-main

# Upload do script de instalação
scp setup_server.sh root@212.90.120.135:/root/
```

Senha: `1234`

---

## Passo 2: Conectar ao Servidor e Instalar

```bash
ssh root@212.90.120.135
```

Senha: `1234`

**Agora no servidor**, execute:

```bash
# Executar instalação
cd /root
bash setup_server.sh
```

Aguarde completar (pode demorar alguns minutos).

---

## Passo 3: Fazer Upload dos Arquivos do Projeto

**Abra um NOVO terminal** no seu computador e execute:

```bash
cd /Users/av/Documents/Projetos/ecokambio-main

# Upload via SCP (mais confiável que rsync)
scp -r * root@212.90.120.135:/var/www/ecokambio/
```

Senha: `1234`

⚠️ **Nota**: Isso pode demorar alguns minutos dependendo da conexão.

---

## Passo 4: Configurar .env

**Volte ao terminal SSH do servidor** e execute:

```bash
cd /var/www/ecokambio

# Criar .env a partir do exemplo
cp .env.example .env

# Editar
nano .env
```

**Preencha as variáveis**:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SESSION_SECRET` (gere com: `openssl rand -base64 32`)
- `COOKIE_DOMAIN=.ecokambio.com`

**Salvar**: `Ctrl+O`, `Enter`, `Ctrl+X`

---

## Passo 5: Instalar Dependências e Iniciar App

```bash
cd /var/www/ecokambio

# Instalar dependências
npm install --production

# Build CSS
npm run build:prod

# Iniciar com PM2
pm2 start server.js --name ecokambio

# Salvar configuração
pm2 save

# Auto-start no boot
pm2 startup
# Copie e execute o comando que aparecer
```

---

## Passo 6: Configurar Nginx

```bash
# Copiar configuração
cp /var/www/ecokambio/nginx_contabo_http.conf /etc/nginx/sites-available/ecokambio

# Ativar site
ln -sf /etc/nginx/sites-available/ecokambio /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Testar configuração
nginx -t

# Se OK, recarregar
systemctl reload nginx
systemctl status nginx
```

---

## Passo 7: Testar o Site

**Abra no navegador**:
- http://212.90.120.135
- http://ecokambio.com (se DNS já está configurado)

Se funcionar, prossiga para o SSL.

---

## Passo 8: Instalar SSL (Let's Encrypt)

**No servidor SSH**, execute:

```bash
certbot --nginx -d ecokambio.com -d www.ecokambio.com
```

**Durante o processo**:
1. Digite seu email: `seu_email@example.com`
2. Aceite os termos: `Y`
3. Compartilhar email (opcional): `N`
4. Redirecionar HTTP → HTTPS: `2` (recomendado)

---

## ✅ Verificação Final

```bash
# Ver status PM2
pm2 status
pm2 logs ecokambio --lines 20

# Ver status Nginx
systemctl status nginx

# Testar certificado
certbot certificates
```

**Testar no navegador**:
- https://ecokambio.com
- https://www.ecokambio.com

---

## 🔄 Para Atualizar Futuramente

### Opção 1: Upload Manual
```bash
# No computador local
scp -r /Users/av/Documents/Projetos/ecokambio-main/* root@212.90.120.135:/var/www/ecokambio/

# No servidor
ssh root@212.90.120.135
cd /var/www/ecokambio
npm install --production
npm run build:prod
pm2 restart ecokambio
```

### Opção 2: Via Git
```bash
# No servidor
cd /var/www/ecokambio
git pull
npm install --production
npm run build:prod
pm2 restart ecokambio
```

---

## 🆘 Comandos Úteis

```bash
# Ver logs da aplicação
pm2 logs ecokambio

# Reiniciar aplicação
pm2 restart ecokambio

# Ver logs Nginx
tail -f /var/log/nginx/error.log

# Reiniciar Nginx
systemctl restart nginx

# Ver processos
pm2 monit
```

---

## 📝 Checklist

- [ ] Script instalado no servidor
- [ ] Dependências instaladas (Node, PM2, Nginx, Certbot)
- [ ] Arquivos do projeto enviados
- [ ] .env configurado
- [ ] Dependências NPM instaladas
- [ ] Aplicação iniciada com PM2
- [ ] Nginx configurado
- [ ] Site acessível via HTTP
- [ ] SSL instalado
- [ ] Site acessível via HTTPS

---

**💡 Dica**: Mantenha o terminal SSH aberto durante todo o processo!
