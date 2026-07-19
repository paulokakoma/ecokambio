/**
 * SSE Controller — Server-Sent Events para o painel admin EcoFlix
 * Mantém um Set de clientes ligados e faz broadcast de eventos em tempo real.
 */

const clients = new Set();
const clientIPs = new Map(); // ip → count

const HEARTBEAT_INTERVAL_MS = 25_000;
const MAX_CONNECTIONS_PER_IP = 3;

/**
 * Endpoint SSE: GET /admin/events
 */
const sseConnect = (req, res) => {
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    const currentCount = clientIPs.get(ip) || 0;

    if (currentCount >= MAX_CONNECTIONS_PER_IP) {
        return res.status(429).json({ success: false, message: 'Limite de conexões SSE atingido' });
    }

    res.set({
        'Content-Type':  'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection':    'keep-alive',
        'X-Accel-Buffering': 'no',
    });
    res.flushHeaders();

    res.write('event: connected\ndata: {"ok":true}\n\n');

    clientIPs.set(ip, currentCount + 1);
    clients.add(res);

    const heartbeat = setInterval(() => {
        try {
            res.write(': heartbeat\n\n');
        } catch {
            clearInterval(heartbeat);
            clients.delete(res);
            clientIPs.set(ip, Math.max(0, (clientIPs.get(ip) || 1) - 1));
        }
    }, HEARTBEAT_INTERVAL_MS);

    req.on('close', () => {
        clearInterval(heartbeat);
        clients.delete(res);
        clientIPs.set(ip, Math.max(0, (clientIPs.get(ip) || 1) - 1));
    });
};

/**
 * Envia um evento SSE para todos os admins ligados.
 */
const broadcast = (event, data) => {
    if (clients.size === 0) return;
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    let sent = 0;
    let cleaned = 0;
    for (const client of clients) {
        try {
            client.write(payload);
            sent++;
        } catch {
            clients.delete(client);
            cleaned++;
        }
    }
    if (cleaned > 0) {
        console.warn(`[SSE] ${cleaned} cliente(s) morto(s) removido(s) no broadcast "${event}"`);
    }
};

module.exports = { sseConnect, broadcast };
