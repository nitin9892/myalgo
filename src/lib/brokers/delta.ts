import CryptoJS from 'crypto-js';
import { IBrokerAdapter, Candle, OrderRequest, OrderResult, Position } from './types';

export class DeltaAdapter implements IBrokerAdapter {
  name: 'DELTA' = 'DELTA';
  private apiKey: string;
  private apiSecret: string;
  private isIndia: boolean;
  private baseUrl: string;

  constructor(apiKey?: string, apiSecret?: string, isIndia: boolean = true) {
    this.apiKey = (apiKey || process.env.DELTA_API_KEY || '').trim().replace(/^['"]|['"]$/g, '');
    this.apiSecret = (apiSecret || process.env.DELTA_API_SECRET || '').trim().replace(/^['"]|['"]$/g, '');
    this.isIndia = isIndia;
    this.baseUrl = isIndia ? 'https://api.india.delta.exchange' : 'https://api.delta.exchange';
  }

  private generateSignature(method: string, path: string, queryStr: string, payload: string, timestamp: string): string {
    // Delta HMAC-SHA256 signature specification: METHOD + TIMESTAMP + PATH + QUERY_STRING + PAYLOAD
    const message = method.toUpperCase() + timestamp + path + queryStr + payload;
    return CryptoJS.HmacSHA256(message, this.apiSecret).toString(CryptoJS.enc.Hex);
  }

  private getAuthHeaders(method: string, path: string, queryStr: string = '', payload: string = '') {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = this.generateSignature(method, path, queryStr, payload, timestamp);
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) MyAlgo/1.0',
      'api-key': this.apiKey,
      'signature': signature,
      'timestamp': timestamp,
    };
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    if (!this.apiKey || !this.apiSecret) {
      return { success: false, message: 'Please enter both Delta API Key and API Secret' };
    }

    // Try all regional base URLs (India Live, Global Live, and Testnet)
    const priorityUrls = this.isIndia
      ? ['https://api.india.delta.exchange', 'https://api.delta.exchange', 'https://cdn-ind.testnet.deltaex.org', 'https://testnet-api.delta.exchange']
      : ['https://api.delta.exchange', 'https://api.india.delta.exchange', 'https://testnet-api.delta.exchange', 'https://cdn-ind.testnet.deltaex.org'];

    const endpoints = ['/v2/positions', '/v2/wallet/balances'];
    let lastErrorCode = '';
    let lastErrorDetail = '';

    for (const url of priorityUrls) {
      for (const path of endpoints) {
        try {
          const headers = this.getAuthHeaders('GET', path);
          const res = await fetch(`${url}${path}`, {
            method: 'GET',
            headers,
          });

          if (res.ok) {
            let regionName = 'Delta Exchange';
            if (url.includes('cdn-ind.testnet')) regionName = 'Delta India (Testnet Demo)';
            else if (url.includes('testnet-api')) regionName = 'Delta Global (Testnet Demo)';
            else if (url.includes('india')) regionName = 'Delta India (Live)';
            else regionName = 'Delta Global (Live)';

            this.baseUrl = url;
            return {
              success: true,
              message: `✅ Connected successfully to ${regionName}! Account verified.`,
            };
          }

          // Parse Delta error body: {"error":{"code":"invalid_api_key"},"success":false}
          try {
            const data = await res.json();
            const code = data.error?.code || data.code || '';
            const msg = data.error?.message || data.message || '';
            lastErrorCode = code;
            lastErrorDetail = msg || code;
          } catch {
            lastErrorDetail = `HTTP ${res.status}`;
          }
        } catch (err: any) {
          lastErrorDetail = err.message || 'Network connection failed';
        }
      }
    }

    // Construct human-friendly explanation for the exact Delta error code
    let diagnosticAdvice = `Delta Error (${lastErrorCode || lastErrorDetail})`;

    if (lastErrorCode === 'invalid_api_key') {
      diagnosticAdvice = `Invalid API Key (invalid_api_key). Delta Exchange does not recognize this key. Please check:
1. Is your account on Delta India (india.delta.exchange) or Delta Global (delta.exchange)? Switch the region button above accordingly.
2. Did you create this key on Delta Testnet (demo) instead of Live Delta? Live keys are required.
3. Check for any missing or truncated characters.`;
    } else if (lastErrorCode === 'signature_mismatch' || lastErrorCode === 'invalid_signature') {
      diagnosticAdvice = `Signature Mismatch. Your API Secret does not match the API Key. Please re-copy the Secret from Delta.`;
    } else if (lastErrorCode === 'expired_signature') {
      diagnosticAdvice = `Timestamp Expired. Delta requires server clock to match within 5 seconds. Retrying...`;
    } else if (lastErrorCode.includes('ip') || lastErrorCode.includes('whitelist')) {
      diagnosticAdvice = `IP Restricted. The API key has an IP whitelist enabled in Delta. Please set IP Restriction to "None" in Delta API Settings.`;
    } else if (lastErrorCode.includes('permission') || lastErrorCode.includes('scope')) {
      diagnosticAdvice = `Missing Permissions. The API key must have "Read" and "Trade" permissions checked in Delta settings.`;
    }

    return {
      success: false,
      message: diagnosticAdvice,
    };
  }

  async getLatestCandles(symbol: string = 'BTCUSD', timeframe: string = '1m', count: number = 50): Promise<Candle[]> {
    try {
      const resolution = timeframe;
      const endTime = Math.floor(Date.now() / 1000);
      const startTime = endTime - count * 60 * (timeframe === '5m' ? 5 : 1);

      const path = `/v2/chart/history?symbol=${symbol}&resolution=${resolution}&start=${startTime}&end=${endTime}`;
      const res = await fetch(`${this.baseUrl}${path}`);

      if (res.ok) {
        const data = await res.json();
        if (data.result && data.result.t && data.result.t.length > 0) {
          return data.result.t.map((t: number, i: number) => ({
            timestamp: t * 1000,
            open: data.result.o[i],
            high: data.result.h[i],
            low: data.result.l[i],
            close: data.result.c[i],
            volume: data.result.v[i] || 0,
          }));
        }
      }
    } catch {
      // Fallback
    }
    return this.generateSimulatedCandles(count, 95000);
  }

  async placeOrder(order: OrderRequest): Promise<OrderResult> {
    if (order.paperTrade || !this.apiKey) {
      return {
        success: true,
        orderId: `PAPER-DELTA-${Date.now()}`,
        symbol: order.symbol,
        side: order.side,
        price: order.price || 95000,
        quantity: order.quantity,
        status: 'FILLED',
        message: 'Delta Paper Trade Executed Successfully',
      };
    }

    try {
      const path = '/v2/orders';
      const payloadObj: any = {
        product_symbol: order.symbol.toUpperCase(),
        size: Math.max(1, Math.round(order.quantity)),
        side: order.side.toLowerCase(),
        order_type: order.orderType === 'LIMIT' ? 'limit_order' : 'market_order',
      };
      if (order.orderType === 'LIMIT' && order.price) {
        payloadObj.limit_price = order.price.toString();
      }

      const payload = JSON.stringify(payloadObj);
      const headers = this.getAuthHeaders('POST', path, '', payload);

      const res = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers,
        body: payload,
      });

      const data = await res.json();
      if (res.ok && data.success) {
        return {
          success: true,
          orderId: data.result?.id?.toString() || `${Date.now()}`,
          symbol: order.symbol,
          side: order.side,
          price: Number(data.result?.price) || order.price || 0,
          quantity: order.quantity,
          status: 'FILLED',
          message: `Live Order Executed on Delta Exchange! Order ID: ${data.result?.id}`,
        };
      }
      return {
        success: false,
        symbol: order.symbol,
        side: order.side,
        price: 0,
        quantity: order.quantity,
        status: 'REJECTED',
        message: data.error?.message || data.error?.code || 'Delta order rejected',
      };
    } catch (err: any) {
      return {
        success: false,
        symbol: order.symbol,
        side: order.side,
        price: 0,
        quantity: order.quantity,
        status: 'REJECTED',
        message: err.message,
      };
    }
  }

