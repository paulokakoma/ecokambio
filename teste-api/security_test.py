import requests
import json

# CONFIGURAÇÃO
BASE_URL = "http://localhost:3000/api/v1"

# Login to obtain JWT token
login_resp = requests.post(f"{BASE_URL}/auth/login", json={"email": "demo@example.com", "password": "demo"})
if login_resp.status_code != 200:
    raise Exception("Login failed")
access_token = login_resp.json()["data"]["access_token"]

# Headers for conversion requests
headers = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {access_token}"
}

def executar_teste(nome_teste, payload, esperado):
    print(f"🔹 Executando: {nome_teste}")
    try:
        response = requests.post(f"{BASE_URL}/conversion", headers=headers, json=payload, timeout=5)
        
        # Análise básica do resultado
        status = response.status_code
        try:
            body = response.json()
        except:
            body = response.text[:100] # Se não for JSON, pega o começo do texto

        print(f"   Status Recebido: {status}")
        
        # Verifica se passou no teste de segurança
        # Se esperávamos um erro (ex: 400) e recebemos 200 (sucesso), é FALHA DE SEGURANÇA.
        if esperado == "erro" and status == 200:
            print(f"   ❌ VULNERABILIDADE: A API aceitou dados inválidos!")
            print(f"   Resposta: {body}")
        elif status == 500:
            print(f"   ⚠️ PERIGO: Erro Interno do Servidor (500).")
            print(f"   Isso pode vazar stack traces ou derrubar o serviço.")
        elif esperado == "sucesso" and status == 200:
            print(f"   ✅ OK: Funcionou como esperado.")
        elif esperado == "erro" and status in [400, 422]:
            print(f"   ✅ OK: A API bloqueou corretamente.")
        else:
            print(f"   ℹ️ Resultado Inesperado: {status}")
            
    except requests.exceptions.ConnectionError:
        print("   ❌ Erro de Conexão: O servidor está rodando?")
    except Exception as e:
        print(f"   ❌ Erro no script: {e}")
    
    print("-" * 40)

# LISTA DE CENÁRIOS DE ATAQUE
cenarios = [
    {
        "nome": "1. Teste de Sanidade (Dados Válidos)",
        "payload": {"from": "USD", "to": "AOA", "amount": 100, "market": "informal"},
        "esperado": "sucesso"
    },
    {
        "nome": "2. Valor Negativo (Lógica de Negócio)",
        "payload": {"from": "USD", "to": "AOA", "amount": -100, "market": "informal"},
        "esperado": "erro"
    },
    {
        "nome": "3. Valor Zero",
        "payload": {"from": "USD", "to": "AOA", "amount": 0, "market": "informal"},
        "esperado": "erro"
    },
    {
        "nome": "4. Injection de Tipo (String em vez de Número)",
        "payload": {"from": "USD", "to": "AOA", "amount": "CEM DOLARES", "market": "informal"},
        "esperado": "erro"
    },
    {
        "nome": "5. Moeda Inexistente (Validação)",
        "payload": {"from": "MARTE", "to": "AOA", "amount": 100, "market": "informal"},
        "esperado": "erro"
    },
    {
        "nome": "6. Payload Incompleto (Falta 'amount')",
        "payload": {"from": "USD", "to": "AOA", "market": "informal"},
        "esperado": "erro"
    },
    {
        "nome": "7. Overflow Numérico (Número Gigante)",
        "payload": {"from": "USD", "to": "AOA", "amount": 9999999999999999999999999, "market": "informal"},
        "esperado": "erro"
    },
    {
        "nome": "8. SQL Injection Simples (Tentativa nos campos)",
        "payload": {"from": "USD'; DROP TABLE users; --", "to": "AOA", "amount": 100},
        "esperado": "erro"
    }
]

# Executa todos os testes
print("🚀 INICIANDO BATERIA DE TESTES DE SEGURANÇA...\n")
for caso in cenarios:
    executar_teste(caso['nome'], caso['payload'], caso['esperado'])

print("\n✅ BATERIA DE TESTES CONCLUÍDA!")
print("Revise os resultados acima para identificar qualquer vulnerabilidade.")
