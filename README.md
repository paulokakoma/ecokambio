# 💱 EcoKambio - Plataforma de Câmbio em Angola

<div align="center">

**Plataforma digital líder para taxas de câmbio atualizadas em Angola**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequest.com)

[Website](https://ecokambio.com) • [Documentação](docs/) • [Report Bug](https://github.com/paulokakoma/ecokambio/issues)

</div>

---

## 📋 Índice

- [Sobre o Projeto](#-sobre-o-projeto)
- [Funcionalidades](#-funcionalidades)
- [Tecnologias](#-tecnologias)
- [Estrutura do Projeto](#-estrutura-do-projeto)
- [Instalação](#-instalação)
- [Configuração](#-configuração)
- [Uso](#-uso)
- [Scripts Disponíveis](#-scripts-disponíveis)
- [Deployment](#-deployment)
- [Contribuição](#-contribuição)
- [Licença](#-licença)
- [Contato](#-contato)

---

## 🎯 Sobre o Projeto

O **EcoKambio** é a plataforma digital líder para consulta de taxas de câmbio em Angola, oferecendo:

- 📊 Taxas de câmbio em tempo real do mercado formal (bancos) e informal (kinguilas)
- 💱 Calculadora de custos de importação
- 📱 Interface responsiva e moderna
- 🔐 Painel administrativo seguro
- 🤖 Web scraping automatizado de taxas bancárias
- 📈 Comparação de diferentes fornecedores de câmbio

**Desenvolvido e operado por:**  
**Moko Tech, Sociedade por Quotas** - Empresa registada na República de Angola

---

## ✨ Funcionalidades

### Página Pública
- ✅ Visualização de taxas de câmbio atualizadas (USD, EUR, ZAR, GBP, etc.)
- ✅ Comparação entre mercado formal e informal
- ✅ Calculadora de custos de importação
- ✅ Informações sobre produtos financeiros (Cartões Visa, etc.)
- ✅ Sistema de afiliados integrado
- ✅ SEO otimizado
- ✅ PWA (Progressive Web App)

### Painel Administrativo
- 🔐 Autenticação segura com cookies assinados
- 📝 Gestão de taxas de câmbio
- 🏦 Gestão de fornecedores (bancos e casas de câmbio)
- 📊 Dashboard com métricas em tempo real
- 🔗 Gestão de links de afiliados
- 📸 Upload de imagens para produtos
- 🌐 Comunicação WebSocket para atualizações em tempo real

### Web Scraping Automatizado
- 🤖 Scraping de taxas bancárias a cada 4 horas
- 🎭 Suporte para Playwright, Puppeteer e Crawlee
- 📅 Agendamento via node-cron
- 💾 Armazenamento em Supabase

---

## 🛠 Tecnologias

### Backend
- **Node.js** (v18+) - Runtime JavaScript
- **Express.js** (v4.21) - Framework web
- **Supabase** - Base de dados PostgreSQL e autenticação
- **WebSocket (ws)** - Comunicacao em tempo real
- **bcrypt** - Hash de senhas
- **helmet** - Segurança HTTP
- **express-rate-limit** - Rate limiting
- **compression** - Compressão Gzip

### Frontend
- **HTML5, CSS3, JavaScript (Vanilla)** - Interface
- **Tailwind CSS** (v3.4) - Framework CSS
- **Service Worker** - PWA offline support

### Web Scraping
- **Playwright** - Browser automation
- **Puppeteer** - Chrome/Chromium automation  
- **Crawlee** - Web crawling framework
- **node-cron** - Job scheduling

### DevOps & Tools
- **Docker** - Containerização
- **Nodemon** - Auto-reload em desenvolvimento
- **Concurrently** - Execução paralela de scripts
- **Git** - Controle de versão

---

## 📁 Estrutura do Projeto

```
ecokambio-main/
│
├── public/                    # Arquivos públicos (frontend)
│   ├── index.html            # Página principal
│   ├── login.html            # Página de login admin
│   ├── details.html          # Detalhes de produtos
│   ├── visa.html             # Página Visa
│   ├── sobre.html            # Sobre nós
│   ├── termos.html           # Termos e condições
│   ├── privacidade.html      # Política de privacidade
│   ├── assets/               # Imagens, ícones, etc.
│   ├── components/           # Componentes HTML reutilizáveis
│   │   └── _footer.html     # Componente de rodapé
│   ├── css/                  # Estilos
│   │   ├── input.css        # Tailwind input
│   │   └── output.css       # Tailwind compilado
│   ├── js/                   # Scripts JavaScript
│   │   ├── components.js    # Carregador de componentes
│   │   └── details.js       # Lógica de detalhes
│   ├── exchange_rates.json  # Cache de taxas de câmbio
│   ├── manifest.json        # PWA manifest
│   ├── sw.js                # Service Worker
│   └── robots.txt           # SEO
│
├── private/                  # Arquivos privados (admin)
│   ├── admin.html           # Painel administrativo
│   └── adminApi.js          # API calls do admin
│
├── src/                      # Código-fonte do servidor
│   ├── config/              # Configurações
│   │   ├── env.js          # Variáveis de ambiente
│   │   └── supabase.js     # Cliente Supabase
│   ├── controllers/         # Controladores
│   │   ├── adminController.js
│   │   ├── authController.js
│   │   ├── publicController.js
│   │   └── viewController.js
│   ├── middleware/          # Middlewares
│   │   ├── auth.js         # Autenticação
│   │   ├── subdomain.js    # Roteamento de subdomínios
│   │   ├── security.js     # Segurança
│   │   └── upload.js       # Upload de arquivos
│   ├── routes/              # Rotas
│   │   ├── adminRoutes.js
│   │   ├── authRoutes.js
│   │   ├── publicRoutes.js
│   │   └── viewRoutes.js
│   ├── utils/               # Utilitários
│   │   ├── errorHandler.js
│   │   └── storage.js
│   └── websocket.js         # Lógica WebSocket
│
├── webscraper/               # Web scraping
│   ├── scheduler.js         # Agendador de scraping
│   ├── cron-scraping.js     # Script principal de scraping
│   ├── playwright-scraper.js
│   ├── puppeteer-scraper.js
│   └── crawlee-scraper.js
│
├── scripts/                  # Scripts utilitários
│   ├── generate-hash.js     # Gerar hash de senha
│   ├── hash-password.js     # Hash de senha admin
│   └── verify-password.js   # Verificar senha
│
├── docs/                     # Documentação
│   ├── INSTRUCOES_ACESSOS.md
│   ├── INSTRUCOES_SQL.md
│   └── SEO-RECOMENDACOES.md
│
├── certs/                    # Certificados SSL (local)
│   ├── cert.pem
│   └── key.pem
│
├── server.js                 # Servidor Express principal
├── package.json             # Dependências e scripts
├── tailwind.config.js       # Configuração Tailwind
├── Dockerfile               # Container Docker
├── .env                     # Variáveis de ambiente (não versionado)
├── .gitignore              # Arquivos ignorados pelo Git
└── README.md               # Este arquivo
```

---

## 🚀 Instalação

### Pré-requisitos

- Node.js >= 18.0.0
- npm ou yarn
- Conta Supabase (para base de dados)
- Git

### Passos

1. **Clone o repositório**
```bash
git clone https://github.com/paulokakoma/ecokambio.git
cd ecokambio
```

2. **Instale as dependências**
```bash
npm install
```

3. **Configure as variáveis de ambiente**
```bash
cp .env.example .env
# Edite o arquivo .env com suas credenciais
```

4. **Gere o hash da senha de administrador**
```bash
node scripts/hash-password.js
```

5. **Compile o CSS do Tailwind**
```bash
npm run build:prod
```

---

## ⚙️ Configuração

### Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto:

```env
# Servidor
PORT=3000
NODE_ENV=production

# Supabase
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_KEY=sua-service-key
SUPABASE_ANON_KEY=sua-anon-key

# Autenticação Admin
ADMIN_PASSWORD_HASH=hash-gerado-pelo-script
SESSION_SECRET=um-segredo-aleatorio-muito-longo

# Cookies (Produção)
COOKIE_DOMAIN=.ecokambio.com

# Admin (Opcional)
ADMIN_SECRET_PATH=/admin
```

### Configuração de Subdomínios

#### Desenvolvimento Local

Os navegadores modernos suportam `admin.localhost` automaticamente:

- 📱 **Página Principal**: `http://localhost:3000`
- 🔐 **Admin**: `http://admin.localhost:3000`

#### Produção

Configure os registos DNS:

- **Domínio Principal**: A record para `ecokambio.com`
- **Subdomínio Admin**: A/CNAME record para `admin.ecokambio.com`

---

## 💻 Uso

### Desenvolvimento

```bash
npm run dev
```

Acesse:
- http://localhost:3000 - Página pública
- http://admin.localhost:3000 - Admin

### Produção

```bash
npm start
```

### Docker

```bash
# Build da imagem
docker build -t ecokambio .

# Executar container
docker run -p 3000:3000 --env-file .env ecokambio
```

---

## 📜 Scripts Disponíveis

| Script | Descrição |
|--------|-----------|
| `npm start` | Inicia o servidor em produção |
| `npm run dev` | Inicia servidor em desenvolvimento com hot-reload |
| `npm run build:css` | Compila Tailwind CSS em modo watch |
| `npm run build:prod` | Compila Tailwind CSS minificado para produção |
| `npm run scrape` | Executa web scraping manualmente |
| `npm run scrape:puppeteer` | Executa scraping com Puppeteer |
| `npm run scrape:all` | Executa todos os scrapers |

---

## 🌐 Deployment

### Render

1. Conecte o repositório GitHub ao Render
2. Configure as variáveis de ambiente no painel do Render
3. Deploy automático a cada push para `main`
4. Render gerencia HTTPS e scaling automaticamente

### VPS (Ubuntu/Debian)

```bash
# Instalar Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Clone e configure
git clone https://github.com/paulokakoma/ecokambio.git
cd ecokambio
npm install
npm run build:prod

# PM2 para process management
npm install -g pm2
pm2 start server.js --name ecokambio
pm2 save
pm2 startup
```

---

## 🤝 Contribuição

Contribuições são bem-vindas! Para contribuir:

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/MinhaFeature`)
3. Commit suas mudanças (`git commit -m 'Adiciona MinhaFeature'`)
4. Push para a branch (`git push origin feature/MinhaFeature`)
5. Abra um Pull Request

---

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

---

## 👥 Contato

**Moko Tech, Sociedade por Quotas**

- Website: [https://ecokambio.com](https://ecokambio.com)
- GitHub: [@paulokakoma](https://github.com/paulokakoma)

---

## 🙏 Agradecimentos

- [Supabase](https://supabase.com) - Base de dados e autenticação
- [Tailwind CSS](https://tailwindcss.com) - Framework CSS
- [Playwright](https://playwright.dev) - Web automation
- Comunidade open source

---

<div align="center">

**Desenvolvido com ❤️ em Angola**

</div>
