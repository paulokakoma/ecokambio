# EcoKambio API v1 Documentation

API REST pública para consulta de taxas de câmbio em Angola.

## Base URL

```
https://ecokambio.com/api/v1
```

**Desenvolvimento:**
```
http://localhost:3000/api/v1

## Autenticação (JWT)

Esta API utiliza **JSON Web Tokens (JWT)** para autenticação. 
Para acessar os endpoints protegidos (como `/conversion`), você deve primeiro obter um token de acesso.

**Fluxo:**
1. Envie uma requisição POST para `/auth/login` com suas credenciais.
2. Receba o `access_token` na resposta.
3. Inclua o token no header `Authorization` de todas as requisições subsequentes:
   `Authorization: Bearer <seu_token>`

**Ambiente de Teste:**
- **Email:** `demo@example.com`
- **Senha:** `demo`

---

## Formato de Resposta

Todas as respostas seguem um formato padronizado:

### Sucesso
```json
{
  "success": true,
  "data": { /* dados solicitados */ },
  "meta": {
    "timestamp": "2025-12-07T12:30:00Z",
    "version": "1.0.0"
  }
}
```

### Erro
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Mensagem descritiva do erro",
    "details": {}
  },
  "meta": {
    "timestamp": "2025-12-07T12:30:00Z",
    "version": "1.0.0"
  }
}
```

## Rate Limiting

- **Leitura (GET)**: 100 requisições / 15 minutos
- **Conversão (POST)**: 60 requisições / 15 minutos

Headers de rate limit incluídos em cada resposta:
- `RateLimit-Limit`: Limite total
- `RateLimit-Remaining`: Requisições restantes
- `RateLimit-Reset`: Timestamp de reset

## Endpoints

### 1. Autenticação (Login)

**POST** `/api/v1/auth/login`

Obtém um token JWT para acesso aos endpoints protegidos.

**Request Body:**
```json
{
  "email": "demo@example.com",
  "password": "demo"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

---

### 2. Informações da API

**GET** `/api/v1`

Retorna informações sobre a API e seus endpoints disponíveis.

**Response:**
```json
{
  "success": true,
  "data": {
    "name": "EcoKambio API",
    "version": "1.0.0",
    "description": "API pública para consulta de taxas de câmbio em Angola",
    "endpoints": { /* lista de endpoints */ }
  }
}
```

---

### 2. Status da API

**GET** `/api/v1/status`

Verifica o status e saúde da API.

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "service": "EcoKambio API",
    "version": "1.0.0",
    "uptime": 12345.67,
    "environment": "production"
  }
}
```

---

### 3. Todas as Taxas

**GET** `/api/v1/rates`

Retorna todas as taxas de câmbio atuais (mercado formal e informal).

**Response:**
```json
{
  "success": true,
  "data": {
    "formal": [
      {
        "provider_name": "BAI",
        "currency_pair": "USD/AOA",
        "buy_rate": 880.50,
        "sell_rate": 885.00,
        "updated_at": "2025-12-07T12:00:00Z"
      }
    ],
    "informal": {
      "USD": 890.00,
      "EUR": 975.00,
      "USDT": 888.00
    },
    "lastUpdated": "2025-12-07T12:00:00Z"
  }
}
```

---

### 4. Taxas por Moeda

**GET** `/api/v1/rates/:currency`

Retorna taxas de uma moeda específica.

**Parâmetros:**
- `currency` (path): USD, EUR ou USDT

**Exemplo:**
```
GET /api/v1/rates/USD
```

**Response:**
```json
{
  "success": true,
  "data": {
    "currency": "USD",
    "formal": [ /* taxas de bancos */ ],
    "informal": 890.00
  }
}
```

---

### 5. Taxas do Mercado Informal

**GET** `/api/v1/rates/informal`

Retorna apenas as taxas do mercado informal (kinguilas).

**Response:**
```json
{
  "success": true,
  "data": {
    "USD": 890.00,
    "EUR": 975.00,
    "USDT": 888.00
  }
}
```

---

### 6. Taxas do Mercado Formal

**GET** `/api/v1/rates/formal`

Retorna taxas de todos os bancos, agrupadas por moeda.

**Response:**
```json
{
  "success": true,
  "data": {
    "USD": [ /* taxas USD de todos os bancos */ ],
    "EUR": [ /* taxas EUR de todos os bancos */ ],
    "USDT": [ /* taxas USDT de todos os bancos */ ]
  }
}
```

---

### 7. Histórico de Taxas

**GET** `/api/v1/rates/history`

Retorna histórico de taxas dos últimos 30 dias (padrão).

