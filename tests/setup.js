/**
 * Test Setup — Manual mocks for Supabase, Redis, axios, and external services
 * 
 * Run tests with: node --test tests/*.test.js
 */

const { mock } = require('node:test');

// ============================================================================
// Mock Supabase — chainable query builder
// ============================================================================
const createMockChain = (resolveWith = { data: null, error: null }) => {
    const chain = {};
    const methods = [
        'select', 'insert', 'update', 'delete', 'eq', 'neq',
        'gt', 'gte', 'lt', 'lte', 'in', 'is', 'or',
        'order', 'limit', 'range', 'not'
    ];
    methods.forEach(m => { chain[m] = () => chain; });
    chain.single = () => Promise.resolve(resolveWith);
    chain.maybeSingle = () => Promise.resolve(resolveWith);
    // Make thenable for `const { data } = await supabase.from(...)`
    chain.then = (resolve) => resolve(resolveWith);
    return chain;
};

const mockSupabase = {
    from: mock.fn(() => createMockChain()),
    rpc: mock.fn(() => Promise.resolve({ data: null, error: null })),
};

// ============================================================================
// Mock Redis
// ============================================================================
const mockRedis = {
    get: mock.fn(() => Promise.resolve(null)),
    set: mock.fn(() => Promise.resolve('OK')),
    incr: mock.fn(() => Promise.resolve(1)),
    expire: mock.fn(() => Promise.resolve(1)),
    del: mock.fn(() => Promise.resolve(1)),
    status: 'ready',
};

// ============================================================================
// Mock axios
// ============================================================================
const mockAxios = {
    post: mock.fn(() => Promise.resolve({ data: { payment_id: 'mock-tx-123' } })),
    get: mock.fn(() => Promise.resolve({ data: {} })),
};

// ============================================================================
// Helpers
// ============================================================================
const resetMocks = () => {
    mockSupabase.from.mock.reset();
    mockSupabase.rpc.mock.reset();
    mockRedis.get.mock.reset();
    mockRedis.set.mock.reset();
    mockRedis.incr.mock.reset();
    mockRedis.expire.mock.reset();
    mockAxios.post.mock.reset();
    mockAxios.get.mock.reset();
};

module.exports = {
    mockSupabase,
    createMockChain,
    mockRedis,
    mockAxios,
    resetMocks,
};
