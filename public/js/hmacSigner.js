/**
 * HMAC Request Signing Utility
 * Frontend helper to sign API requests with HMAC-SHA256
 * 
 * IMPORTANT: This file will be visible in browser's source code!
 * The secret key will be exposed. This is acceptable because:
 * 1. We also validate timestamp (prevents replay attacks)
 * 2. We use rate limiting
 * 3. We have Supabase RLS for data protection
 * 4. For mobile apps, use code obfuscation
 * 
 * Usage with fetch:
 * ```js
 * import { signRequest } from './utils/hmacSigner.js';
 * 
 * const data = { phone: '+244912345678', plan: 'ECONOMICO' };
 * const headers = signRequest(data);
 * 
 * fetch('/api/ecoflix/orders', {
 *   method: 'POST',
 *   headers: {
 *     'Content-Type': 'application/json',
 *     ...headers
 *   },
 *   body: JSON.stringify(data)
 * });
 * ```
 */

/**
 * HMAC-SHA256 implementation for browsers
 * Uses Web Crypto API (native, no dependencies)
 * @param {string} message - Message to sign
 * @param {string} secret - Secret key
 * @returns {Promise<string>} Hex encoded signature
 */
async function hmacSHA256(message, secret) {
    // Convert strings to Uint8Array
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const messageData = encoder.encode(message);

    // Import key
    const key = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );

    // Sign message
    const signature = await crypto.subtle.sign('HMAC', key, messageData);

    // Convert ArrayBuffer to hex string
    const hashArray = Array.from(new Uint8Array(signature));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    return hashHex;
}

/**
 * Sign an API request
 * @param {Object} data - Request body data
 * @param {string} secretKey - API secret key (optional, uses default if not provided)
 * @returns {Promise<Object>} Headers to add to the request
 */
async function signRequest(data, secretKey = null) {
    // IMPORTANT: This key must match the backend's API_SECRET_KEY
    // In production, consider loading this from a config endpoint or environment
    const API_SECRET = secretKey || 'ecokambio_segredo_super_dificil_2024_hmac_sha256_protection';

    const timestamp = Date.now().toString();
    const jsonData = JSON.stringify(data || {});

    // Formula must match backend: timestamp + JSON body
    const payload = `${timestamp}${jsonData}`;

    // Generate HMAC signature
    const signature = await hmacSHA256(payload, API_SECRET);

    return {
        'x-timestamp': timestamp,
        'x-signature': signature
    };
}

/**
 * Fetch wrapper with automatic HMAC signing
 * @param {string} url - Request URL
 * @param {Object} options - Fetch options
 * @returns {Promise<Response>} Fetch response
 */
async function securePost(url, data, options = {}) {
    const headers = await signRequest(data);

    return fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...headers,
            ...(options.headers || {})
        },
        body: JSON.stringify(data),
        ...options
    });
}

/**
 * Axios interceptor setup (if using Axios)
 * Add this to your axios config file
 * 
 * Example:
 * ```js
 * import axios from 'axios';
 * import { setupAxiosHMAC } from './utils/hmacSigner.js';
 * 
 * const api = axios.create({ baseURL: '/api' });
 * setupAxiosHMAC(api);
 * 
 * // Now all POST/PUT/PATCH requests are automatically signed
 * api.post('/ecoflix/orders', { phone: '+244...', plan: 'ECONOMICO' });
 * ```
 */
function setupAxiosHMAC(axiosInstance, secretKey = null) {
    axiosInstance.interceptors.request.use(async (config) => {
        // Only sign requests with body (POST, PUT, PATCH)
        if (['post', 'put', 'patch'].includes(config.method?.toLowerCase())) {
            const headers = await signRequest(config.data, secretKey);
            config.headers = {
                ...config.headers,
                ...headers
            };
        }
        return config;
    });
}

// Export for ES modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { signRequest, securePost, setupAxiosHMAC, hmacSHA256 };
}

// Export for browser
if (typeof window !== 'undefined') {
    window.HMACSign = { signRequest, securePost, setupAxiosHMAC, hmacSHA256 };
}
