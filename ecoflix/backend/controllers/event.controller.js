const eventService = require('../services/event.service');

const pollAdminEvents = async (req, res) => {
    const since = req.query.since || 0;
    const events = await eventService.listForAdmin({ since });
    const latestId = events.reduce((max, event) => Math.max(max, Number(event.id) || 0), Number(since) || 0);

    res.json({
        success: true,
        events,
        latest_id: latestId
    });
};

const pollUserEvents = async (req, res) => {
    const since = req.query.since || 0;
    const phone = req.query.phone || req.user?.phone;

    if (!phone) {
        return res.status(400).json({ success: false, message: 'Telefone obrigatório' });
    }

    const events = await eventService.listForUser({ phone, since });
    const latestId = events.reduce((max, event) => Math.max(max, Number(event.id) || 0), Number(since) || 0);

    res.json({
        success: true,
        events,
        latest_id: latestId
    });
};

module.exports = {
    pollAdminEvents,
    pollUserEvents
};
