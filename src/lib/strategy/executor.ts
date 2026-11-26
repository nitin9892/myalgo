import { getAdminSupabase } from '../supabase';
import { getBrokerAdapter } from '../brokers';
import { evaluatePrevDayBreakout, ActivePositionState, KeyLevels, BreakoutStrategyParams } from './prev_day_breakout';
import { 
  getRiskConfiguration, 
  evaluateDailyLossAndKillSwitch, 
  calculateDynamicPositionSize,
  calculateSmartLeverage,
  getISTCycleStartTime
} from '../risk/engine';
import { BrokerType, OrderRequest } from '../brokers/types';

export interface SingleStrategyConfig {
  id: string;
  name: string;
  broker_name: BrokerType;
  symbol: string;
  timeframe: string;
  is_active: boolean;
  paper_trading: boolean;
  params: {
    sl_candle_mode: 'signal_candle' | 'prev_candle';
    max_trades_per_day: number;
    lot_size: number;
    trail_step_points: number;
    trail_amount_points: number;
    session_start: string;
    no_trade_start: string;
    no_trade_end: string;
    square_off_time: string;
    prev_high?: number;
    prev_low?: number;
    prev_close?: number;
    symbols?: string[];
    [key: string]: any;
  };
}

export const DEFAULT_MASTER_STRATEGY: SingleStrategyConfig = {
  id: 'strategy-c-6setups',
  name: 'Strategy C',
  broker_name: 'DELTA',
  symbol: 'BTCUSD',
  timeframe: '5m',
  is_active: true,
  paper_trading: false,
  params: {
    sl_candle_mode: 'signal_candle',
    max_trades_per_day: 3,
    lot_size: 1,
    trail_step_points: 10,
    trail_amount_points: 3,
    session_start: '00:00',
    no_trade_start: '00:00',
    no_trade_end: '00:00',
    square_off_time: '23:59',
    leverage_mode: 'MANUAL',
    leverage: 10,
  },
};

async function resolveKeyLevels(
  adapter: any,
  symbol: string,
  candles: any[],
  currentPrice: number,
  params: any
): Promise<KeyLevels> {
  let prevHigh = Number(params?.prev_high);
  let prevLow = Number(params?.prev_low);
  let prevClose = Number(params?.prev_close);

  if (prevHigh > 0 && prevLow > 0 && prevClose > 0) {
    return { prevHigh, prevLow, prevClose };
  }

  // Attempt to fetch true 1D (daily) candles for exact Yesterday High (PDH), Low (PDL), Close (PDC)
  try {
    const dailyCandles = await adapter.getLatestCandles(symbol, '1d', 5);
    if (dailyCandles && dailyCandles.length >= 2) {
      const yesterday = dailyCandles[dailyCandles.length - 2];
      if (yesterday && yesterday.high > 0 && yesterday.low > 0 && yesterday.close > 0) {
        return {
          prevHigh: Number(yesterday.high.toFixed(2)),
          prevLow: Number(yesterday.low.toFixed(2)),
          prevClose: Number(yesterday.close.toFixed(2)),
        };
      }
    }
  } catch {}

  // Fallback: derive from 5m candles history
  if (candles && candles.length >= 15) {
    const lookback = candles.slice(0, Math.max(1, candles.length - 10));
    const highs = lookback.map((c) => c.high);
    const lows = lookback.map((c) => c.low);
    prevHigh = Math.max(...highs);
    prevLow = Math.min(...lows);
    prevClose = lookback[lookback.length - 1]?.close || currentPrice;
    return {
      prevHigh: Number(prevHigh.toFixed(2)),
      prevLow: Number(prevLow.toFixed(2)),
      prevClose: Number(prevClose.toFixed(2)),
    };
  }

  return {
    prevHigh: Number((currentPrice * 1.015).toFixed(2)),
    prevLow: Number((currentPrice * 0.985).toFixed(2)),
    prevClose: Number(currentPrice.toFixed(2)),
  };
}

