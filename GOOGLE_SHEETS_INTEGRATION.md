# 📊 Integração Google Sheets - EcoFlix Sales Dashboard

## 🎯 Visão Geral

Este sistema permite que influenciadores vejam suas vendas do EcoFlix em tempo quase real através de um dashboard no Google Looker Studio, alimentado automaticamente pelo Google Sheets.

## 🔐 Como Funciona a Segurança

1. **Token de Autenticação**: Um token secreto (`SHEETS_SYNC_TOKEN`) foi criado e armazenado no `.env`
2. **Endpoint Protegido**: A API só retorna dados se o token correto for fornecido
3. **Sem Login Manual**: O Google Sheets usa o token na URL para autenticação automática

---

## 📋 Passo a Passo - Configuração

### 1️⃣ Criar a Planilha no Google Sheets

1. Acesse [Google Sheets](https://sheets.google.com)
2. Crie uma nova planilha chamada **"EcoFlix - Relatório de Vendas"**
3. Limpe todos os dados da **Aba 1** (renomeie para "Dados")

### 2️⃣ Adicionar a Fórmula IMPORTDATA

Na célula **A1**, cole a seguinte fórmula:

```excel
=IMPORTDATA("https://ecokambio.com/api/admin/export-sales-auto?token=eco_live_8823_secure_hash_x99_ecoflix_2026")
```

> ⚠️ **IMPORTANTE**: 
> - Substitua `ecokambio.com` pelo seu domínio real em produção
> - Em desenvolvimento local, use: `http://localhost:3000/api/admin/export-sales-auto?token=eco_live_8823_secure_hash_x99_ecoflix_2026`

### 3️⃣ Verificar os Dados

Após alguns segundos, a planilha deve ser preenchida automaticamente com:

| data_venda | cliente_telefone | plano | valor | cupom | status |
|------------|------------------|-------|-------|--------|---------|
| 2026-01-09 | +244912345678    | MOBILE| 2500  | INF001 | ACTIVE  |
| 2026-01-08 | +244923456789    | TV    | 3500  | INF002 | ACTIVE  |

### 4️⃣ Configurar Atualização Automática

O Google Sheets atualiza automaticamente a fórmula `IMPORTDATA` aproximadamente **a cada 1 hora**.

Para forçar uma atualização manual:
1. Clique em **Dados** → **Recarregar dados**
2. Ou simplesmente edite a fórmula (adicione um espaço e delete) e pressione Enter

---

## 🎨 Criar Dashboard no Looker Studio (Opcional)

### 1. Conectar o Looker Studio

1. Acesse [Looker Studio](https://lookerstudio.google.com)
2. Clique em **Criar** → **Fonte de dados**
3. Selecione **Google Sheets**
4. Escolha a planilha **"EcoFlix - Relatório de Vendas"**
5. Conecte

### 2. Criar Relatórios

Agora você pode criar gráficos e tabelas:
- **Vendas por Dia**: Gráfico de linhas com `data_venda` no eixo X
- **Vendas por Plano**: Gráfico de pizza com `plano`
- **Total de Vendas**: Scorecard com `SUM(valor)`
- **Vendas por Cupom**: Tabela com `cupom` e `COUNT(*)`

---

## 🔒 Segurança e Boas Práticas

### ⚠️ Cuidados Importantes

1. **Não Compartilhe o Link Publicamente**: 
   - Qualquer pessoa com o link + token pode baixar as suas vendas
   - Compartilhe APENAS a planilha com a equipa de confiança

2. **Proteção da Planilha**:
   - Configure as permissões do Google Sheets para **"Apenas visualização"**
   - Limita o acesso apenas aos membros da equipa

3. **Delay de Atualização**:
   - O `IMPORTDATA` atualiza a cada ~1 hora (limite do Google)
   - Não é tempo real, mas suficiente para influenciadores

4. **Formatação de Data**:
   - Se o Google Sheets não reconhecer as datas, selecione a coluna A
   - Vá em **Formatar** → **Número** → **Data**

---

## 🧪 Testar a Integração

### Teste Local (Development)

```bash
# 1. Certifique-se de que o servidor está a correr
npm run dev

# 2. Teste a rota no navegador
http://localhost:3000/api/admin/export-sales-auto?token=eco_live_8823_secure_hash_x99_ecoflix_2026

# ✅ Deve retornar CSV com dados das vendas
# ❌ Se token estiver errado: "Acesso Negado: Token inválido."
```

### Teste em Produção

```bash
curl "https://ecokambio.com/api/admin/export-sales-auto?token=eco_live_8823_secure_hash_x99_ecoflix_2026"
```

Resposta esperada (CSV):
```csv
data_venda,cliente_telefone,plano,valor,cupom,status
2026-01-09,+244912345678,MOBILE,2500,INF001,ACTIVE
2026-01-08,+244923456789,TV,3500,INF002,ACTIVE
```

---

## 🔧 Troubleshooting

### Problema: "Acesso Negado: Token inválido"

**Solução**: 
- Verifique se o token no `.env` é exatamente o mesmo usado na URL
- Reinicie o servidor Node.js após alterar o `.env`

### Problema: Google Sheets retorna erro

**Possíveis causas**:
1. **CORS**: A API não permite requests do Google Sheets
   - ✅ **Solução**: A rota retorna `text/csv`, compatível com IMPORTDATA
   
2. **URL incorreta**: Verifique se o domínio está correto

3. **Servidor offline**: Verifique se a API está online

### Problema: Dados não atualizam

- O Google Sheets tem cache de ~1 hora
- Para forçar atualização: **Dados** → **Recarregar dados**

---

## 📊 Estrutura dos Dados Exportados

A view `view_relatorio_influenciadores` retorna:

| Campo              | Tipo   | Descrição                          |
|--------------------|--------|------------------------------------|
| data_venda         | Date   | Data da compra da subscrição       |
| cliente_telefone   | String | Telefone do cliente (formato: +244...) |
| plano              | String | Tipo de plano (MOBILE, TV)         |
| valor              | Number | Valor pago pela subscrição (AOA)   |
| cupom              | String | Código do cupom usado (se houver)  |
| status             | String | Status da subscrição (ACTIVE, EXPIRED) |

---

## 🚀 Próximos Passos

1. ✅ Configurar o Google Sheets com a fórmula `IMPORTDATA`
2. ✅ Verificar se os dados aparecem corretamente
3. ✅ Criar dashboard no Looker Studio (opcional)
4. ✅ Compartilhar o dashboard com influenciadores
5. ✅ Monitorizar os logs do servidor para verificar sincronizações

---

## 📝 Notas Técnicas

### Token de Segurança
```bash
# .env
SHEETS_SYNC_TOKEN=eco_live_8823_secure_hash_x99_ecoflix_2026
```

### Endpoint
```
GET /api/admin/export-sales-auto?token={SHEETS_SYNC_TOKEN}
```

### Response Format
```
Content-Type: text/csv; charset=utf-8
Content-Disposition: attachment; filename="ecoflix_vendas.csv"
```

### Logs
```bash
# Sucesso
[SHEETS SYNC] Exportadas 150 vendas para Google Sheets

# Erro de autenticação
[SECURITY] Tentativa de acesso não autorizada ao export de vendas

# Erro no servidor
[SHEETS SYNC ERROR] { error details }
```

---

## ✅ Checklist de Implementação

- [x] Token configurado no `.env`
- [x] Rota `/api/admin/export-sales-auto` criada
- [x] Função `exportSalesAuto` implementada
- [x] View `view_relatorio_influenciadores` criada no banco de dados
- [ ] Testar endpoint localmente
- [ ] Configurar Google Sheets com fórmula IMPORTDATA
- [ ] Testar em produção
- [ ] Criar dashboard no Looker Studio
- [ ] Compartilhar com influenciadores

---

**Pronto para usar! 🎉**

Se tiveres alguma dúvida ou problema, verifica os logs do servidor ou testa a rota diretamente no navegador.
