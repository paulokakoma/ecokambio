const { WebSocketServer } = require("ws");
const supabase = require("./config/supabase");

let wss;

// Normalize phone to 9-digit local format for consistent matching
const normalizeWsPhone = (phone) => {
    if (!phone) return '';
    let clean = String(phone).replace(/[^0-9+]/g, '');
    if (clean.startsWith('+244')) clean = clean.slice(4);
    else if (clean.startsWith('244') && clean.length >= 12) clean = clean.slice(3);
    return clean.replace(/[^0-9]/g, '');
};

const init = (server) => {
    wss = new WebSocketServer({ server });

    wss.on('error', (error) => {
        console.error('Erro no WebSocketServer (handshake ou geral):', error);
    });

    wss.on("connection", (ws, req) => {
        const params = new URLSearchParams(req.url.slice(1));
        const adminSecret = params.get('admin_secret');
        ws.isAdmin = adminSecret && adminSecret === process.env.WS_ADMIN_SECRET;
        ws.subscribedOrderId = null; // New: tracking order subscriptions
        console.log(`Cliente WebSocket conectado ${ws.isAdmin ? '(Admin)' : '(Usuário)'}.`);
        broadcastUserCount();

        ws.on('message', async (message) => {
            try {
                const data = JSON.parse(message);
                
                // Subscription for EcoFlix Payment Updates
                if (data.type === 'subscribe_order' && data.order_id) {
                    ws.subscribedOrderId = String(data.order_id);
                    console.log(`[WS] Client subscribed to order_id: ${ws.subscribedOrderId}`);
                    return;
                }

                // Subscription for EcoFlix User Updates (by phone)
                if (data.type === 'subscribe_user' && data.phone) {
                    ws.subscribedPhone = normalizeWsPhone(data.phone);
                    return;
                }

                if (data.type === 'log_activity' && data.payload) {
                    const activityPayload = {
                        ...data.payload,
                        created_at: new Date().toISOString()
                    };

                    // 1. Guarda a atividade na tabela de logs
                    const { error: insertError } = await supabase.from('user_activity').insert(activityPayload);
                    if (insertError) {
                        console.error('[WS] Erro ao inserir atividade na BD:', insertError);
                    }

                    // 2. Se for um clique de afiliado, incrementa o contador
                    if ((data.payload.event_type === 'affiliate_click' || data.payload.event_type === 'buy_now_click') && data.payload.details?.link_id) {
                        const linkId = parseInt(data.payload.details.link_id, 10);
                        const { error: rpcError } = await supabase.rpc('increment_affiliate_click', { link_id_to_inc: linkId });
                        if (rpcError) {
                            console.error(`[SERVER] ❌ ERRO ao incrementar contador de cliques para o link ID ${linkId}:`, rpcError);
                        }
                    }

                    // 3. Notifica os administradores em tempo real
                    broadcast({ type: 'new_user_activity', payload: activityPayload }, 'admin');
                }
            } catch (error) {
                console.error('Erro ao processar mensagem WebSocket:', error);
            }
        });

        ws.on("close", () => {
            console.log(`Cliente WebSocket desconectado ${ws.isAdmin ? '(Admin)' : '(Usuário)'}.`);
            broadcastUserCount();
        });
        ws.on("error", (error) => console.error('Erro no WebSocket:', error));
    });
};

const broadcast = (data, target = 'all') => {
    if (!wss) return;
    const jsonData = JSON.stringify(data);
    wss.clients.forEach((client) => {
        if (client.readyState === client.OPEN) {
            if (target === 'all' || (target === 'admin' && client.isAdmin) || (target === 'users' && !client.isAdmin)) {
                client.send(jsonData);
            }
        }
    });
};

const broadcastToOrder = (orderId, data) => {
    if (!wss || !orderId) return;
    const jsonData = JSON.stringify(data);
    const targetId = String(orderId);
    wss.clients.forEach((client) => {
        if (client.readyState === client.OPEN && client.subscribedOrderId === targetId) {
            client.send(jsonData);
        }
    });
};

const broadcastToPhone = (phone, data) => {
    if (!wss || !phone) return;
    const jsonData = JSON.stringify(data);
    const targetPhone = normalizeWsPhone(phone);
    wss.clients.forEach((client) => {
        if (client.readyState === client.OPEN && client.subscribedPhone === targetPhone) {
            client.send(jsonData);
        }
    });
};

const broadcastUserCount = () => {
    if (!wss) return;
    const userCount = Array.from(wss.clients).filter(c => !c.isAdmin).length;
    broadcast({ type: 'user_count_update', count: userCount }, 'admin');
};

const getOnlineUserCount = () => {
    if (!wss) return 0;
    return Array.from(wss.clients).filter(c => !c.isAdmin).length;
};

module.exports = { init, broadcast, broadcastToOrder, broadcastToPhone, getOnlineUserCount };
