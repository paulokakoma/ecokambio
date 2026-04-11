const express = require('express');
const router = express.Router();
const { executarAgenteMock } = require('../ai/agent');

router.post('/chat', async (req, res) => {
  try {
    const { mensagem } = req.body;
    // Usa o IP ou um ID temporário já que o Redis pode estar off
    const sessionId = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'sessao_dev_1';

    const respostaAgente = await executarAgenteMock(mensagem, sessionId);

    res.json({ sucesso: true, resposta: respostaAgente });
  } catch (error) {
    console.error("Erro no Agente:", error);
    res.status(500).json({ sucesso: false, erro: "O assistente está indisponível no momento." });
  }
});

module.exports = router;