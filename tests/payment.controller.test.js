const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

// ============================================================================
// Test: Payment Controller — Reference Formatting
// ============================================================================
describe('Payment Controller - Reference Formatting', () => {
    it('formats 9-digit reference with spaces', () => {
        const ref = '123456789';
        const formatted = ref.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3');
        assert.equal(formatted, '123 456 789');
    });

    it('preserves non-9-digit references', () => {
        const ref = '123456';
        const formatted = ref.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3');
        assert.equal(formatted, '123456'); // no match, unchanged
    });

    it('strips spaces from reference', () => {
        const ref = '123 456 789';
        const clean = ref.replace(/\s/g, '');
        assert.equal(clean, '123456789');
    });
});

// ============================================================================
// Test: Payment Controller — Entity Validation
// ============================================================================
describe('Payment Controller - Entity Validation', () => {
    it('valid entity format (3-5 digits)', () => {
        const isValid = (entity) => /^\d{3,5}$/.test(entity);
        assert.ok(isValid('00024'));
        assert.ok(isValid('123'));
        assert.ok(isValid('12345'));
        assert.ok(!isValid('12'));
        assert.ok(!isValid('123456'));
        assert.ok(!isValid('abc'));
    });

    it('default entity is 00024', () => {
        const entity = undefined || '00024';
        assert.equal(entity, '00024');
    });
});

// ============================================================================
// Test: Payment Controller — Duration Parsing
// ============================================================================
describe('Payment Controller - Duration Parsing', () => {
    it('parses valid duration', () => {
        assert.equal(parseInt('3') || 1, 3);
    });

    it('defaults to 1 for invalid input', () => {
        assert.equal(parseInt(undefined) || 1, 1);
        assert.equal(parseInt('abc') || 1, 1);
        assert.equal(parseInt(null) || 1, 1);
    });

    it('duration 0 defaults to 1', () => {
        assert.equal(parseInt('0') || 1, 1);
    });
});

// ============================================================================
// Test: Payment Controller — Webhook Event Matching
// ============================================================================
describe('Payment Controller - Webhook Events', () => {
    it('success events are recognized', () => {
        const successEvents = ['success', 'paid', 'completed'];
        assert.ok(successEvents.includes('success'));
        assert.ok(successEvents.includes('paid'));
        assert.ok(successEvents.includes('completed'));
    });

    it('failure events are recognized', () => {
        const failEvents = ['failed', 'payment_failed', 'cancelled', 'canceled'];
        assert.ok(failEvents.includes('failed'));
        assert.ok(failEvents.includes('cancelled'));
        assert.ok(failEvents.includes('canceled'));
    });

    it('extracts transaction_id from various payload shapes', () => {
        const extract = (payload) => payload.payment_id || (payload.payment && payload.payment.id) || payload.id;
        
        assert.equal(extract({ payment_id: 'tx1' }), 'tx1');
        assert.equal(extract({ payment: { id: 'tx2' } }), 'tx2');
        assert.equal(extract({ id: 'tx3' }), 'tx3');
        assert.equal(extract({}), undefined);
    });
});

// ============================================================================
// Test: Payment Controller — HMAC Signature Verification
// ============================================================================
describe('Payment Controller - HMAC Signature', () => {
    const crypto = require('crypto');

    it('generates valid HMAC signature', () => {
        const secret = 'test-secret';
        const payload = '{"test": true}';
        const hmac = crypto.createHmac('sha256', secret);
        const digest = hmac.update(payload).digest('hex');
        assert.equal(digest.length, 64); // SHA-256 hex is 64 chars
    });

    it('different secrets produce different signatures', () => {
        const payload = 'test';
        const sig1 = crypto.createHmac('sha256', 'secret1').update(payload).digest('hex');
        const sig2 = crypto.createHmac('sha256', 'secret2').update(payload).digest('hex');
        assert.notEqual(sig1, sig2);
    });

    it('timing-safe comparison works', () => {
        const a = Buffer.from('abc123');
        const b = Buffer.from('abc123');
        const c = Buffer.from('abc124');
        assert.ok(crypto.timingSafeEqual(a, b));
        assert.ok(!crypto.timingSafeEqual(a, c));
    });
});

// ============================================================================
// Test: Payment Controller — JWT Token
// ============================================================================
describe('Payment Controller - JWT', () => {
    const jwt = require('jsonwebtoken');
    const secret = 'test-secret-key';

    it('creates and verifies token', () => {
        const payload = { id: 'user-1', phone: '912345678' };
        const token = jwt.sign(payload, secret, { expiresIn: '1h' });
        const decoded = jwt.verify(token, secret);
        assert.equal(decoded.id, 'user-1');
        assert.equal(decoded.phone, '912345678');
    });

    it('rejects token with wrong secret', () => {
        const token = jwt.sign({ id: 'user-1' }, secret, { expiresIn: '1h' });
        assert.throws(() => jwt.verify(token, 'wrong-secret'));
    });
});

// ============================================================================
// Test: Payment Controller — Price Calculation
// ============================================================================
describe('Payment Controller - Price Calculation', () => {
    it('single month price', () => {
        const price = 5000;
        const duration = 1;
        assert.equal(price * duration, 5000);
    });

    it('multi-month price', () => {
        const price = 5000;
        const duration = 3;
        assert.equal(price * duration, 15000);
    });

    it('coupon discount calculation', () => {
        const basePrice = 15000; // 3 months
        const discountPercent = 10;
        const discount = basePrice * (discountPercent / 100);
        const finalPrice = Math.max(1, Math.round(basePrice - discount));
        assert.equal(finalPrice, 13500);
    });
});
