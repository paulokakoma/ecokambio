// Set env vars BEFORE loading app
process.env.APPYPAY_SECRET = 'test-secret';
process.env.JWT_SECRET = 'super-secret-jwt-key-change-me';

const request = require('supertest');
const app = require('../../server');
const crypto = require('crypto');
const { redisClient } = require('../../src/config/redis');

// Mock dependencies if needed, but for integration we prefer real or semi-real
// We can mock Supabase calls by mocking the module, or run against a test db (harder)
// Let's mock Supabase for now to avoid side effects
jest.mock('../../src/config/supabase', () => {
    return {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: { id: 1, phone: '+244900000000', verified_at: new Date() } }),
        insert: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        rpc: jest.fn().mockResolvedValue({ data: { success: true, credentials: {} }, error: null })
    };
});

// Mock SMS Service
jest.mock('../../src/netflix/services/sms.service', () => ({
    sendSms: jest.fn().mockResolvedValue(true),
    sendOtpSms: jest.fn(),
    sendDeliverySms: jest.fn()
}));

jest.mock('axios', () => ({
    post: jest.fn().mockResolvedValue({ data: { reference: 'TEST-REF-123' }, status: 200 })
}));

// Mock BullMQ and Redis to prevent connection errors
jest.mock('bullmq', () => ({
    Queue: jest.fn().mockImplementation(() => ({
        add: jest.fn().mockResolvedValue(true)
    })),
    Worker: jest.fn().mockImplementation(() => ({}))
}));

jest.mock('ioredis', () => require('jest-mock-ioredis'));
jest.mock('../../src/config/redis', () => ({
    redisClient: {
        on: jest.fn(),
        quit: jest.fn(),
        connect: jest.fn()
    },
    redisConfig: {}
}));

const jwt = require('jsonwebtoken');

describe('Security & Architecture Tests', () => {

    afterAll(async () => {
        await redisClient.quit();
        // Force close server if open (supertest usually handles it but redis might hang)
    });

    describe('OTP Auth Flow', () => {
        let validToken;

        it('should send OTP', async () => {
            const res = await request(app)
                .post('/api/ecoflix/auth/send-otp')
                .send({ phone: '+244923456789' });
            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
        });

        it('should verify OTP and return Token', async () => {
            // Mock supabase response for otp check inside controller
            // Since we mocked supabase globally, it returns data. 
            // We might need to adjust mock per test if controller logic is complex.
            // But controller checks: eq('code', code).eq('verified', false)...
            // The global mock returns { data: ... } so it "finds" the OTP.

            const res = await request(app)
                .post('/api/ecoflix/auth/verify-otp')
                .send({ phone: '+244923456789', code: '1234' });

            expect(res.statusCode).toBe(200);
            expect(res.body.token).toBeDefined();
            validToken = res.body.token;
        });

        it('should Reject creation of order without Token', async () => {
            const res = await request(app)
                .post('/api/ecoflix/orders/create')
                .send({ phone: '+244923456789', plan_type: 'ECONOMICO', payment_method: 'REFERENCE' });

            // Should be 401
            expect(res.statusCode).toBe(401);
        });

        it('should Accept creation of order WITH Token', async () => {
            const res = await request(app)
                .post('/api/ecoflix/orders/create')
                .set('Authorization', `Bearer ${validToken}`)
                .send({ phone: '+244923456789', plan_type: 'ECONOMICO', payment_method: 'REFERENCE' });

            expect(res.statusCode).toBe(201);
        });
    });

    describe('Webhook Security', () => {
        it('should Reject webhook without signature', async () => {
            // Ensure secret is set
            process.env.APPYPAY_SECRET = 'test-secret';

            const res = await request(app)
                .post('/api/ecoflix/webhooks/appypay')
                .send({ reference: '123', status: 'paid' });

            if (res.statusCode !== 401) {
                console.log('Webhook Reject Body:', res.body);
            }
            expect(res.statusCode).toBe(401); // My code returns 401 for invalid/missing sig if secret set
        });

        it('should Accept webhook with valid signature', async () => {
            process.env.APPYPAY_SECRET = 'test-secret';
            const payload = JSON.stringify({ reference: '123', status: 'paid' });
            const signature = crypto.createHmac('sha256', 'test-secret').update(payload).digest('hex');

            const res = await request(app)
                .post('/api/ecoflix/webhooks/appypay')
                .set('Content-Type', 'application/json')
                .set('x-appypay-signature', signature)
                .send(payload);

            expect(res.statusCode).toBe(200);
        });
    });
});
