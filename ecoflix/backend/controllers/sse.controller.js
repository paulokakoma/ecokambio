/**
 * SSE Controller — Server-Sent Events para o painel admin EcoFlix
 * Mantém um Set de clientes ligados e faz broadcast de eventos em tempo real.
 */

const clients = new Set();

// Heartbeat a cada 25s para manter a conexão viva (proxies cortam após 30s de silêncio)
const HEARTBEAT_INTERVAL_MS = 25_000;

/**
 * Endpoint SSE: GET /admin/events
 * O browser conecta uma vez e fica à escuta. Reconecta automaticamente se cair.
 */
const sseConnect = (req, res) => {
    res.set({
        'Content-Type':  'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection':    'keep-alive',
        'X-Accel-Buffering': 'no', // Desactivar buffering no Nginx/proxy
    });
    res.flushHeaders();

    // Enviar evento de conexão inicial
    res.write('event: connected\ndata: {"ok":true}\n\n');

    clients.add(res);

    // Heartbeat para manter a ligação viva
    const heartbeat = setInterval(() => {
        res.write(': heartbeat\n\n');
    }, HEARTBEAT_INTERVAL_MS);

    // Limpar quando o cliente desliga
    req.on('close', () => {
        clearInterval(heartbeat);
        clients.delete(res);
    });
};

/**
 * Envia um evento SSE para todos os admins ligados.
 * @param {string} event - Nome do evento (ex: 'new_order', 'order_paid')
 * @param {object} data  - Payload JSON
 */
const broadcast = (event, data) => {
    if (clients.size === 0) return;
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of clients) {
        try {
            client.write(payload);
        } catch {
            clients.delete(client);
        }
    }
    console.log(`[SSE] broadcast "${event}" → ${clients.size} cliente(s)`);
};

module.exports = { sseConnect, broadcast };
