import { getAdminSupabase } from '../supabase';
import { BrokerType } from '../brokers/types';

export interface RiskSettings {
  walletBalance: number;
  maxDailyLossPct: number;    // e.g. 15.0 = 15% max loss in a single day
  perTradeRiskPct: number;     // e.g. 5.0 = 5% risk per trade
  maxOpenTrades: number;       // e.g. 2
  killSwitchActive: boolean;   // emergency circuit breaker
  killSwitchReason: string | null;
  autoSyncWallet: boolean;
  lastKillSwitchTriggerTime?: string | null; // ISO timestamp when kill switch was triggered
}

export const DEFAULT_RISK_SETTINGS: RiskSettings = {
  walletBalance: 100000, // ₹1,00,000 default balance
  maxDailyLossPct: 15.0, // Max 15% overall loss per day
  perTradeRiskPct: 5.0,  // 5% risk per trade
  maxOpenTrades: 2,
  killSwitchActive: false,
  killSwitchReason: null,
  autoSyncWallet: true,
  lastKillSwitchTriggerTime: null,
};

// In-memory runtime cache for serverless & server process persistence
let runtimeRiskConfig: RiskSettings = { ...DEFAULT_RISK_SETTINGS };

/**
 * Calculates the start of the current trading cycle anchored at 01:00 AM IST (UTC+5:30).
 * 
 * At 01:00 AM IST every day:
 * - Realized Daily P&L resets to 0.
 * - Daily trade count (Max 3 trades a day) resets to 0.
 * - Daily loss kill switch auto-resets so the new trading day starts fresh.
 */
export function getISTCycleStartTime(resetHourIST: number = 1): Date {
  const now = new Date();
  const istOffsetMs = 5.5 * 60 * 60 * 1000; // +05:30 in milliseconds
  
  // Shift current UTC time to IST virtual clock representation
  const istDate = new Date(now.getTime() + istOffsetMs);
  
  // Set to today's 01:00 AM in IST
  const cycleStartIST = new Date(istDate);
  cycleStartIST.setUTCHours(resetHourIST, 0, 0, 0);
  
  // If current IST time is before 01:00 AM (e.g. 00:30 AM), cycle began yesterday at 01:00 AM IST
  if (istDate.getUTCHours() < resetHourIST) {
    cycleStartIST.setUTCDate(cycleStartIST.getUTCDate() - 1);
  }
  
  // Convert back to standard UTC Date object
  return new Date(cycleStartIST.getTime() - istOffsetMs);
}

/**
 * Returns descriptive info about the IST trading cycle
 */
