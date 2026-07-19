const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('events');

// ============================================================================
// Test: SSE Controller
// ============================================================================
describe('SSE Controller', () => {
    let sseConnect, broadcast;
    let fakeReq, fakeRes;

    beforeEach(() => {
        // Clear module cache to get fresh state
        delete require.cache[require.resolve('../ecoflix/backend/controllers/sse.controller')];
        const sse = require('../ecoflix/backend/controllers/sse.controller');
        sseConnect = sse.sseConnect;
        broadcast = sse.broadcast;

        fakeReq = new EventEmitter();
        fakeReq.ip = '127.0.0.1';
        fakeReq.connection = { remoteAddress: '127.0.0.1' };

        fakeRes = {
            set: () => {},
            flushHeaders: () => {},
            write: () => {},
            status: () => fakeRes,
            json: () => {},
        };
    });

    it('broadcast does nothing when no clients connected', () => {
        // Should not throw
        broadcast('test_event', { hello: 'world' });
    });

    it('broadcast sends to connected clients', () => {
        const writes = [];
        fakeRes.write = (data) => writes.push(data);

        sseConnect(fakeReq, fakeRes);

        broadcast('test_event', { value: 42 });

        assert.ok(writes.some(w => w.includes('event: test_event')));
        assert.ok(writes.some(w => w.includes('"value":42')));
    });

    it('broadcast removes dead clients', () => {
        let writeCount = 0;
        fakeRes.write = (data) => {
            writeCount++;
            if (writeCount === 1) return; // first write (connected event) OK
            if (writeCount === 2) throw new Error('write failed'); // broadcast fails
        };

        sseConnect(fakeReq, fakeRes);

        // First broadcast succeeds (connected event)
        broadcast('event1', { a: 1 });

        // Second broadcast fails, client should be removed
        broadcast('event2', { b: 2 });

        // Third broadcast should find 0 clients (dead one removed)
        const writes2 = [];
        fakeRes.write = (data) => writes2.push(data);
        broadcast('event3', { c: 3 });

        assert.equal(writes2.filter(w => w.includes('event3')).length, 0);
    });

    it('cleans up on client disconnect', () => {
        sseConnect(fakeReq, fakeRes);
        fakeReq.emit('close');
        // Should not throw, client removed
        broadcast('test', { x: 1 });
    });
});

// ============================================================================
// Test: SSE Rate Limiting
// ============================================================================
describe('SSE Rate Limiting', () => {
    let sseConnect;

    beforeEach(() => {
        delete require.cache[require.resolve('../ecoflix/backend/controllers/sse.controller')];
        const sse = require('../ecoflix/backend/controllers/sse.controller');
        sseConnect = sse.sseConnect;
    });

    it('rejects connections beyond limit per IP', () => {
        const makeReq = (ip) => {
            const req = new EventEmitter();
            req.ip = ip;
            req.connection = { remoteAddress: ip };
            return req;
        };

        const makeRes = () => ({
            set: () => {},
            flushHeaders: () => {},
            write: () => {},
            status: function(code) { this._status = code; return this; },
            json: function(data) { this._body = data; },
            _status: 200,
            _body: null,
        });

        // Connect 3 clients from same IP (limit is 3)
        for (let i = 0; i < 3; i++) {
            const req = makeReq('10.0.0.1');
            const res = makeRes();
            sseConnect(req, res);
            assert.notEqual(res._status, 429);
        }

        // 4th should be rejected
        const req4 = makeReq('10.0.0.1');
        const res4 = makeRes();
        sseConnect(req4, res4);
        assert.equal(res4._status, 429);
    });
});