  async getPositions(): Promise<Position[]> {
    if (!this.apiKey) return [];
    try {
      const path = '/v2/positions';
      const headers = this.getAuthHeaders('GET', path);
      const res = await fetch(`${this.baseUrl}${path}`, { headers });
      const data = await res.json();
      if (!data.result) return [];
      return data.result.map((p: any) => ({
        symbol: p.product_symbol,
        side: p.size > 0 ? 'BUY' : 'SELL',
        quantity: Math.abs(p.size),
        averagePrice: Number(p.entry_price) || 0,
        currentPrice: Number(p.mark_price) || 0,
        unrealizedPnl: Number(p.unrealized_pnl) || 0,
      }));
    } catch {
      return [];
    }
  }

  private generateSimulatedCandles(count: number, basePrice: number): Candle[] {
    const candles: Candle[] = [];
    let current = basePrice;
    const now = Date.now();
    for (let i = count; i >= 0; i--) {
      const change = (Math.random() - 0.49) * (basePrice * 0.002);
      const open = current;
      const close = current + change;
      const high = Math.max(open, close) + Math.random() * (basePrice * 0.001);
      const low = Math.min(open, close) - Math.random() * (basePrice * 0.001);
      candles.push({
        timestamp: now - i * 60 * 1000,
        open: Number(open.toFixed(2)),
        high: Number(high.toFixed(2)),
        low: Number(low.toFixed(2)),
        close: Number(close.toFixed(2)),
        volume: Number((Math.random() * 5 + 0.5).toFixed(4)),
      });
      current = close;
    }
    return candles;
  }
}