export function getISTCycleInfo() {
  const cycleStart = getISTCycleStartTime(1);
  const nextReset = new Date(cycleStart.getTime() + 24 * 60 * 60 * 1000);
  return {
    cycleStartUtc: cycleStart.toISOString(),
    nextResetUtc: nextReset.toISOString(),
    cycleResetTimeIST: '01:00 AM IST',
    description: 'Trading cycle runs from 01:00 AM IST to 01:00 AM IST next day',
  };
}

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
  } else if (broker === 'DELTA' || sym.includes('BTC') || sym.includes('ETH') || sym.includes('SOL') || sym.includes('XRP')) {
    // Crypto contracts: min 1 contract (BTC, ETH, SOL, XRP)
    finalQuantity = Math.max(1, rawQuantity);
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
 * Smart Balance-Aware Leverage Calculator
 *
 * Dynamically computes optimal leverage according to:
 * 1. Account Wallet Balance (conservative for smaller balance, optimal for healthy balance)
 * 2. Stop Loss Distance % (guarantees liquidation distance is at least 3.5x further than SL)
 * 3. Asset & Broker limits (Delta: 50x-100x max, Dhan: 5x max, MT5: 30x max)
 */
export function calculateSmartLeverage(
  walletBalance: number,
  entryPrice: number,
  stopLossPrice: number,
  broker: BrokerType,
  symbol: string
): { leverage: number; reason: string } {
  const safeEntry = Math.max(1, entryPrice);
  const slDist = Math.max(0.5, Math.abs(entryPrice - stopLossPrice));
  const slPct = (slDist / safeEntry) * 100;

  // 1. Liquidation distance protection (ensures liquidation price is at least 3.5x further than SL)
  const maxSafeFromSL = Math.max(2, Math.floor(100 / (Math.max(0.2, slPct) * 3.5)));

  // 2. Account Balance scaling
  let balanceCap = 25;
  if (walletBalance < 25000) {
    // Smaller account: strictly conservative
    balanceCap = 10;
  } else if (walletBalance < 100000) {
    // Medium account: balanced leverage
    balanceCap = 20;
  } else {
    // Healthy capital: allows higher efficiency
    balanceCap = 50;
  }

  // 3. Broker & Asset ceilings
  let brokerMax = 50;
  const sym = symbol.toUpperCase();
  if (broker === 'DELTA') {
    brokerMax = (sym.includes('BTC') || sym.includes('ETH')) ? 100 : 50;
  } else if (broker === 'DHAN') {
    brokerMax = 5; // Regulatory intraday limit
  } else if (broker === 'METATRADER') {
    brokerMax = 30;
  }

  // Final Smart Leverage
  const finalLeverage = Math.max(2, Math.min(brokerMax, maxSafeFromSL, balanceCap));
  const reason = `Smart Leverage: ${finalLeverage}x (SL: ${slPct.toFixed(2)}% | Balance: ₹${Math.round(walletBalance).toLocaleString('en-IN')})`;

  return { leverage: finalLeverage, reason };
}

/**
 * Fetch risk settings from database or in-memory runtime cache
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
      runtimeRiskConfig = { ...runtimeRiskConfig, ...data[0].metadata };
      return runtimeRiskConfig;
    }
  } catch (err) {
    console.error('Error fetching risk configuration from DB:', err);
  }
  return runtimeRiskConfig;
}

/**
 * Save risk settings to Supabase and update runtime memory cache
 */
export async function saveRiskConfiguration(settings: Partial<RiskSettings>, adminUser?: string) {
  const current = await getRiskConfiguration();
  const updated: RiskSettings = { ...current, ...settings };

  // Track kill switch trigger timestamp or clear it upon disarming
  if (settings.killSwitchActive === true && !updated.lastKillSwitchTriggerTime) {
    updated.lastKillSwitchTriggerTime = new Date().toISOString();
  } else if (settings.killSwitchActive === false) {
    updated.lastKillSwitchTriggerTime = null;
  }

  runtimeRiskConfig = updated;

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
 * Checks today's cumulative P&L since 01:00 AM IST and automatically trips Kill Switch if daily loss limit is hit.
 * Also automatically disarms the kill switch if a previous daily loss trip belongs to a prior 01:00 AM IST cycle.
 */
export async function evaluateDailyLossAndKillSwitch(
  walletBalance: number,
  maxDailyLossPct: number
): Promise<{ killSwitchTriggered: boolean; todayNetPnl: number; maxAllowedLoss: number; cycleStartTime: string }> {
  const cycleStart = getISTCycleStartTime(1);
  const supabase = getAdminSupabase();
  const maxAllowedLoss = walletBalance * (maxDailyLossPct / 100);

  // Check if kill switch was tripped by daily loss in an older cycle (before 01:00 AM IST today)
  if (runtimeRiskConfig.killSwitchActive) {
    const isDailyLossReason = runtimeRiskConfig.killSwitchReason?.toLowerCase().includes('daily loss');
    const triggerTime = runtimeRiskConfig.lastKillSwitchTriggerTime
      ? new Date(runtimeRiskConfig.lastKillSwitchTriggerTime).getTime()
      : 0;

    // If tripped by daily loss and the trip was prior to current 01:00 AM IST cycle start -> auto-disarm!
    if (isDailyLossReason && triggerTime > 0 && triggerTime < cycleStart.getTime()) {
      console.log('🔄 New 01:00 AM IST cycle reached! Auto-disarming daily loss kill switch...');
      await saveRiskConfiguration({
        killSwitchActive: false,
        killSwitchReason: null,
      });

      try {
        await supabase.from('system_logs').insert({
          level: 'INFO',
          source: 'CYCLE_RESET',
          message: '🔄 01:00 AM IST Daily Reset: Daily loss circuit breaker disarmed for the new cycle.',
          metadata: { cycleStartTime: cycleStart.toISOString() },
        });
      } catch {}
    } else {
      return {
        killSwitchTriggered: true,
        todayNetPnl: 0,
        maxAllowedLoss,
        cycleStartTime: cycleStart.toISOString(),
      };
    }
  }

  // Get trades executed in the current cycle (since 01:00 AM IST)
  let todayNetPnl = 0;

  try {
    const { data: todayTrades } = await supabase
      .from('trades')
      .select('*')
      .gte('entry_time', cycleStart.toISOString());

    if (todayTrades) {
      for (const t of todayTrades) {
        todayNetPnl += Number(t.pnl || 0);
      }
    }
  } catch (err) {
    console.error('Failed to compute daily P&L for 01:00 AM IST cycle:', err);
  }

  // If net P&L is negative and exceeds max allowed loss (15%)
  if (todayNetPnl < 0 && Math.abs(todayNetPnl) >= maxAllowedLoss) {
    // Trip the Kill Switch!
    await saveRiskConfiguration({
      killSwitchActive: true,
      killSwitchReason: `Daily loss limit of -₹${maxAllowedLoss.toLocaleString()} (${maxDailyLossPct}%) breached. Realized Loss: -₹${Math.abs(todayNetPnl).toLocaleString()}`,
      lastKillSwitchTriggerTime: new Date().toISOString(),
    });

    // Emergency close all open positions
    await emergencyCloseAllPositions(`KILL_SWITCH_DAILY_LOSS_LIMIT (${maxDailyLossPct}%)`);

    return { killSwitchTriggered: true, todayNetPnl, maxAllowedLoss, cycleStartTime: cycleStart.toISOString() };
  }

  return { killSwitchTriggered: false, todayNetPnl, maxAllowedLoss, cycleStartTime: cycleStart.toISOString() };
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
          exit_price: Number(trade.entry_price || 0),
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
