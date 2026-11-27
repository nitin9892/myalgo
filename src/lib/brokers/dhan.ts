import { IBrokerAdapter, Candle, OrderRequest, OrderResult, Position } from './types';

// Common Dhan Security IDs for major indices & liquid equities (NSE & BSE)
const DHAN_SECURITY_MAP: Record<string, { securityId: string; segment: string }> = {
  // Indices
  'NIFTY': { securityId: '13', segment: 'IDX_I' },
  'BANKNIFTY': { securityId: '25', segment: 'IDX_I' },
  'FINNIFTY': { securityId: '27', segment: 'IDX_I' },
  'MIDCPNIFTY': { securityId: '44', segment: 'IDX_I' },
  'SENSEX': { securityId: '51', segment: 'IDX_I' },

  // Top Liquid Indian Equities (NSE_EQ)
  'RELIANCE': { securityId: '2885', segment: 'NSE_EQ' },
  'TCS': { securityId: '11536', segment: 'NSE_EQ' },
  'INFY': { securityId: '1594', segment: 'NSE_EQ' },
  'HDFCBANK': { securityId: '1333', segment: 'NSE_EQ' },
  'ICICIBANK': { securityId: '4963', segment: 'NSE_EQ' },
  'SBIN': { securityId: '3045', segment: 'NSE_EQ' },
  'TATAMOTORS': { securityId: '3456', segment: 'NSE_EQ' },
  'BAJFINANCE': { securityId: '317', segment: 'NSE_EQ' },
  'ITC': { securityId: '1660', segment: 'NSE_EQ' },
  'LT': { securityId: '11483', segment: 'NSE_EQ' },
  'AXISBANK': { securityId: '5900', segment: 'NSE_EQ' },
  'KOTAKBANK': { securityId: '1922', segment: 'NSE_EQ' },
  'BHARTIARTL': { securityId: '10604', segment: 'NSE_EQ' },
  'IDEA': { securityId: '14366', segment: 'NSE_EQ' },
  'ZOMATO': { securityId: '5097', segment: 'NSE_EQ' },
  'TATASTEEL': { securityId: '3499', segment: 'NSE_EQ' },
};

export class DhanAdapter implements IBrokerAdapter {
  name: 'DHAN' = 'DHAN';
  private clientId: string;
  private accessToken: string;
  private baseUrl = 'https://api.dhan.co/v2';

  constructor(clientId?: string, accessToken?: string) {
    this.clientId = (clientId || process.env.DHAN_CLIENT_ID || '').trim();
    this.accessToken = (accessToken || process.env.DHAN_ACCESS_TOKEN || '').trim();
  }

