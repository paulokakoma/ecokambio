(function () {
    const API_SECRET = 'ecokambio_segredo_super_dificil_2024_hmac_sha256_protection';

    async function signRequest(payload) {
        const timestamp = Date.now();
        const data = typeof payload === 'string' ? payload : JSON.stringify(payload);
        const msg = timestamp + data;

        const enc = new TextEncoder();
        const key = await crypto.subtle.importKey(
            'raw',
            enc.encode(API_SECRET),
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        );
        const sig = await crypto.subtle.sign('HMAC', key, enc.encode(msg));
        const signature = Array.from(new Uint8Array(sig))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');

        return {
            'x-signature': signature,
            'x-timestamp': timestamp.toString(),
            'Content-Type': 'application/json'
        };
    }

    window.HMACSign = { signRequest };
})();
