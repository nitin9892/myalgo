import fs from 'fs';
import path from 'path';
import { getAllAccessTokens } from '@/lib/auth/tokenStorage';
import { loadForwardTestState, cleanUserId } from '@/lib/forward_test/store';
import { getAdminSupabase } from '@/lib/supabase';

export interface UserCommissionRecord {
  userId: string;
  tokenCode: string;
  clientLabel: string;
  isActive: boolean;
  commissionRate: number; // default 20%
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  grossProfit: number;
  grossLoss: number;
  netProfit: number;
  todayPnl: number;
  commissionDue: number;
  settledCommission: number;
  pendingCommission: number;
  settlementStatus: 'SETTLED' | 'PENDING' | 'NO_PROFIT';
  lastSettledAt?: string | null;
  settlementNotes?: string;
  lastTradeTime?: string | null;
  virtualWalletBalance?: number;
  currency: string;
  createdAt: string;
}

export interface CommissionSettings {
  defaultCommissionRate: number; // e.g. 20%
  userOverrides: Record<string, {
    commissionRate?: number;
    settledCommission?: number;
    settlementNotes?: string;
    lastSettledAt?: string;
  }>;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const COMMISSIONS_FILE = path.join(DATA_DIR, 'commissions_state.json');

const DEFAULT_SETTINGS: CommissionSettings = {
  defaultCommissionRate: 20,
  userOverrides: {},
};

export function loadCommissionSettings(): CommissionSettings {
  try {
    if (fs.existsSync(COMMISSIONS_FILE)) {
      const raw = fs.readFileSync(COMMISSIONS_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
        userOverrides: parsed.userOverrides || {},
      };
    }
  } catch (err: any) {
    console.warn('Failed reading commissions_state.json:', err.message);
  }
  return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
}

export function saveCommissionSettings(settings: CommissionSettings): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(COMMISSIONS_FILE, JSON.stringify(settings, null, 2), 'utf-8');
  } catch (err: any) {
    console.warn('Failed saving commissions_state.json:', err.message);
  }
}

/**
 * Calculates earnings, win rate, and commission for all users/clients
 */
