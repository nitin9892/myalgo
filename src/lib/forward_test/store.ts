import fs from 'fs';
import path from 'path';

export interface VirtualWallet {
  startingBalance: number;
  balance: number;
  currency: string;
  realizedPnl: number;
  unrealizedPnl: number;
}

export interface ForwardPosition {
  id: string;
  symbol: string;
  strategy: string;
  setupName: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  stopLoss: number;
  takeProfit: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
  entryTime: string;
  trailingMilestone?: number;
}

export interface ForwardClosedTrade {
  id: string;
  symbol: string;
  strategy: string;
  setupName: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  entryPrice: number;
  exitPrice: number;
  realizedPnl: number;
  pnlPct: number;
  result: 'WIN' | 'LOSS';
  exitReason: string;
  entryTime: string;
  exitTime: string;
  durationMinutes: number;
}

export interface ForwardTestConfig {
  isRunning: boolean;
  strategy: 'Strategy C' | 'Strategy B' | 'Strategy A';
  symbols: string[];
  perTradeRiskPct: number;
  leverage: number;
  lastCheckedAt?: string;
}

export interface ForwardTestState {
  wallet: VirtualWallet;
  config: ForwardTestConfig;
  positions: ForwardPosition[];
  closedTrades: ForwardClosedTrade[];
  lastUpdated: string;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const STORE_FILE = path.join(DATA_DIR, 'forward_test.json');

const DEFAULT_STATE: ForwardTestState = {
  wallet: {
    startingBalance: 100000,
    balance: 100000,
    currency: 'INR',
    realizedPnl: 0,
    unrealizedPnl: 0,
  },
  config: {
    isRunning: true,
    strategy: 'Strategy C',
    symbols: ['BTCUSD', 'ETHUSD', 'SOLUSD', 'XRPUSD'],
    perTradeRiskPct: 2,
    leverage: 10,
  },
  positions: [],
  closedTrades: [],
  lastUpdated: new Date().toISOString(),
};

// In-memory cache for fast serverless execution
let memoryState: ForwardTestState | null = null;

export function loadForwardTestState(): ForwardTestState {
  if (memoryState) return memoryState;

  try {
    if (fs.existsSync(STORE_FILE)) {
      const raw = fs.readFileSync(STORE_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      memoryState = {
        ...DEFAULT_STATE,
        ...parsed,
        wallet: { ...DEFAULT_STATE.wallet, ...(parsed.wallet || {}) },
        config: { ...DEFAULT_STATE.config, ...(parsed.config || {}) },
      };
      return memoryState!;
    }
  } catch (err: any) {
    console.warn('Failed reading forward_test.json, using defaults:', err.message);
  }

  memoryState = JSON.parse(JSON.stringify(DEFAULT_STATE));
  return memoryState!;
}

export function saveForwardTestState(state: ForwardTestState): void {
  memoryState = state;
  state.lastUpdated = new Date().toISOString();

  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(STORE_FILE, JSON.stringify(state, null, 2), 'utf-8');
  } catch (err: any) {
    console.warn('Failed writing forward_test.json:', err.message);
  }
}

export function resetVirtualWallet(newStartingBalance: number = 100000): ForwardTestState {
  const current = loadForwardTestState();
  const resetState: ForwardTestState = {
    ...current,
    wallet: {
      startingBalance: newStartingBalance,
      balance: newStartingBalance,
      currency: 'INR',
      realizedPnl: 0,
      unrealizedPnl: 0,
    },
    positions: [],
    closedTrades: [],
    lastUpdated: new Date().toISOString(),
  };
  saveForwardTestState(resetState);
  return resetState;
}
