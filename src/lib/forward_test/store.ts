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
  initialStopLoss?: number;
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
  timeframe?: string;
  perTradeRiskPct: number;
  overallRiskPct: number;
  leverage: number;
  autoLeverage?: boolean;
  lastCheckedAt?: string;
  riskPausedReason?: string | null;
}

export interface ForwardTestState {
  wallet: VirtualWallet;
  config: ForwardTestConfig;
  positions: ForwardPosition[];
  closedTrades: ForwardClosedTrade[];
  lastUpdated: string;
}

const DATA_DIR = path.join(process.cwd(), 'data');

export function cleanUserId(userId?: string): string {
  const raw = (userId || 'DEFAULT_TRADER').trim().toUpperCase();
  const cleaned = raw.replace(/[^A-Z0-9_-]/g, '_');
  return cleaned || 'DEFAULT_TRADER';
}

export function calculateAutoLeverage(strategy: string, riskPct: number): { leverage: number; avgSlPct: number; reason: string } {
  let avgSlPct = 0.4; // 0.4% for Strategy B scalping
  if (strategy === 'Strategy C') avgSlPct = 1.0; // 1.0% for daily breakout
  if (strategy === 'Strategy A') avgSlPct = 1.2; // 1.2% for momentum

  const raw = Math.ceil(riskPct / avgSlPct);
  const leverage = Math.min(50, Math.max(1, raw));
  return {
    leverage,
    avgSlPct,
    reason: `${riskPct}% risk ÷ ~${avgSlPct}% avg SL = ${leverage}x`
  };
}

function getStoreFilePath(cleanId: string): string {
  return path.join(DATA_DIR, `forward_test_${cleanId}.json`);
}

const DEFAULT_STATE: ForwardTestState = {
  wallet: {
    startingBalance: 10000,
    balance: 10000,
    currency: 'INR',
    realizedPnl: 0,
    unrealizedPnl: 0,
  },
  config: {
    isRunning: true,
    strategy: 'Strategy B',
    symbols: ['BTCUSD', 'ETHUSD', 'SOLUSD', 'XRPUSD'],
    timeframe: '5m',
    perTradeRiskPct: 2,
    overallRiskPct: 10,
    leverage: 5,
    autoLeverage: true,
  },
  positions: [],
  closedTrades: [],
  lastUpdated: new Date().toISOString(),
};

// In-memory cache partitioned per user for fast execution
const memoryStates = new Map<string, ForwardTestState>();

export function loadForwardTestState(userId?: string): ForwardTestState {
  const cleanId = cleanUserId(userId);
  if (memoryStates.has(cleanId)) {
    return memoryStates.get(cleanId)!;
  }

  const filePath = getStoreFilePath(cleanId);
  const legacyFile = path.join(DATA_DIR, 'forward_test.json');

  try {
    const targetFile = fs.existsSync(filePath) ? filePath : (cleanId === 'DEFAULT_TRADER' && fs.existsSync(legacyFile) ? legacyFile : null);
    if (targetFile) {
      const raw = fs.readFileSync(targetFile, 'utf-8');
      const parsed = JSON.parse(raw);
      const loaded: ForwardTestState = {
        ...DEFAULT_STATE,
        ...parsed,
        wallet: { ...DEFAULT_STATE.wallet, ...(parsed.wallet || {}) },
        config: { ...DEFAULT_STATE.config, ...(parsed.config || {}) },
      };
      memoryStates.set(cleanId, loaded);
      return loaded;
    }
  } catch (err: any) {
    console.warn(`Failed reading forward test file for user ${cleanId}:`, err.message);
  }

  const fresh: ForwardTestState = JSON.parse(JSON.stringify(DEFAULT_STATE));
  fresh.lastUpdated = new Date().toISOString();
  memoryStates.set(cleanId, fresh);
  return fresh;
}

export function saveForwardTestState(state: ForwardTestState, userId?: string): void {
  const cleanId = cleanUserId(userId);
  state.lastUpdated = new Date().toISOString();
  memoryStates.set(cleanId, state);

  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const filePath = getStoreFilePath(cleanId);
    fs.writeFileSync(filePath, JSON.stringify(state, null, 2), 'utf-8');
  } catch (err: any) {
    console.warn(`Failed writing forward test file for user ${cleanId}:`, err.message);
  }
}

export function resetVirtualWallet(userId?: string, newStartingBalance: number = 10000): ForwardTestState {
  const cleanId = cleanUserId(userId);
  const current = loadForwardTestState(cleanId);
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
  saveForwardTestState(resetState, cleanId);
  return resetState;
}
