import { IBrokerAdapter, Candle, OrderRequest, OrderResult, Position } from './types';

export class DhanAdapter implements IBrokerAdapter {
  name: 'DHAN' = 'DHAN';
  private clientId: string;
  private accessToken: string;
  private baseUrl = 'https://api.dhan.co/v2';

  constructor(clientId?: string, accessToken?: string) {
    this.clientId = clientId || process.env.DHAN_CLIENT_ID || '';
    this.accessToken = accessToken || process.env.DHAN_ACCESS_TOKEN || '';
  }

  private getHeaders() {
    return {
      'Content-Type': 'application/json',
      'access-token': this.accessToken,
      'client-id': this.clientId,
    };
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    if (!this.clientId || !this.accessToken) {
      return { success: false, message: 'Dhan Client ID or Access Token is missing' };
    }
    try {
      const res = await fetch(`${this.baseUrl}/profile`, {
        headers: this.getHeaders(),
      });
      if (res.ok) {
        return { success: true, message: 'DhanHQ API connected successfully' };
      }
      return { success: false, message: `Dhan Auth Failed: Status ${res.status}` };
    } catch (err: any) {
      return { success: false, message: err.message || 'Connection failed' };
    }
  }

  async getLatestCandles(symbol: string, timeframe: string = '5m', count: number = 50): Promise<Candle[]> {
    // If running in paper mode or credentials not set, provide simulated market data
    if (!this.accessToken) {
      return this.generateSimulatedCandles(count, 24000);
    }

    try {
      // Dhan historical chart endpoint
      const res = await fetch(`${this.baseUrl}/charts/historical`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          symbol,
          exchangeSegment: 'NSE_FNO',
          instrument: 'INDEX',
          expiryCode: 0,
          fromDate: new Date(Date.now() - 24 * 3600 * 1000).toISOString().split('T')[0],
          toDate: new Date().toISOString().split('T')[0],
        }),
      });

      if (!res.ok) {
        return this.generateSimulatedCandles(count, 24000);
      }
      const data = await res.json();
      if (!data.candles || data.candles.length === 0) {
        return this.generateSimulatedCandles(count, 24000);
      }

      return data.candles.slice(-count).map((c: any) => ({
        timestamp: c[0] * 1000,
        open: c[1],
        high: c[2],
        low: c[3],
        close: c[4],
        volume: c[5] || 0,
      }));
    } catch {
      return this.generateSimulatedCandles(count, 24000);
    }
  }

  async placeOrder(order: OrderRequest): Promise<OrderResult> {
    if (order.paperTrade || !this.accessToken) {
      return {
        success: true,
        orderId: `PAPER-DHAN-${Date.now()}`,
        symbol: order.symbol,
        side: order.side,
        price: order.price || 24000,
        quantity: order.quantity,
        status: 'FILLED',
        message: 'Dhan Paper Trade Executed Successfully',
      };
    }

    try {
      const payload = {
        dhanClientId: this.clientId,
        transactionType: order.side,
        exchangeSegment: 'NSE_FNO',
        productType: 'INTRADAY',
        orderType: order.orderType,
        validity: 'DAY',
        tradingSymbol: order.symbol,
        quantity: order.quantity,
        price: order.price || 0,
      };

      const res = await fetch(`${this.baseUrl}/orders`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.orderId) {
        return {
          success: true,
          orderId: data.orderId,
          symbol: order.symbol,
          side: order.side,
          price: order.price || 0,
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
        message: data.message || 'Order rejected by DhanHQ',
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
    if (!this.accessToken) return [];
    try {
      const res = await fetch(`${this.baseUrl}/positions`, { headers: this.getHeaders() });
      const data = await res.json();
      return (data || []).map((p: any) => ({
        symbol: p.tradingSymbol,
        side: p.netQty > 0 ? 'BUY' : 'SELL',
        quantity: Math.abs(p.netQty),
        averagePrice: p.buyAvg || p.sellAvg || 0,
        currentPrice: p.lastTradedPrice || 0,
        unrealizedPnl: p.unrealizedProfitLoss || 0,
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
      const change = (Math.random() - 0.49) * (basePrice * 0.003);
      const open = current;
      const close = current + change;
      const high = Math.max(open, close) + Math.random() * (basePrice * 0.001);
      const low = Math.min(open, close) - Math.random() * (basePrice * 0.001);
      candles.push({
        timestamp: now - i * 5 * 60 * 1000,
        open: Number(open.toFixed(2)),
        high: Number(high.toFixed(2)),
        low: Number(low.toFixed(2)),
        close: Number(close.toFixed(2)),
        volume: Math.floor(Math.random() * 5000 + 1000),
      });
      current = close;
    }
    return candles;
  }
}
