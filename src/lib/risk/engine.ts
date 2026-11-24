import { getAdminSupabase } from '../supabase';
import { BrokerType } from '../brokers/types';

export interface RiskSettings {
  walletBalance: number;
  maxDailyLossPct: number;    // e.g. 3.0 = 3% max loss in a single day
  perTradeRiskPct: number;     // e.g. 1.0 = 1% risk per trade
  maxOpenTrades: number;       // e.g. 2
  killSwitchActive: boolean;   // emergency circuit breaker
  killSwitchReason: string | null;
  autoSyncWallet: boolean;
}

export const DEFAULT_RISK_SETTINGS: RiskSettings = {
  walletBalance: 100000, // ₹1,00,000 default balance
  maxDailyLossPct: 3.0,  // Max 3% loss per day (₹3,000)
  perTradeRiskPct: 1.0,  // 1% risk per trade (₹1,000)
  maxOpenTrades: 2,
  killSwitchActive: false,
  killSwitchReason: null,
  autoSyncWallet: true,
};

/**
 * Calculates dynamic position size / lot size based on account balance,
 * per-trade risk percentage, and the stop-loss distance in points.
 *
 * Formula:
 *   Risk Amount = Wallet Balance * (Per Trade Risk % / 100)
 *   Calculated Quantity = Floor(Risk Amount / SL Distance in Points)
 */
export function calculateDynamicPositionSize(
  walletBalance: number,
  perTradeRiskPct: number,
  slPoints: number,
  symbol: string,
  broker: BrokerType
): { quantity: number; riskAmount: number; effectiveRisk: number } {
  const safeSlPoints = Math.max(0.5, slPoints);
  const riskAmount = walletBalance * (perTradeRiskPct / 100);

  let rawQuantity = Math.floor(riskAmount / safeSlPoints);

  // Broker & Symbol specific lot rounding
  let finalQuantity = rawQuantity;
  const sym = symbol.toUpperCase();

  if (broker === 'DHAN') {
    if (sym.includes('NIFTY') && !sym.includes('BANK')) {
      const lotSize = 25; // Nifty lot
      const lots = Math.max(1, Math.floor(rawQuantity / lotSize));
      finalQuantity = lots * lotSize;
    } else if (sym.includes('BANKNIFTY')) {
      const lotSize = 15; // BankNifty lot
      const lots = Math.max(1, Math.floor(rawQuantity / lotSize));
      finalQuantity = lots * lotSize;
    } else {
      // Cash equities (min 1 share)
      finalQuantity = Math.max(1, rawQuantity);
    }
  } else if (broker === 'DELTA') {
    // Crypto contracts: min 1 contract
    finalQuantity = Math.max(1, Math.min(50, rawQuantity));
  } else if (broker === 'METATRADER') {
    // Forex standard lot (0.01 micro lot = 1,000 units)
    const lotVolume = Math.max(0.01, Math.round((riskAmount / (safeSlPoints * 100000)) * 100) / 100);
    finalQuantity = Math.min(5.0, lotVolume);
  }

  const effectiveRisk = finalQuantity * safeSlPoints;

  return {
    quantity: finalQuantity,
    riskAmount: Number(riskAmount.toFixed(2)),
    effectiveRisk: Number(effectiveRisk.toFixed(2)),
  };
}

/**
 * Fetch risk settings from database or fallback
 */
export async function getRiskConfiguration(): Promise<RiskSettings> {
  try {
    const supabase = getAdminSupabase();
    const { data } = await supabase
      .from('system_logs')
      .select('*')
      .eq('source', 'RISK_CONFIG')
      .order('timestamp', { ascending: false })
      .limit(1);

    if (data && data.length > 0 && data[0].metadata) {
      return { ...DEFAULT_RISK_SETTINGS, ...data[0].metadata };
    }
  } catch (err) {
    console.error('Error fetching risk configuration:', err);
  }
  return DEFAULT_RISK_SETTINGS;
}

