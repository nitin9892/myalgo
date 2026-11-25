export type BrokerType = 'DHAN' | 'DELTA' | 'METATRADER';

export interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface OrderRequest {
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  orderType: 'MARKET' | 'LIMIT';
  price?: number;
  stopLoss?: number;
  takeProfit?: number;
  paperTrade?: boolean;
  leverage?: number;
}

export interface OrderResult {
  success: boolean;
  orderId?: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  price: number;
  quantity: number;
  status: 'FILLED' | 'REJECTED' | 'PENDING';
  message?: string;
}

export interface Position {
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  unrealizedPnl: number;
}

export interface IBrokerAdapter {
  name: BrokerType;
  testConnection(): Promise<{
    success: boolean;
    message: string;
    balance?: number;
    currency?: string;
    balanceDisplay?: string;
    accountStatus?: 'CONNECTED' | 'DISCONNECTED';
  }>;
  getLatestCandles(symbol: string, timeframe: string, count: number): Promise<Candle[]>;
  placeOrder(order: OrderRequest): Promise<OrderResult>;
  getPositions(): Promise<Position[]>;
}
