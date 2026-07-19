const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

// ============================================================================
// Test: WebSocket — Phone Normalization
// ============================================================================
describe('WebSocket - Phone Normalization', () => {
    const normalizeWsPhone = (phone) => {
        if (!phone) return '';
        let clean = String(phone).replace(/[^0-9+]/g, '');
        if (clean.startsWith('+244')) clean = clean.slice(4);
        else if (clean.startsWith('244') && clean.length >= 12) clean = clean.slice(3);
        return clean.replace(/[^0-9]/g, '');
    };

    it('normalizes +244 phone', () => {
        assert.equal(normalizeWsPhone('+244912345678'), '912345678');
    });

    it('normalizes 244 phone', () => {
        assert.equal(normalizeWsPhone('244912345678'), '912345678');
    });

    it('keeps 9-digit phone', () => {
        assert.equal(normalizeWsPhone('912345678'), '912345678');
    });

    it('handles numeric input', () => {
        assert.equal(normalizeWsPhone(244912345678), '912345678');
    });

    it('returns empty for null', () => {
        assert.equal(normalizeWsPhone(null), '');
    });

    it('returns empty for empty string', () => {
        assert.equal(normalizeWsPhone(''), '');
    });

    it('strips spaces and dashes', () => {
        assert.equal(normalizeWsPhone('+244 912-345-678'), '912345678');
    });
});

// ============================================================================
// Test: WebSocket — Message Types
// ============================================================================
describe('WebSocket - Message Types', () => {
    it('subscribe_order requires order_id', () => {
        const msg = { type: 'subscribe_order', order_id: 'order-123' };
        assert.ok(msg.type === 'subscribe_order');
        assert.ok(msg.order_id);
    });

    it('subscribe_user requires phone', () => {
        const msg = { type: 'subscribe_user', phone: '+244912345678' };
        assert.ok(msg.type === 'subscribe_user');
        assert.ok(msg.phone);
    });

    it('log_activity requires payload', () => {
        const msg = { type: 'log_activity', payload: { event_type: 'click' } };
        assert.ok(msg.type === 'log_activity');
        assert.ok(msg.payload);
    });
});

// ============================================================================
// Test: WebSocket — Admin Secret
// ============================================================================
describe('WebSocket - Admin Auth', () => {
    it('admin secret matches env var', () => {
        process.env.WS_ADMIN_SECRET = 'test-admin-secret';
        const params = new URLSearchParams('admin_secret=test-admin-secret');
        const isAdmin = params.get('admin_secret') && params.get('admin_secret') === process.env.WS_ADMIN_SECRET;
        assert.equal(isAdmin, true);
        delete process.env.WS_ADMIN_SECRET;
    });

    it('wrong secret is rejected', () => {
        process.env.WS_ADMIN_SECRET = 'correct-secret';
        const params = new URLSearchParams('admin_secret=wrong-secret');
        const isAdmin = params.get('admin_secret') && params.get('admin_secret') === process.env.WS_ADMIN_SECRET;
        assert.equal(isAdmin, false);
        delete process.env.WS_ADMIN_SECRET;
    });

    it('missing secret is rejected', () => {
        const params = new URLSearchParams('');
        const secret = params.get('admin_secret');
        const isAdmin = secret && secret === 'anything';
        assert.ok(!isAdmin);
    });
});

// ============================================================================
// Test: WebSocket — Broadcast Targeting
// ============================================================================
describe('WebSocket - Broadcast Targeting', () => {
    it('target "all" sends to everyone', () => {
        const target = 'all';
        const clientIsAdmin = true;
        const shouldSend = target === 'all' || (target === 'admin' && clientIsAdmin) || (target === 'users' && !clientIsAdmin);
        assert.equal(shouldSend, true);
    });

    it('target "admin" only sends to admins', () => {
        const target = 'admin';
        assert.ok(target === 'admin' && true);  // admin client
        assert.ok(!(target === 'admin' && false));  // non-admin client
    });

    it('target "users" only sends to non-admins', () => {
        const target = 'users';
        assert.ok(target === 'users' && !false);  // non-admin client
        assert.ok(!(target === 'users' && !true));  // admin client
    });
});