**Query Parameters:**
- `currency` (opcional): USD, EUR ou USDT (padrão: USD)
- `days` (opcional): Número de dias (padrão: 30, máximo: 90)

**Exemplo:**
```
GET /api/v1/rates/history?currency=EUR&days=7
```

**Response:**
```json
{
  "success": true,
  "data": {
    "currency": "EUR",
    "period": {
      "from": "2025-12-01T00:00:00Z",
      "to": "2025-12-07T12:00:00Z",
      "days": 7
    },
    "data": [
      {
        "currency_pair": "EUR/AOA",
        "buy_rate": 970.00,
        "sell_rate": 975.00,
        "updated_at": "2025-12-01T10:00:00Z",
        "providers": { "name": "BAI" }
      }
    ]
  }
}
```

---

### 8. Conversão de Moeda

**POST** `/api/v1/conversion`

Converte um valor entre moedas usando taxas atuais.

**Request Body:**
```json
{
  "from": "USD",
  "to": "AOA",
  "amount": 100,
  "market": "informal"
}
```

**Parâmetros:**
- `from` (obrigatório): Moeda de origem (USD, EUR, USDT, AOA)
- `to` (obrigatório): Moeda de destino (USD, EUR, USDT, AOA)
- `amount` (obrigatório): Valor a converter (número > 0)
- `market` (opcional): "informal" ou "formal" (padrão: "informal")

**Response:**
```json
{
  "success": true,
  "data": {
    "from": "USD",
    "to": "AOA",
    "amount": 100,
    "converted": 89000.00,
    "rate": 890.00,
    "market": "informal",
    "source": "Mercado Informal (Média)",
    "timestamp": "2025-12-07T12:30:00Z"
  }
}
```

**Erros Possíveis:**
- `400`: Parâmetros inválidos ou faltando
- `404`: Taxa não encontrada
- `503`: Taxa não disponível no momento

---

## Códigos de Erro

| Código | Descrição |
|--------|-----------|
| `MISSING_PARAMETERS` | Parâmetros obrigatórios faltando |
| `INVALID_CURRENCY` | Moeda não suportada |
| `INVALID_AMOUNT` | Valor inválido |
| `INVALID_MARKET` | Mercado inválido (use informal ou formal) |
| `RATE_NOT_FOUND` | Taxa de câmbio não encontrada |
| `RATE_NOT_AVAILABLE` | Taxa não disponível no momento |
| `RATE_LIMIT_EXCEEDED` | Limite de requisições excedido |
| `CONVERSION_ERROR` | Erro ao processar conversão |

## Exemplos de Uso

### cURL

```bash
# 1. Login para obter token
TOKEN=$(curl -X POST https://ecokambio.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@example.com","password":"demo"}' \
  | grep -o '"access_token":"[^"]*' | grep -o '[^"]*$')

# 2. Usar token na conversão
curl -X POST https://ecokambio.com/api/v1/conversion \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"from":"USD","to":"AOA","amount":50,"market":"informal"}'
```

### JavaScript (Fetch)

```javascript
// 1. Login
const loginResp = await fetch('https://ecokambio.com/api/v1/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'demo@example.com', password: 'demo' })
});
const { data: { access_token } } = await loginResp.json();

// 2. Acesso Autenticado
const convResp = await fetch('https://ecokambio.com/api/v1/conversion', {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${access_token}` 
  },
  body: JSON.stringify({ from: 'USD', to: 'AOA', amount: 100 })
});
const result = await convResp.json();
console.log(result.data.converted);
```

### Python

```python
import requests

BASE_URL = 'https://ecokambio.com/api/v1'

# 1. Login
auth_response = requests.post(f'{BASE_URL}/auth/login', json={
    'email': 'demo@example.com',
    'password': 'demo'
})
token = auth_response.json()['data']['access_token']

# 2. Requisicão com Token
headers = {
    'Authorization': f'Bearer {token}',
    'Content-Type': 'application/json'
}
payload = {"from": "USD", "to": "AOA", "amount": 100}
response = requests.post(f'{BASE_URL}/conversion', json=payload, headers=headers)

print(response.json())
```

## Compatibilidade com Versões Antigas

As seguintes rotas antigas continuam funcionando para compatibilidade:

- `/api/informal-rates` → `/api/v1/rates/informal`
- `/api/config` → Mantida como está
- `/api/visa-settings` → Mantida como está

## Suporte

Para dúvidas ou problemas com a API:
- **Website**: https://ecokambio.com
- **Email**: suporte@ecokambio.com
- **WhatsApp**: +244 938 948 994

---

**Versão da API**: 1.0.0  
**Última Atualização**: 7 de Dezembro de 2025