  private getHeaders() {
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'access-token': this.accessToken,
      'client-id': this.clientId,
    };
  }

  async testConnection(): Promise<{ 
    success: boolean; 
    message: string;
    balance?: number;
    currency?: string;
    balanceDisplay?: string;
    accountStatus?: 'CONNECTED' | 'DISCONNECTED';
  }> {
    if (!this.clientId || !this.accessToken) {
      return { 
        success: false, 
        message: 'Dhan Client ID or 24-hr Access Token is missing. Enter credentials to connect.',
        accountStatus: 'DISCONNECTED',
      };
    }

    try {
      // 1. First probe live fund limits for real-time wallet balance
      const fundRes = await fetch(`${this.baseUrl}/fundlimit`, {
        headers: this.getHeaders(),
      });

      if (fundRes.ok) {
        const data = await fundRes.json();
        const rawBal = typeof data.availabelBalance === 'number' 
          ? data.availabelBalance 
          : (typeof data.sodLimit === 'number' ? data.sodLimit : 0);
        
        const balance = Number(rawBal.toFixed(2));
        const formatted = `₹${balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} INR`;

        return { 
          success: true, 
          message: `Connected to DhanHQ Live! Client: ${data.dhanClientId || this.clientId} • Available Margin: ${formatted}`,
          balance,
          currency: 'INR',
          balanceDisplay: formatted,
          accountStatus: 'CONNECTED',
        };
      }

      // 2. Fallback to profile check
      const res = await fetch(`${this.baseUrl}/profile`, {
        headers: this.getHeaders(),
      });

      if (res.ok) {
        const data = await res.json();
        return { 
          success: true, 
          message: `Connected to DhanHQ Live! Client ID: ${data.dhanClientId || this.clientId}`,
          balance: 0,
          currency: 'INR',
          balanceDisplay: '₹0.00 INR (Connected)',
          accountStatus: 'CONNECTED',
        };
      }

      const errText = await res.text();
      let parsedErr = errText;
      try {
        const errObj = JSON.parse(errText);
        parsedErr = errObj.remarks || errObj.message || errText;
      } catch {}

      return { 
        success: false, 
        message: `DhanHQ Authentication Failed: ${parsedErr || res.statusText}. Please verify your Client ID & 24hr Access Token.`,
        accountStatus: 'DISCONNECTED',
      };
    } catch (err: any) {
      return { 
        success: false, 
        message: err.message || 'Failed connecting to DhanHQ API server.',
        accountStatus: 'DISCONNECTED',
      };
    }
  }

  async getLatestCandles(symbol: string, timeframe: string = '5m', count: number = 50): Promise<Candle[]> {
    if (!this.accessToken) {
      return this.generateSimulatedCandles(count, 24000);
    }

    try {
      const mapping = DHAN_SECURITY_MAP[symbol.toUpperCase()] || { securityId: '13', segment: 'NSE_FNO' };
      const fromDate = new Date(Date.now() - 48 * 3600 * 1000).toISOString().split('T')[0];
      const toDate = new Date().toISOString().split('T')[0];

      const res = await fetch(`${this.baseUrl}/charts/historical`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          securityId: mapping.securityId,
          exchangeSegment: mapping.segment === 'NSE_EQ' ? 'NSE_EQ' : 'NSE_FNO',
          instrument: 'INDEX',
          expiryCode: 0,
          fromDate,
          toDate,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.candles && data.candles.length > 0) {
          return data.candles.slice(-count).map((c: any) => ({
            timestamp: c[0] * 1000,
            open: c[1],
            high: c[2],
            low: c[3],
            close: c[4],
            volume: c[5] || 0,
          }));
        }
      }
    } catch {
      // Fallback
    }
    return this.generateSimulatedCandles(count, 24000);
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
        message: 'Dhan Paper Trade Executed (Simulated)',
      };
    }

    try {
      const sym = order.symbol.toUpperCase();
      const mapping = DHAN_SECURITY_MAP[sym] || { securityId: '13', segment: 'NSE_EQ' };

      const correlationId = `MYALGO_${Date.now()}`;
      const payload = {
        dhanClientId: this.clientId,
        correlationId,
        transactionType: order.side, // BUY or SELL
        exchangeSegment: mapping.segment === 'NSE_EQ' ? 'NSE_EQ' : 'NSE_FNO',
        productType: 'INTRADAY', // CNC, INTRADAY, MARGIN
        orderType: order.orderType === 'LIMIT' ? 'LIMIT' : 'MARKET',
        validity: 'DAY',
        tradingSymbol: order.symbol,
        securityId: mapping.securityId,
        quantity: order.quantity,
        price: order.orderType === 'LIMIT' ? (order.price || 0) : 0,
      };

      const res = await fetch(`${this.baseUrl}/orders`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && (data.orderId || data.orderStatus)) {
        return {
          success: true,
          orderId: data.orderId || correlationId,
          symbol: order.symbol,
          side: order.side,
          price: order.price || 0,
          quantity: order.quantity,
          status: 'FILLED',
          message: `Live Order Placed on Dhan! Status: ${data.orderStatus || 'SUBMITTED'}`,
        };
      }

      return {
        success: false,
        symbol: order.symbol,
        side: order.side,
        price: 0,
        quantity: order.quantity,
        status: 'REJECTED',
        message: data.remarks || data.message || `Dhan order failed: HTTP ${res.status}`,
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
      if (!res.ok) return [];
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
