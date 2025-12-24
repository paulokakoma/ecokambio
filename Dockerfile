# ============================================
# Multi-stage Build otimizado para Fly.io
# ============================================

# ---- Estágio 1: Dependências ----
FROM node:20-alpine AS dependencies

WORKDIR /usr/src/app

# Instalar dependências do sistema necessárias para Playwright
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

COPY package*.json ./
RUN npm install --omit=dev

# ---- Estágio 2: Builder (para CSS e Playwright) ----
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

# Instalar dependências de build
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

COPY package*.json ./
RUN npm install

COPY . .

# Build CSS com Tailwind
RUN npm run build:prod

# Instalar Playwright (sem browsers, usaremos o Chromium do Alpine)
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN npm install playwright

# ---- Estágio 3: Produção Final ----
FROM node:20-alpine

ENV NODE_ENV=production

WORKDIR /usr/src/app

# Instalar dependências do sistema + Supercronic
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    wget \
    curl \
    && wget -q -O /usr/local/bin/supercronic \
    https://github.com/aptible/supercronic/releases/download/v0.2.29/supercronic-linux-amd64 \
    && chmod +x /usr/local/bin/supercronic

# Copiar dependências de produção
COPY --from=dependencies /usr/src/app/node_modules ./node_modules

# Copiar código da aplicação PRIMEIRO
COPY . .

# Copiar CSS compilado POR CIMA (garantir que sobrescreve versão antiga)
COPY --from=builder /usr/src/app/public/css/output.css ./public/css/output.css

# Tornar docker-entrypoint.sh executável
RUN chmod +x /usr/src/app/docker-entrypoint.sh

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

EXPOSE 3000

# Usar entrypoint script para iniciar app + cron
CMD ["/usr/src/app/docker-entrypoint.sh"]