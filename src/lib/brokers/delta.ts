import CryptoJS from 'crypto-js';
import { IBrokerAdapter, Candle, OrderRequest, OrderResult, Position } from './types';

export class DeltaAdapter implements IBrokerAdapter {
  name: 'DELTA' = 'DELTA';
  private apiKey: string;
  private apiSecret: string;
  private baseUrl = 'https://api.delta.exchange';

  constructor(apiKey?: string, apiSecret?: string) {
    this.apiKey = apiKey || process.env.DELTA_API_KEY || '';
    this.apiSecret = apiSecret || process.env.DELTA_API_SECRET || '';
  }

  private generateSignature(method: string, path: string, payload: string, timestamp: number): string {
    const message = method + timestamp + path + payload;
    return CryptoJS.HmacSHA256(message, this.apiSecret).toString(CryptoJS.enc.Hex);
  }

  private getAuthHeaders(method: string, path: string, payload: string = '') {
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = this.generateSignature(method, path, payload, timestamp);
    return {
      'Content-Type': 'application/json',
      'api-key': this.apiKey,
      'signature': signature,
      'timestamp': timestamp.toString(),
    };
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    if (!this.apiKey || !this.apiSecret) {
      return { success: false, message: 'Delta API Key or Secret not configured' };
    }
    try {
      const path = '/v2/wallet/balances';
      const headers = this.getAuthHeaders('GET', path);
      const res = await fetch(`${this.baseUrl}${path}`, { headers });
      if (res.ok) {
        return { success: true, message: 'Delta Exchange API connected successfully' };
      }
      return { success: false, message: `Delta Auth Failed: HTTP ${res.status}` };
    } catch (err: any) {
      return { success: false, message: err.message || 'Delta connection failed' };
    }
  }

  async getLatestCandles(symbol: string = 'BTCUSD', timeframe: string = '1m', count: number = 50): Promise<Candle[]> {
    try {
      // Resolution mapping for Delta Exchange: 1m, 5m, 15m, 1h
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
      // Fallback to simulated if offline or test environment
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
      const payloadObj = {
        product_symbol: order.symbol,
        size: order.quantity,
        side: order.side.toLowerCase(),
        order_type: order.orderType === 'LIMIT' ? 'limit_order' : 'market_order',
        limit_price: order.price ? order.price.toString() : undefined,
      };
      const payload = JSON.stringify(payloadObj);
      const headers = this.getAuthHeaders('POST', path, payload);

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
        };
      }
      return {
        success: false,
        symbol: order.symbol,
        side: order.side,
        price: 0,
        quantity: order.quantity,
        status: 'REJECTED',
        message: data.error?.message || 'Delta order rejected',
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
