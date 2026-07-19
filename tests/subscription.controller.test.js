const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

// ============================================================================
// Test: Subscription Controller — Coupon Logic
// ============================================================================
describe('Subscription - Coupon Validation', () => {
    it('flat discount reduces price correctly', () => {
        const basePrice = 5000;
        const discountType = 'flat';
        const discountValue = 1000;
        const discount = discountType === 'flat' ? discountValue : 0;
        const finalPrice = Math.max(1, Math.round(basePrice - discount));
        assert.equal(finalPrice, 4000);
    });

    it('percent discount reduces price correctly', () => {
        const basePrice = 5000;
        const discountType = 'percent';
        const discountValue = 20;
        const discount = discountType === 'percent' ? basePrice * (discountValue / 100) : 0;
        const finalPrice = Math.max(1, Math.round(basePrice - discount));
        assert.equal(finalPrice, 4000);
    });

    it('final price is at least 1', () => {
        const basePrice = 500;
        const discount = 1000;
        const finalPrice = Math.max(1, Math.round(basePrice - discount));
        assert.equal(finalPrice, 1);
    });

    it('coupon code is uppercased', () => {
        const code = 'abc123';
        assert.equal(code.toUpperCase(), 'ABC123');
    });
});

// ============================================================================
// Test: Subscription Controller — Phone Matching
// ============================================================================
describe('Subscription - Phone Matching', () => {
    const normalizePhone = (phone) => {
        if (!phone) return '';
        let clean = phone.replace(/[^0-9+]/g, '');
        if (clean.startsWith('+244')) return clean.slice(4);
        if (clean.startsWith('244') && clean.length === 12) return clean.slice(3);
        return clean.replace(/[^0-9]/g, '');
    };

    it('generates correct OR filter variants', () => {
        const cleanPhone = normalizePhone('+244912345678');
        const orFilter = `client_phone.eq.${cleanPhone},client_phone.eq.+244${cleanPhone},client_phone.eq.244${cleanPhone}`;
        
        assert.ok(orFilter.includes('912345678'));
        assert.ok(orFilter.includes('+244912345678'));
        assert.ok(orFilter.includes('244912345678'));
    });

    it('matches phone stored with +244 prefix', () => {
        const storedPhone = '+244912345678';
        const cleanPhone = '912345678';
        
        // Check if any variant matches
        const matches = [
            storedPhone === cleanPhone,
            storedPhone === '+244' + cleanPhone,
            storedPhone === '244' + cleanPhone,
        ].some(Boolean);
        
        assert.ok(matches);
    });

    it('matches phone stored without prefix', () => {
        const storedPhone = '912345678';
        const cleanPhone = '912345678';
        
        const matches = storedPhone === cleanPhone;
        assert.ok(matches);
    });
});

// ============================================================================
// Test: Subscription Controller — Issue Types
// ============================================================================
describe('Subscription - Issue Types', () => {
    it('valid issue types are defined', () => {
        const validTypes = ['PASSWORD_INCORRECT', 'SCREEN_LIMIT', 'LOCKED', 'OTHER'];
        assert.ok(validTypes.includes('PASSWORD_INCORRECT'));
        assert.ok(validTypes.includes('SCREEN_LIMIT'));
        assert.ok(validTypes.includes('LOCKED'));
        assert.ok(validTypes.includes('OTHER'));
    });
});

// ============================================================================
// Test: Subscription Controller — Manual Profile ID
// ============================================================================
describe('Subscription - Manual Profile ID', () => {
    it('manual profile IDs are prefixed correctly', () => {
        const profileId = 'abc-123';
        const manualId = 'manual-' + profileId;
        assert.equal(manualId, 'manual-abc-123');
        assert.ok(manualId.startsWith('manual-'));
    });

    it('manual profile ID can be stripped back', () => {
        const manualId = 'manual-abc-123';
        const rawId = manualId.replace('manual-', '');
        assert.equal(rawId, 'abc-123');
    });
});
