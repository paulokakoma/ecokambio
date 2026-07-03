const axios = require('axios');

class PayGoService {
    constructor() {
        this.baseUrl = 'https://rouxavcvorjiwhpjhsye.supabase.co/functions/v1/api-v1';
        this.apiKey = process.env.PAYGOOO_API_KEY;
    }

    get headers() {
        return {
            'x-api-key': this.apiKey,
            'Content-Type': 'application/json'
        };
    }

    async createProduct(name, price, thankYouUrl = '', description = '') {
        try {
            const payload = {
                name,
                price: parseInt(price),
                thank_you_url: thankYouUrl,
                description
            };

            const response = await axios.post(`${this.baseUrl}/products`, payload, {
                headers: this.headers
            });

            // Handle both standard and alternative response structures from the API
            const body = response.data;
            if (body.success && body.product && body.product.id) {
                return body.product.id;
            } else if (body.id) {
                return body.id;
            } else {
                throw new Error('Formato de resposta inesperado ao criar produto: ' + JSON.stringify(body));
            }
        } catch (error) {
            console.error('Erro ao criar produto na PayGo:', error.response?.data || error.message);
            throw new Error('Falha ao comunicar com a API da PayGo (createProduct)');
        }
    }

    async createPayment(productId, paymentMethod, customerName, customerEmail, opts = {}) {
        try {
            const payload = {
                product_id: productId,
                payment_method: paymentMethod, // 'multicaixa' or 'reference'
                customer_name: customerName || 'Cliente EcoFlix',
                customer_email: customerEmail || 'suporte@ecokambio.com'
            };

            if (opts.phone) payload.customer_phone = opts.phone;
            if (opts.merchantTransactionId) payload.merchantTransactionId = opts.merchantTransactionId;

            const response = await axios.post(`${this.baseUrl}/payments`, payload, {
                headers: this.headers
            });

            const body = response.data;
            const paymentId = body?.payment?.id || body?.id || body?.payment_id;
            const status = body?.payment?.status || body?.status || 'pending';
            const reference = body?.reference || body?.payment?.reference;

            if (!paymentId) {
                 throw new Error('ID do pagamento não retornado pela API da PayGo');
            }

            return {
                payment_id: paymentId,
                status,
                reference,
                raw: body
            };
        } catch (error) {
            const apiError = error.response?.data?.error || error.response?.data?.message || error.message;
            console.error('Erro ao criar pagamento na PayGo:', apiError);

            if (apiError && apiError.includes('60 seconds')) {
                throw new Error('Aguarde! Já existe um pedido enviado para o seu telemóvel. Confirme no Multicaixa Express ou aguarde 60 segundos antes de tentar novamente.');
            }
            
            throw new Error('Falha ao comunicar com a API da PayGo: ' + apiError);
        }
    }
}

module.exports = new PayGoService();