export async function runTradingEngineCycle() {
  const supabase = getAdminSupabase();
  const logs: string[] = [];

  try {
    // ------------------------------------------------------------------------
    // 0. RISK ENGINE & KILL SWITCH EVALUATION
    // ------------------------------------------------------------------------
    const riskConfig = await getRiskConfiguration();
    const riskEval = await evaluateDailyLossAndKillSwitch(
      riskConfig.walletBalance,
      riskConfig.maxDailyLossPct
    );

    if (riskConfig.killSwitchActive || riskEval.killSwitchTriggered) {
      const reason = riskConfig.killSwitchReason || `Daily Loss Limit (-${riskConfig.maxDailyLossPct}%) breached`;
      logs.push(`🚨 KILL SWITCH ACTIVE: Trading halted for today. (${reason})`);
      return { success: false, killSwitchActive: true, count: 0, logs };
    }

    // ------------------------------------------------------------------------
    // 1. FETCH THE SINGLE MASTER STRATEGY CONFIG
    // ------------------------------------------------------------------------
    let masterStrategy: SingleStrategyConfig = DEFAULT_MASTER_STRATEGY;

    try {
      const { data } = await supabase
        .from('strategies')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        masterStrategy = {
          id: data.id,
          name: data.name || DEFAULT_MASTER_STRATEGY.name,
          broker_name: (data.broker_name as BrokerType) || DEFAULT_MASTER_STRATEGY.broker_name,
          symbol: data.symbol || DEFAULT_MASTER_STRATEGY.symbol,
          timeframe: data.timeframe || '5m',
          is_active: data.is_active !== undefined ? Boolean(data.is_active) : true,
          paper_trading: false,
          params: { ...DEFAULT_MASTER_STRATEGY.params, ...(data.parameters || {}) },
        };
      }
    } catch (dbErr: any) {
      console.warn('Could not read custom strategy from DB, using master defaults:', dbErr.message);
    }

    if (!masterStrategy.is_active) {
      logs.push(`⚪ ALGO SWITCH IS OFF: Master strategy [${masterStrategy.name}] is currently PAUSED. Turn switch ON from Dashboard to resume automated trading.`);
      return { success: true, count: 0, logs, algoPaused: true };
    }

    // ------------------------------------------------------------------------
    // 2. FETCH 5M CANDLE FEED & CONNECT ADAPTER
    // ------------------------------------------------------------------------
    const adapter = getBrokerAdapter(masterStrategy.broker_name);
    
    // Support multiple instruments scanner (BTC, ETH, SOL, XRP)
    const targetSymbols: string[] = (masterStrategy.params?.symbols && Array.isArray(masterStrategy.params.symbols) && masterStrategy.params.symbols.length > 0)
      ? masterStrategy.params.symbols
      : masterStrategy.symbol.split(',').map((x: string) => x.trim()).filter(Boolean);
    const activeSymbol = targetSymbols[0] || 'BTCUSD';

    const candles = await adapter.getLatestCandles(activeSymbol, masterStrategy.timeframe || '5m', 60);

    if (candles.length < 5) {
      logs.push(`[${masterStrategy.name}] Waiting for 5m candle data for ${activeSymbol} (${candles.length}/5 candles).`);
      return { success: true, count: 1, logs };
    }

    const currentPrice = candles[candles.length - 1].close;

    // Check open trade for this strategy
    const { data: openTrades } = await supabase
      .from('trades')
      .select('*')
      .eq('status', 'OPEN');

    const activeTrade = openTrades && openTrades.length > 0 ? openTrades[0] : null;

    // ------------------------------------------------------------------------
    // 3. KEY LEVELS (PREV HIGH [PDH], PREV LOW [PDL], PREV CLOSE [PDC])
    // ------------------------------------------------------------------------
    const levels: KeyLevels = await resolveKeyLevels(
      adapter,
      activeSymbol,
      candles,
      currentPrice,
      masterStrategy.params
    );

    const p = masterStrategy.params;
    const strategyParams: BreakoutStrategyParams = {
      slCandleMode: p.sl_candle_mode || 'signal_candle',
      maxTradesPerDay: p.max_trades_per_day || 3,
      lotSize: p.lot_size || 50,
      trailStepPoints: p.trail_step_points || 10,
      trailAmountPoints: p.trail_amount_points || 3,
      sessionStart: p.session_start || '09:15',
      noTradeStart: p.no_trade_start || '11:00',
      noTradeEnd: p.no_trade_end || '13:00',
      squareOffTime: p.square_off_time || '15:30',
    };

    let activePosState: ActivePositionState | null = null;
    if (activeTrade) {
      activePosState = {
        tradeId: activeTrade.id,
        symbol: masterStrategy.symbol,
        side: activeTrade.side as 'BUY' | 'SELL',
        entryPrice: Number(activeTrade.entry_price),
        initialSlPrice: Number(activeTrade.stop_loss),
        initialSlPoints: Math.abs(Number(activeTrade.entry_price) - Number(activeTrade.stop_loss)),
        initialTargetPrice: Number(activeTrade.take_profit),
        currentSlPrice: Number(activeTrade.stop_loss),
        currentTargetPrice: Number(activeTrade.take_profit),
        trailingMilestones: activeTrade.metadata?.trailingMilestones || 0,
        highestFavorablePoints: activeTrade.metadata?.highestFavorable || 0,
        entryTime: activeTrade.entry_time,
      };
    }

    // ------------------------------------------------------------------------
    // 4. EVALUATE 5M CANDLE BREAKOUT SETUP
    // ------------------------------------------------------------------------
    const evalRes = evaluatePrevDayBreakout(
      candles,
      levels,
      strategyParams,
      activePosState,
      currentPrice
    );

    // 4.1 EXIT TRIGGERS (SL Hit, 1:3 Target Hit, or 15:30 Force Square-Off)
    if (activeTrade && evalRes.exitSignal?.shouldExit) {
      const exitReason = evalRes.exitSignal.reason || 'MANUAL_EXIT';
      const exitPrice = evalRes.exitSignal.exitPrice || currentPrice;
      const entryPrice = Number(activeTrade.entry_price);
      const qty = Number(activeTrade.quantity);

      const isBuy = activeTrade.side === 'BUY';
      const pnl = isBuy ? (exitPrice - entryPrice) * qty : (entryPrice - exitPrice) * qty;
      const pnlPct = (pnl / (entryPrice * qty)) * 100;
      const exitSide = isBuy ? 'SELL' : 'BUY';

      await adapter.placeOrder({
        symbol: masterStrategy.symbol,
        side: exitSide,
        quantity: qty,
        orderType: 'MARKET',
        paperTrade: masterStrategy.paper_trading,
      });

      await supabase
        .from('trades')
        .update({
          status: 'CLOSED',
          exit_price: exitPrice,
          exit_time: new Date().toISOString(),
          pnl: Number(pnl.toFixed(2)),
          pnl_percentage: Number(pnlPct.toFixed(2)),
          notes: `Closed via ${exitReason} @ ${exitPrice}`,
        })
        .eq('id', activeTrade.id);

      await supabase.from('system_logs').insert({
        level: 'TRADE_SIGNAL',
        source: `EXIT_${masterStrategy.broker_name}`,
        message: `[${masterStrategy.name}] POSITION CLOSED: ${exitReason} for ${masterStrategy.symbol} @ ${exitPrice} | P&L: ₹${pnl.toFixed(2)} (${pnlPct.toFixed(2)}%)`,
        metadata: { exitReason, exitPrice, pnl },
      });

      logs.push(`EXIT: Closed position via ${exitReason} @ ${exitPrice} (P&L: ₹${pnl.toFixed(2)})`);
      return { success: true, count: 1, logs };
    }

    // 4.2 STEP TRAILING UPDATE (+3 pts SL & Target for every +10 pts favorable)
    if (activeTrade && evalRes.trailingUpdate) {
      const { newSl, newTarget, milestone, pointsTrailed } = evalRes.trailingUpdate;

      await supabase
        .from('trades')
        .update({
          stop_loss: newSl,
          take_profit: newTarget,
          notes: `Trailed SL to ${newSl}, Target to ${newTarget} (Milestone #${milestone})`,
        })
        .eq('id', activeTrade.id);

      await supabase.from('system_logs').insert({
        level: 'INFO',
        source: 'TRAILING_ENGINE',
        message: `[${masterStrategy.name}] TRAILING STEP #${milestone}: Trailed SL by +${pointsTrailed} pts to ${newSl}, Target to ${newTarget}`,
        metadata: evalRes.trailingUpdate,
      });

      logs.push(`TRAIL: Step #${milestone} reached! Trailed SL to ${newSl}, Target to ${newTarget}`);
      return { success: true, count: 1, logs };
    }

    // 4.25 CHECK MAX TRADES PER DAY LIMIT (Default: 3, resets at 01:00 AM IST)
    const maxTradesPerDay = masterStrategy.params?.max_trades_per_day || 3;
    const cycleStart = getISTCycleStartTime(1);

    const { data: todayTrades } = await supabase
      .from('trades')
      .select('id')
      .gte('entry_time', cycleStart.toISOString());

    if (todayTrades && todayTrades.length >= maxTradesPerDay) {
      logs.push(`[${masterStrategy.name}] Daily maximum trades limit (${maxTradesPerDay}) reached for current cycle (since 01:00 AM IST).`);
      return { success: true, count: 0, logs };
    }

    // 4.3 ENTRY SIGNAL TRIGGER (5m Green breakout -> Buy at High | 5m Red breakout -> Sell at Low)
    if (!activeTrade && evalRes.signal) {
      const signal = evalRes.signal;
      const entryPrice = evalRes.entryPrice || currentPrice;
      const stopLoss = evalRes.stopLoss || 0;
      const takeProfit = evalRes.target || 0;
      const slPoints = evalRes.slPoints || Math.abs(entryPrice - stopLoss);

      // Smart Leverage calculation based on live wallet balance & Stop Loss distance
      const isManual = String(p.leverage_mode || '').toUpperCase() === 'MANUAL';
      let appliedLeverage: number;
      let levTag = '';

      if (isManual) {
        appliedLeverage = Math.max(1, Math.min(100, Number(p.leverage) || 10));
        levTag = `Manual Leverage: ${appliedLeverage}x`;
      } else {
        const smart = calculateSmartLeverage(
          riskConfig.walletBalance,
          entryPrice,
          stopLoss,
          masterStrategy.broker_name,
          activeSymbol
        );
        appliedLeverage = smart.leverage;
        levTag = smart.reason;
      }

      // Dynamic Lot Sizing based on risk % and SL distance in points
      const sizing = calculateDynamicPositionSize(
        riskConfig.walletBalance,
        riskConfig.perTradeRiskPct,
        slPoints,
        activeSymbol,
        masterStrategy.broker_name
      );

      const orderResult = await adapter.placeOrder({
        symbol: activeSymbol,
        side: signal,
        quantity: sizing.quantity,
        orderType: 'MARKET',
        price: entryPrice,
        stopLoss,
        takeProfit,
        paperTrade: masterStrategy.paper_trading,
        leverage: appliedLeverage,
      });

      if (orderResult.success) {
        const setupTag = evalRes.setupName ? `[${evalRes.setupName}]` : '[Breakout Engine]';
        await supabase.from('trades').insert({
          strategy_id: masterStrategy.id,
          broker_name: masterStrategy.broker_name,
          symbol: activeSymbol,
          side: signal,
          quantity: sizing.quantity,
          entry_price: entryPrice,
          stop_loss: stopLoss,
          take_profit: takeProfit,
          status: 'OPEN',
          paper_trade: masterStrategy.paper_trading,
          broker_order_id: orderResult.orderId,
          notes: `${setupTag} ${evalRes.signalReason} | Dynamic Qty: ${sizing.quantity} | ${levTag} (Risk: ₹${sizing.effectiveRisk})`,
        });

        await supabase.from('system_logs').insert({
          level: 'TRADE_SIGNAL',
          source: `ENGINE_${masterStrategy.broker_name}`,
          message: `[${masterStrategy.name}] ${setupTag} ENTRY TRIGGERED: ${signal} ${sizing.quantity} ${activeSymbol} @ ${entryPrice} (SL: ${stopLoss}, 1:3 TP: ${takeProfit}) | Risk: ₹${sizing.effectiveRisk}`,
          metadata: { orderResult, sizing, evalRes, levels },
        });

        logs.push(`SUCCESS: Placed ${signal} order (${sizing.quantity} qty) @ ${entryPrice} via ${setupTag}`);
        return { success: true, count: 1, logs };
      }
    }

    const statusNote = evalRes.pendingSetup
      ? `[${evalRes.pendingSetup.setupName}] Waiting for trigger @ ${evalRes.pendingSetup.triggerPrice}`
      : (evalRes.blockReason || 'SCANNING 5M FEED');

    logs.push(`[${masterStrategy.name}] Price: ${currentPrice} | Levels: PDH ${levels.prevHigh}, PDL ${levels.prevLow}, PDC ${levels.prevClose} | Status: ${statusNote} | Position: ${activeTrade ? 'ACTIVE' : 'NONE'}`);
    return { success: true, count: 1, logs };
  } catch (err: any) {
    logs.push(`Engine Error: ${err.message}`);
    return { success: false, error: err.message, logs };
  }
}
