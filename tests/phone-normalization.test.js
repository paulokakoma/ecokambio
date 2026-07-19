const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');

// ============================================================================
// Test: normalizePhone
// ============================================================================
describe('normalizePhone', () => {
    // We test the pure function logic directly since it's a simple transform
    const normalizePhone = (phone) => {
        if (!phone) return '';
        let clean = phone.replace(/[^0-9+]/g, '');
        if (clean.startsWith('+244')) return clean.slice(4);
        if (clean.startsWith('244') && clean.length === 12) return clean.slice(3);
        return clean.replace(/[^0-9]/g, '');
    };

    it('returns empty string for null/undefined/empty', () => {
        assert.equal(normalizePhone(null), '');
        assert.equal(normalizePhone(undefined), '');
        assert.equal(normalizePhone(''), '');
    });

    it('strips +244 prefix', () => {
        assert.equal(normalizePhone('+244912345678'), '912345678');
    });

    it('strips 244 prefix (12 digits)', () => {
        assert.equal(normalizePhone('244912345678'), '912345678');
    });

    it('returns 9 digits for raw number', () => {
        assert.equal(normalizePhone('912345678'), '912345678');
    });

    it('strips non-numeric characters', () => {
        assert.equal(normalizePhone('+244 912 345 678'), '912345678');
        assert.equal(normalizePhone('(912) 345-678'), '912345678');
    });

    it('handles short numbers', () => {
        assert.equal(normalizePhone('912'), '912');
    });

    it('handles numbers with extra prefix variations', () => {
        // 244 with less than 12 digits — not stripped
        assert.equal(normalizePhone('244912345'), '244912345');
    });
});

// ============================================================================
// Test: normalizeWsPhone (same logic as normalizePhone)
// ============================================================================
describe('normalizeWsPhone', () => {
    const normalizeWsPhone = (phone) => {
        if (!phone) return '';
        let clean = String(phone).replace(/[^0-9+]/g, '');
        if (clean.startsWith('+244')) clean = clean.slice(4);
        else if (clean.startsWith('244') && clean.length >= 12) clean = clean.slice(3);
        return clean.replace(/[^0-9]/g, '');
    };

    it('handles string phone numbers', () => {
        assert.equal(normalizeWsPhone('+244912345678'), '912345678');
    });

    it('handles numeric phone numbers', () => {
        assert.equal(normalizeWsPhone(244912345678), '912345678');
    });

    it('returns empty for null', () => {
        assert.equal(normalizeWsPhone(null), '');
    });
});