export async function getAllUserCommissionReports(): Promise<{
  reports: UserCommissionRecord[];
  summary: {
    totalClients: number;
    activeClients: number;
    totalNetProfit: number;
    totalCommissionDue: number;
    totalSettledCommission: number;
    totalPendingCommission: number;
    defaultRate: number;
  };
}> {
  const tokens = await getAllAccessTokens();
  const settings = loadCommissionSettings();
  const reports: UserCommissionRecord[] = [];

  let aggregateNetProfit = 0;
  let aggregateCommissionDue = 0;
  let aggregateSettled = 0;
  let aggregatePending = 0;

  for (const t of tokens) {
    const cleanId = cleanUserId(t.code);
    const override = settings.userOverrides[cleanId] || {};
    const commissionRate = override.commissionRate ?? settings.defaultCommissionRate ?? 20;

    // Load individual user's trades (from their isolated forward test state & live trade records)
    const forwardState = loadForwardTestState(cleanId);
    const closed = forwardState.closedTrades || [];

    let grossProfit = 0;
    let grossLoss = 0;
    let wins = 0;
    let losses = 0;
    let todayPnl = 0;
    let lastTradeTime: string | null = null;

    const todayDateStr = new Date().toISOString().slice(0, 10);

    for (const tr of closed) {
      const pnl = Number(tr.realizedPnl || 0);
      if (pnl > 0) {
        grossProfit += pnl;
        wins++;
      } else {
        grossLoss += Math.abs(pnl);
        losses++;
      }

      if (tr.exitTime && tr.exitTime.includes(todayDateStr)) {
        todayPnl += pnl;
      }

      if (!lastTradeTime && tr.exitTime) {
        lastTradeTime = tr.exitTime;
      }
    }

    const netProfit = Number((grossProfit - grossLoss).toFixed(2));
    const totalTrades = closed.length;
    const winRate = totalTrades > 0 ? Number(((wins / totalTrades) * 100).toFixed(1)) : 0;

    // Commission Calculations
    const commissionDue = netProfit > 0 ? Number(((netProfit * commissionRate) / 100).toFixed(2)) : 0;
    const settledCommission = Number((override.settledCommission || 0).toFixed(2));
    const pendingCommission = Number(Math.max(0, commissionDue - settledCommission).toFixed(2));

    let settlementStatus: 'SETTLED' | 'PENDING' | 'NO_PROFIT' = 'NO_PROFIT';
    if (netProfit > 0) {
      settlementStatus = pendingCommission <= 0 ? 'SETTLED' : 'PENDING';
    }

    aggregateNetProfit += netProfit;
    aggregateCommissionDue += commissionDue;
    aggregateSettled += settledCommission;
    aggregatePending += pendingCommission;

    reports.push({
      userId: cleanId,
      tokenCode: t.code,
      clientLabel: t.label || 'Trader Client',
      isActive: t.is_active,
      commissionRate,
      totalTrades,
      winningTrades: wins,
      losingTrades: losses,
      winRate,
      grossProfit: Number(grossProfit.toFixed(2)),
      grossLoss: Number(grossLoss.toFixed(2)),
      netProfit,
      todayPnl: Number(todayPnl.toFixed(2)),
      commissionDue,
      settledCommission,
      pendingCommission,
      settlementStatus,
      lastSettledAt: override.lastSettledAt || null,
      settlementNotes: override.settlementNotes || '',
      lastTradeTime,
      virtualWalletBalance: forwardState.wallet?.balance || 100000,
      currency: 'INR',
      createdAt: t.created_at,
    });
  }

  // Sort: highest pending commission first, then net profit
  reports.sort((a, b) => b.pendingCommission - a.pendingCommission || b.netProfit - a.netProfit);

  return {
    reports,
    summary: {
      totalClients: tokens.length,
      activeClients: tokens.filter((t) => t.is_active).length,
      totalNetProfit: Number(aggregateNetProfit.toFixed(2)),
      totalCommissionDue: Number(aggregateCommissionDue.toFixed(2)),
      totalSettledCommission: Number(aggregateSettled.toFixed(2)),
      totalPendingCommission: Number(aggregatePending.toFixed(2)),
      defaultRate: settings.defaultCommissionRate || 20,
    },
  };
}

/**
 * Updates a specific user's commission rate or marks commission as settled
 */
export async function updateUserCommission(
  userId: string,
  update: {
    commissionRate?: number;
    markSettled?: boolean;
    settledAmount?: number;
    settlementNotes?: string;
  }
): Promise<{ success: boolean; message: string }> {
  const cleanId = cleanUserId(userId);
  const settings = loadCommissionSettings();

  if (!settings.userOverrides[cleanId]) {
    settings.userOverrides[cleanId] = {};
  }

  const existing = settings.userOverrides[cleanId];

  if (typeof update.commissionRate === 'number' && update.commissionRate >= 0 && update.commissionRate <= 100) {
    existing.commissionRate = Number(update.commissionRate);
  }

  if (update.markSettled) {
    if (typeof update.settledAmount === 'number') {
      existing.settledCommission = update.settledAmount;
    }
    existing.lastSettledAt = new Date().toISOString();
  }

  if (update.settlementNotes !== undefined) {
    existing.settlementNotes = update.settlementNotes.trim();
  }

  saveCommissionSettings(settings);

  // Also log in Supabase system_logs for audit
  try {
    const supabase = getAdminSupabase();
    await supabase.from('system_logs').insert({
      level: 'INFO',
      source: 'COMMISSION_SETTLEMENT',
      message: `Updated Commission for Client: ${cleanId}. Rate: ${existing.commissionRate || settings.defaultCommissionRate}%, Settled: ₹${existing.settledCommission || 0}`,
      metadata: { userId: cleanId, update, timestamp: new Date().toISOString() },
    });
  } catch {}

  return { success: true, message: `Commission updated for ${cleanId}` };
}
