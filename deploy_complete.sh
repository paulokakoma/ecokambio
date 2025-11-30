#!/bin/bash

echo "======================================"
echo "CONFIGURAÇÃO COMPLETA DO SERVIDOR VPS"
echo "======================================"
echo ""

# Cores
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}PASSO 1: Configuração básica (Node, PM2, Nginx, Certbot)${NC}"
echo "Já foi executado! ✅"
echo ""

echo -e "${BLUE}PASSO 2: Upload do projeto${NC}"
chmod +x upload_project.exp
./upload_project.exp
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Upload concluído${NC}"
else
    echo "❌ Erro no upload"
    exit 1
fi
echo ""

echo -e "${BLUE}PASSO 3: Configurar aplicação (npm install + PM2)${NC}"
chmod +x configure_app.exp
./configure_app.exp
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Aplicação configurada${NC}"
else
    echo "❌ Erro na configuração"
    exit 1
fi
echo ""

echo -e "${BLUE}PASSO 4: Configurar Nginx${NC}"
chmod +x configure_nginx.exp
./configure_nginx.exp
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Nginx configurado${NC}"
else
    echo "❌ Erro no Nginx"
    exit 1
fi
echo ""

echo -e "${BLUE}PASSO 5: Instalar SSL${NC}"
echo "ATENÇÃO: Você precisa editar o arquivo install_ssl.exp"
echo "e colocar seu email antes de executar."
read -p "Deseja instalar SSL agora? (s/n): " install_ssl

if [ "$install_ssl" = "s" ] || [ "$install_ssl" = "S" ]; then
    chmod +x install_ssl.exp
    ./install_ssl.exp
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ SSL instalado${NC}"
    else
        echo "❌ Erro no SSL"
    fi
else
    echo "Execute posteriormente: ./install_ssl.exp"
fi

echo ""
echo "======================================"
echo -e "${GREEN}CONFIGURAÇÃO CONCLUÍDA!${NC}"
echo "======================================"
echo ""
echo "Acesse seu site:"
echo "- http://ecokambio.com"
echo "- https://ecokambio.com (se instalou SSL)"
echo ""