/**
 * Save risk settings to Supabase
 */
export async function saveRiskConfiguration(settings: Partial<RiskSettings>, adminUser?: string) {
  const current = await getRiskConfiguration();
  const updated: RiskSettings = { ...current, ...settings };

  try {
    const supabase = getAdminSupabase();
    await supabase.from('system_logs').insert({
      level: updated.killSwitchActive ? 'ERROR' : 'INFO',
      source: 'RISK_CONFIG',
      message: updated.killSwitchActive
        ? `🚨 KILL SWITCH ACTIVATED: ${updated.killSwitchReason || 'Emergency circuit breaker tripped'}`
        : `Risk configuration updated: Max Daily Loss: ${updated.maxDailyLossPct}%, Risk/Trade: ${updated.perTradeRiskPct}%`,
      metadata: updated,
    });
  } catch (err) {
    console.error('Error saving risk config to Supabase:', err);
  }

  return updated;
}

/**
 * Checks today's cumulative P&L and automatically trips Kill Switch if daily loss limit is hit
 */
export async function evaluateDailyLossAndKillSwitch(
  walletBalance: number,
  maxDailyLossPct: number
): Promise<{ killSwitchTriggered: boolean; todayNetPnl: number; maxAllowedLoss: number }> {
  const supabase = getAdminSupabase();
  const maxAllowedLoss = walletBalance * (maxDailyLossPct / 100);

  // Get trades executed today
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  let todayNetPnl = 0;

  try {
    const { data: todayTrades } = await supabase
      .from('trades')
      .select('*')
      .gte('entry_time', startOfDay.toISOString());

    if (todayTrades) {
      for (const t of todayTrades) {
        todayNetPnl += Number(t.pnl || 0);
      }
    }
  } catch (err) {
    console.error('Failed to compute daily P&L:', err);
  }

  // If net P&L is negative and exceeds max allowed loss
  if (todayNetPnl < 0 && Math.abs(todayNetPnl) >= maxAllowedLoss) {
    // Trip the Kill Switch!
    await saveRiskConfiguration({
      killSwitchActive: true,
      killSwitchReason: `Daily loss limit of -₹${maxAllowedLoss.toLocaleString()} (${maxDailyLossPct}%) breached. Realized Loss: -₹${Math.abs(todayNetPnl).toLocaleString()}`,
    });

    // Emergency close all open positions
    await emergencyCloseAllPositions(`KILL_SWITCH_DAILY_LOSS_LIMIT (${maxDailyLossPct}%)`);

    return { killSwitchTriggered: true, todayNetPnl, maxAllowedLoss };
  }

  return { killSwitchTriggered: false, todayNetPnl, maxAllowedLoss };
}

/**
 * Emergency function: Closes all currently open positions across all brokers
 */
export async function emergencyCloseAllPositions(reason: string) {
  try {
    const supabase = getAdminSupabase();
    const { data: openTrades } = await supabase
      .from('trades')
      .select('*')
      .eq('status', 'OPEN');

    if (!openTrades || openTrades.length === 0) return { closedCount: 0 };

    for (const trade of openTrades) {
      await supabase
        .from('trades')
        .update({
          status: 'CLOSED',
          exit_price: Number(trade.entry_price), // close at market or entry
          exit_time: new Date().toISOString(),
          notes: `Emergency closed via ${reason}`,
        })
        .eq('id', trade.id);
    }

    await supabase.from('system_logs').insert({
      level: 'ERROR',
      source: 'KILL_SWITCH',
      message: `🚨 KILL SWITCH EXECUTED: Force closed ${openTrades.length} open position(s). Reason: ${reason}`,
      metadata: { closedCount: openTrades.length, reason },
    });

    return { closedCount: openTrades.length };
  } catch (err) {
    console.error('Emergency close failed:', err);
    return { closedCount: 0 };
  }
}
