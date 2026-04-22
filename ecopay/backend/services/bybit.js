const axios = require('axios');
const crypto = require('crypto');
require('dotenv').config();

class BybitService {
  constructor() {
    this.apiKey = process.env.BYBIT_API_KEY;
    this.apiSecret = process.env.BYBIT_API_SECRET;
    this.baseUrl = process.env.BYBIT_BASE_URL;
    this.timeOffset = 0; // Diferença entre o servidor Bybit e o local
  }

  // Sincroniza o relógio local com o da Bybit
  async syncTime() {
    try {
      const response = await axios.get(`${this.baseUrl}/v5/market/time`);
      const timeNanoStr = response.data.result.timeNano;
      // Usar BigInt para evitar perda de precisão com números de 19 dígitos
      const serverTimeMillis = BigInt(timeNanoStr) / BigInt(1000000);
      const localTimeMillis = BigInt(Date.now());
      this.timeOffset = Number(serverTimeMillis - localTimeMillis);
      console.log(`[Bybit] Time Synced. Offset: ${this.timeOffset}ms`);
    } catch (error) {
      console.error('[Bybit] Failed to sync time:', error.message);
    }
  }

  _generateSignature(timestamp, payload, recvWindow) {
    const signatureData = timestamp + this.apiKey + recvWindow + payload;
    return crypto
      .createHmac('sha256', this.apiSecret)
      .update(signatureData)
      .digest('hex');
  }

  async createWithdrawal(address, amount, coin = 'USDT', chain = 'BSC') {
    // Sincroniza antes de cada pedido importante para garantir precisão
    await this.syncTime();

    const endpoint = '/v5/asset/withdraw/create';
    const timestamp = (Date.now() + this.timeOffset).toString();
    const recvWindow = '60000'; // Máximo permitido (60s) para garantir sucesso total

    const body = {
      coin,
      chain,
      address,
      amount: amount.toString(),
      forceChain: 1,
    };

    const jsonBody = JSON.stringify(body);
    const signature = this._generateSignature(timestamp, jsonBody, recvWindow);

    try {
      const response = await axios.post(this.baseUrl + endpoint, body, {
        headers: {
          'X-BAPI-API-KEY': this.apiKey,
          'X-BAPI-SIGN': signature,
          'X-BAPI-SIGN-TYPE': '2',
          'X-BAPI-TIMESTAMP': timestamp,
          'X-BAPI-RECV-WINDOW': recvWindow,
          'Content-Type': 'application/json',
        },
      });

      return response.data;
    } catch (error) {
      console.error('Bybit API Error:', error.response ? error.response.data : error.message);
      throw error;
    }
  }
}

module.exports = new BybitService();
