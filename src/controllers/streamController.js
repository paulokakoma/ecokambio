const clients = new Map();

const addClient = (req, res, group, subGroup = null) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    // Flush headers to establish connection
    res.flushHeaders();

    const clientObj = { res, req };

    if (group === 'admin') {
        if (!clients.has('admin')) clients.set('admin', new Set());
        clients.get('admin').add(clientObj);
    } else if (group === 'order') {
        if (!clients.has('order')) clients.set('order', new Map());
        const orderMap = clients.get('order');
        if (!orderMap.has(subGroup)) orderMap.set(subGroup, new Set());
        orderMap.get(subGroup).add(clientObj);
    } else {
        if (!clients.has('public')) clients.set('public', new Set());
        clients.get('public').add(clientObj);
    }

    req.on('close', () => {
        if (group === 'admin') {
            clients.get('admin').delete(clientObj);
        } else if (group === 'order') {
            const orderMap = clients.get('order');
            if (orderMap.has(subGroup)) {
                orderMap.get(subGroup).delete(clientObj);
                if (orderMap.get(subGroup).size === 0) {
                    orderMap.delete(subGroup);
                }
            }
        } else {
            clients.get('public').delete(clientObj);
        }
    });
};

const sendEvent = (res, data, eventName = 'message') => {
    res.write(`event: ${eventName}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
};

const broadcast = (data, target = 'all') => {
    if (target === 'all' || target === 'public') {
        if (clients.has('public')) {
            clients.get('public').forEach(c => sendEvent(c.res, data));
        }
    }
    if (target === 'all' || target === 'admin') {
        if (clients.has('admin')) {
            clients.get('admin').forEach(c => sendEvent(c.res, data));
        }
    }
};

const broadcastToOrder = (orderId, data) => {
    if (clients.has('order')) {
        const orderMap = clients.get('order');
        if (orderMap.has(String(orderId))) {
            orderMap.get(String(orderId)).forEach(c => sendEvent(c.res, data));
        }
    }
};

const getOnlineUserCount = () => {
    return clients.has('public') ? clients.get('public').size : 0;
};

// Handlers for Express routes
const streamPublic = (req, res) => {
    addClient(req, res, 'public');
};

const streamAdmin = (req, res) => {
    addClient(req, res, 'admin');
};

const streamOrder = (req, res) => {
    const { orderId } = req.params;
    if (!orderId) return res.status(400).send('Order ID required');
    addClient(req, res, 'order', orderId);
};

module.exports = {
    streamPublic,
    streamAdmin,
    streamOrder,
    broadcast,
    broadcastToOrder,
    getOnlineUserCount
};
