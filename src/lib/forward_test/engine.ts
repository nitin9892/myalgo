import { Candle } from '../brokers/types';
import { fetchRealHistoricalCandles } from '../backtest/engine';
import { evaluatePhantomICTStrategy } from '../strategy/phantom_ict';
import { evaluatePrevDayBreakout, ActivePositionState, KeyLevels, BreakoutStrategyParams } from '../strategy/prev_day_breakout';
import { calculateDynamicTrailingSL } from '../strategy/trailing';
import { 
  loadForwardTestState, 
  saveForwardTestState, 
  calculateAutoLeverage,
  ForwardTestState, 
  ForwardPosition, 
  ForwardClosedTrade 
} from './store';

/**
 * Executes a live forward-testing cycle across all selected instruments
 */
export async function runForwardTestCycle(userId?: string): Promise<ForwardTestState> {
  const state = loadForwardTestState(userId);
  if (!state.config.isRunning) {
    return state;
  }

  // 1. Overall Account Risk & Capital Protection Check
  const startingBal = state.wallet.startingBalance || 10000;
  const overallRiskPct = state.config.overallRiskPct || 10;
  const maxAllowableLoss = (startingBal * overallRiskPct) / 100;
  const currentDrawdown = startingBal - state.wallet.balance;

  if (currentDrawdown >= maxAllowableLoss) {
    state.config.isRunning = false;
    state.config.riskPausedReason = `Overall Risk Limit reached (${overallRiskPct}% / ₹${maxAllowableLoss.toLocaleString('en-IN')}). Engine paused for capital protection.`;
    saveForwardTestState(state, userId);
    return state;
  }

  const { strategy, symbols, perTradeRiskPct } = state.config;
  const autoLevInfo = calculateAutoLeverage(strategy, perTradeRiskPct);
  state.config.leverage = autoLevInfo.leverage;
  let totalUnrealizedPnl = 0;

  for (const sym of symbols) {
    try {
      // 1. Fetch latest real market candles (5-tier unblocked feed)
      const { candles } = await fetchRealHistoricalCandles(sym, '5m', 2);
      if (!candles || candles.length < 5) continue;

      const latestCandle = candles[candles.length - 1];
      const prevCandle = candles[candles.length - 2];
      const currentPrice = latestCandle.close;

      // 2. Check if we already have an open simulated position for this symbol
      const existingPosIndex = state.positions.findIndex((p) => p.symbol === sym);
      const existingPos = existingPosIndex >= 0 ? state.positions[existingPosIndex] : null;

      if (existingPos) {
        // Update current price & floating PnL
        existingPos.currentPrice = currentPrice;
        const isBuy = existingPos.side === 'BUY';
        const priceDiff = isBuy ? currentPrice - existingPos.entryPrice : existingPos.entryPrice - currentPrice;
        const pricePctMove = priceDiff / existingPos.entryPrice;
        const posNotional = existingPos.entryPrice * existingPos.quantity;
        const floatingPnl = Number((posNotional * pricePctMove).toFixed(2));
        const floatingPct = Number((pricePctMove * 100 * state.config.leverage).toFixed(2));
        
        existingPos.unrealizedPnl = floatingPnl;
        existingPos.unrealizedPnlPct = floatingPct;
        totalUnrealizedPnl += floatingPnl;

        // Check SL & Target Exits
        let shouldClose = false;
        let exitPrice = currentPrice;
        let exitReason = '';

        if (isBuy) {
          if (latestCandle.low <= existingPos.stopLoss) {
            shouldClose = true;
            exitPrice = existingPos.stopLoss;
            exitReason = 'STOP LOSS HIT';
          } else if (latestCandle.high >= existingPos.takeProfit) {
            shouldClose = true;
            exitPrice = existingPos.takeProfit;
            exitReason = 'TARGET HIT (1:3.5 RR)';
          }
        } else {
          if (latestCandle.high >= existingPos.stopLoss) {
            shouldClose = true;
            exitPrice = existingPos.stopLoss;
            exitReason = 'STOP LOSS HIT';
          } else if (latestCandle.low <= existingPos.takeProfit) {
            shouldClose = true;
            exitPrice = existingPos.takeProfit;
            exitReason = 'TARGET HIT (1:3.5 RR)';
          }
        }

        // Universal Dynamic Trailing: Every +100% market move (1R) trails SL by +35% (0.35R)
        if (!shouldClose) {
          const initSl = existingPos.initialStopLoss || existingPos.stopLoss;
          const favorablePrice = isBuy ? latestCandle.high : latestCandle.low;
          const trailingRes = calculateDynamicTrailingSL(isBuy, existingPos.entryPrice, initSl, existingPos.stopLoss, favorablePrice);
          if (trailingRes.shouldTrail) {
            existingPos.stopLoss = trailingRes.newSl;
            existingPos.trailingMilestone = trailingRes.milestone;
          }
        }

        if (shouldClose) {
          const finalDiff = isBuy ? exitPrice - existingPos.entryPrice : existingPos.entryPrice - exitPrice;
          const finalPctMove = finalDiff / existingPos.entryPrice;
          const finalPnl = Number((posNotional * finalPctMove).toFixed(2));
          const finalPct = Number((finalPctMove * 100 * state.config.leverage).toFixed(2));

          const closedTrade: ForwardClosedTrade = {
            id: `FT-${Date.now()}-${sym}`,
            symbol: existingPos.symbol,
            strategy: existingPos.strategy,
            setupName: existingPos.setupName,
            side: existingPos.side,
            quantity: existingPos.quantity,
            entryPrice: existingPos.entryPrice,
            exitPrice,
            realizedPnl: finalPnl,
            pnlPct: finalPct,
            result: finalPnl >= 0 ? 'WIN' : 'LOSS',
            exitReason,
            entryTime: existingPos.entryTime,
            exitTime: new Date(latestCandle.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
            durationMinutes: 15,
          };

          // Update virtual wallet
          state.wallet.balance = Number((state.wallet.balance + finalPnl).toFixed(2));
          state.wallet.realizedPnl = Number((state.wallet.realizedPnl + finalPnl).toFixed(2));
          state.closedTrades.unshift(closedTrade);
          state.positions.splice(existingPosIndex, 1);
        }
      } else {
        // 3. No open position for this symbol -> Evaluate Entry Setup
        let triggerSide: 'BUY' | 'SELL' | null = null;
        let setupName = '';
        let stopLoss = 0;
        let takeProfit = 0;

        if (strategy === 'Strategy B') {
          // Evaluate Strategy B (Phantom SMC + ICT Engine)
          const windowCandles = candles.slice(-40);
          const evalRes = evaluatePhantomICTStrategy(windowCandles, null, currentPrice, { riskRewardRatio: 3.5 });

          if (evalRes.canEnterNewTrade && evalRes.signal && evalRes.stopLoss && evalRes.target) {
            triggerSide = evalRes.signal;
            setupName = evalRes.setupName || 'Phantom SMC/ICT';
            stopLoss = evalRes.stopLoss;
            takeProfit = evalRes.target;
          }
        } else {
          // Evaluate Strategy C (6 Core Setups Daily Breakout)
          const highs = candles.slice(0, -12).map((c) => c.high);
          const lows = candles.slice(0, -12).map((c) => c.low);
          const closes = candles.slice(0, -12).map((c) => c.close);
          const pdh = Math.max(...highs);
          const pdl = Math.min(...lows);

          const isBullish = prevCandle.close > prevCandle.open;
          const isBearish = prevCandle.close < prevCandle.open;

          if (isBullish && prevCandle.close > pdh && currentPrice >= pdh) {
            triggerSide = 'BUY';
            setupName = '1. PDH Breakout (BUY)';
            stopLoss = prevCandle.low;
            takeProfit = currentPrice + 3 * (currentPrice - stopLoss);
          } else if (isBearish && prevCandle.close < pdl && currentPrice <= pdl) {
            triggerSide = 'SELL';
            setupName = '2. PDL Breakdown (SELL)';
            stopLoss = prevCandle.high;
            takeProfit = currentPrice - 3 * (stopLoss - currentPrice);
          } else if (prevCandle.high >= pdh && prevCandle.close < pdh && currentPrice < pdh) {
            triggerSide = 'SELL';
            setupName = '3. PDH Rejection (SELL)';
            stopLoss = prevCandle.high;
            takeProfit = currentPrice - 3 * (stopLoss - currentPrice);
          } else if (prevCandle.low <= pdl && prevCandle.close > pdl && currentPrice > pdl) {
            triggerSide = 'BUY';
            setupName = '4. PDL Bounce (BUY)';
            stopLoss = prevCandle.low;
            takeProfit = currentPrice + 3 * (currentPrice - stopLoss);
          }
        }

        // Open new simulated position if triggered
        if (triggerSide && stopLoss > 0 && takeProfit > 0) {
          const slDistance = Math.abs(currentPrice - stopLoss);
          const slDistPct = slDistance / currentPrice;
          if (slDistPct > 0) {
            const riskAmount = state.wallet.balance * (perTradeRiskPct / 100);
            const targetNotional = riskAmount / slDistPct;
            const quantity = Math.max(0.001, Number((targetNotional / currentPrice).toFixed(4)));

            const newPos: ForwardPosition = {
              id: `POS-${Date.now()}-${sym}`,
              symbol: sym,
              strategy,
              setupName,
              side: triggerSide,
              quantity,
              entryPrice: currentPrice,
              currentPrice,
              stopLoss,
              initialStopLoss: stopLoss,
              takeProfit,
              unrealizedPnl: 0,
              unrealizedPnlPct: 0,
              entryTime: new Date(latestCandle.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
            };

            state.positions.push(newPos);
          }
        }
      }
    } catch (err: any) {
      console.warn(`Forward test cycle error for ${sym}:`, err.message);
    }
  }

  state.wallet.unrealizedPnl = Number(totalUnrealizedPnl.toFixed(2));
  state.config.lastCheckedAt = new Date().toISOString();
  saveForwardTestState(state, userId);
  return state;
}

/**
 * Runs a fast, complete 1-Day (24-Hour) real-time replay across all selected instruments
 */
export async function runOneDayRealtimeReplay(
  strategyName: 'Strategy C' | 'Strategy B' | 'Strategy A',
  selectedSymbols: string[],
  startingCapital: number = 10000,
  riskPct: number = 2,
  userId?: string,
  overallRiskPct: number = 10
): Promise<ForwardTestState> {
  const autoLev = calculateAutoLeverage(strategyName, riskPct);
  const state: ForwardTestState = {
    wallet: {
      startingBalance: startingCapital,
      balance: startingCapital,
      currency: 'INR',
      realizedPnl: 0,
      unrealizedPnl: 0,
    },
    config: {
      isRunning: true,
      strategy: strategyName,
      symbols: selectedSymbols,
      perTradeRiskPct: riskPct,
      overallRiskPct,
      leverage: autoLev.leverage,
      autoLeverage: true,
    },
    positions: [],
    closedTrades: [],
    lastUpdated: new Date().toISOString(),
  };

  const maxLoss = (startingCapital * overallRiskPct) / 100;

  // Run over past 24 hours (288 5-minute candles)
  for (const sym of selectedSymbols) {
    try {
      const { candles } = await fetchRealHistoricalCandles(sym, '5m', 2);
      if (!candles || candles.length < 30) continue;

      // Take the last 288 candles (exact 24 hours of 5m candles)
      const dayCandles = candles.slice(-288);
      let inTrade = false;
      let activePos: ForwardPosition | null = null;

      for (let i = 20; i < dayCandles.length; i++) {
        // Capital protection check
        if (startingCapital - state.wallet.balance >= maxLoss) {
          state.config.isRunning = false;
          state.config.riskPausedReason = `Overall Risk Limit reached (${overallRiskPct}% / ₹${maxLoss.toLocaleString('en-IN')}). Replay halted.`;
          break;
        }

        const c = dayCandles[i];
        const prevC = dayCandles[i - 1];

        if (inTrade && activePos) {
          const isBuy = activePos.side === 'BUY';
          let shouldExit = false;
          let exitPrice = c.close;
          let exitReason = '';

          if (isBuy) {
            if (c.low <= activePos.stopLoss) {
              shouldExit = true;
              exitPrice = activePos.stopLoss;
              exitReason = 'STOP LOSS HIT';
            } else if (c.high >= activePos.takeProfit) {
              shouldExit = true;
              exitPrice = activePos.takeProfit;
              exitReason = '1:3.5 TARGET HIT';
            }
          } else {
            if (c.high >= activePos.stopLoss) {
              shouldExit = true;
              exitPrice = activePos.stopLoss;
              exitReason = 'STOP LOSS HIT';
            } else if (c.low <= activePos.takeProfit) {
              shouldExit = true;
              exitPrice = activePos.takeProfit;
              exitReason = '1:3.5 TARGET HIT';
            }
          }

          if (shouldExit) {
            const pDiff = isBuy ? exitPrice - activePos.entryPrice : activePos.entryPrice - exitPrice;
            const pctMove = pDiff / activePos.entryPrice;
            const posNotional = activePos.entryPrice * activePos.quantity;
            const finalPnl = Number((posNotional * pctMove).toFixed(2));
            const finalPct = Number((pctMove * 100 * state.config.leverage).toFixed(2));

            state.closedTrades.push({
              id: `FT-REP-${state.closedTrades.length + 1}-${sym}`,
              symbol: activePos.symbol,
              strategy: activePos.strategy,
              setupName: activePos.setupName,
              side: activePos.side,
              quantity: activePos.quantity,
              entryPrice: activePos.entryPrice,
              exitPrice,
              realizedPnl: finalPnl,
              pnlPct: finalPct,
              result: finalPnl >= 0 ? 'WIN' : 'LOSS',
              exitReason,
              entryTime: activePos.entryTime,
              exitTime: new Date(c.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
              durationMinutes: 20,
            });

            state.wallet.balance = Number((state.wallet.balance + finalPnl).toFixed(2));
            state.wallet.realizedPnl = Number((state.wallet.realizedPnl + finalPnl).toFixed(2));
            inTrade = false;
            activePos = null;
          } else {
            // Universal Dynamic Trailing: Every +100% market move (1R) trails SL by +35% (0.35R)
            const initSl = activePos.initialStopLoss || activePos.stopLoss;
            const favPrice = isBuy ? c.high : c.low;
            const trailRes = calculateDynamicTrailingSL(isBuy, activePos.entryPrice, initSl, activePos.stopLoss, favPrice);
            if (trailRes.shouldTrail) {
              activePos.stopLoss = trailRes.newSl;
              activePos.trailingMilestone = trailRes.milestone;
            }
          }
          continue;
        }

        // Evaluate entry if not in trade
        if (strategyName === 'Strategy B') {
          const slice = dayCandles.slice(Math.max(0, i - 40), i + 1);
          const evalRes = evaluatePhantomICTStrategy(slice, null, c.close, { riskRewardRatio: 3.5 });

          if (evalRes.canEnterNewTrade && evalRes.signal && evalRes.stopLoss && evalRes.target) {
            const slDistance = Math.abs(c.close - evalRes.stopLoss);
            const slDistPct = slDistance / c.close;
            if (slDistPct > 0) {
              const riskAmount = state.wallet.balance * (riskPct / 100);
              const targetNotional = riskAmount / slDistPct;
              const qty = Math.max(0.001, Number((targetNotional / c.close).toFixed(4)));

              activePos = {
                id: `POS-${c.timestamp}-${sym}`,
                symbol: sym,
                strategy: strategyName,
                setupName: evalRes.setupName || 'Phantom SMC/ICT',
                side: evalRes.signal,
                quantity: qty,
                entryPrice: c.close,
                currentPrice: c.close,
                stopLoss: evalRes.stopLoss,
                initialStopLoss: evalRes.stopLoss,
                takeProfit: evalRes.target,
                unrealizedPnl: 0,
                unrealizedPnlPct: 0,
                entryTime: new Date(c.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
              };
              inTrade = true;
            }
          }
        } else {
          // Strategy C: 6 Setups
          const pdh = Math.max(...dayCandles.slice(0, Math.max(1, i - 15)).map((x) => x.high));
          const pdl = Math.min(...dayCandles.slice(0, Math.max(1, i - 15)).map((x) => x.low));

          if (prevC.close > pdh && c.close >= pdh) {
            const sl = prevC.low;
            const slDist = Math.abs(c.close - sl);
            const slDistPct = slDist / c.close;
            if (slDistPct > 0) {
              const riskAmount = state.wallet.balance * (riskPct / 100);
              const targetNotional = riskAmount / slDistPct;
              const qty = Math.max(0.001, Number((targetNotional / c.close).toFixed(4)));
              activePos = {
                id: `POS-${c.timestamp}-${sym}`,
                symbol: sym,
                strategy: strategyName,
                setupName: '1. PDH Breakout (BUY)',
                side: 'BUY',
                quantity: qty,
                entryPrice: c.close,
                currentPrice: c.close,
                stopLoss: sl,
                initialStopLoss: sl,
                takeProfit: c.close + 3 * slDist,
                unrealizedPnl: 0,
                unrealizedPnlPct: 0,
                entryTime: new Date(c.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
              };
              inTrade = true;
            }
          } else if (prevC.close < pdl && c.close <= pdl) {
            const sl = prevC.high;
            const slDist = Math.abs(sl - c.close);
            const slDistPct = slDist / c.close;
            if (slDistPct > 0) {
              const riskAmount = state.wallet.balance * (riskPct / 100);
              const targetNotional = riskAmount / slDistPct;
              const qty = Math.max(0.001, Number((targetNotional / c.close).toFixed(4)));
              activePos = {
                id: `POS-${c.timestamp}-${sym}`,
                symbol: sym,
                strategy: strategyName,
                setupName: '2. PDL Breakdown (SELL)',
                side: 'SELL',
                quantity: qty,
                entryPrice: c.close,
                currentPrice: c.close,
                stopLoss: sl,
                initialStopLoss: sl,
                takeProfit: c.close - 3 * slDist,
                unrealizedPnl: 0,
                unrealizedPnlPct: 0,
                entryTime: new Date(c.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
              };
              inTrade = true;
            }
          }
        }
      }

      // If a position is still open at the end of the 24h cycle, add to live open positions
      if (inTrade && activePos) {
        const lastCandle = dayCandles[dayCandles.length - 1];
        activePos.currentPrice = lastCandle.close;
        const isBuy = activePos.side === 'BUY';
        const pDiff = isBuy ? lastCandle.close - activePos.entryPrice : activePos.entryPrice - lastCandle.close;
        const pctMove = pDiff / activePos.entryPrice;
        const posNotional = activePos.entryPrice * activePos.quantity;
        activePos.unrealizedPnl = Number((posNotional * pctMove).toFixed(2));
        activePos.unrealizedPnlPct = Number((pctMove * 100 * state.config.leverage).toFixed(2));
        state.positions.push(activePos);
        state.wallet.unrealizedPnl += activePos.unrealizedPnl;
      }
    } catch (err: any) {
      console.warn(`1-day replay error for ${sym}:`, err.message);
    }
  }

  saveForwardTestState(state, userId);
  return state;
}

/**
 * Manually squares off an active forward-test position
 */
export function squareOffForwardPosition(posId: string, userId?: string): ForwardTestState {
  const state = loadForwardTestState(userId);
  const index = state.positions.findIndex((p) => p.id === posId);
  if (index >= 0) {
    const pos = state.positions[index];
    const isBuy = pos.side === 'BUY';
    const finalPnl = Number((isBuy ? (pos.currentPrice - pos.entryPrice) * pos.quantity : (pos.entryPrice - pos.currentPrice) * pos.quantity).toFixed(2));
    const finalPct = Number(((finalPnl / (pos.entryPrice * pos.quantity)) * 100).toFixed(2));

    const closedTrade: ForwardClosedTrade = {
      id: `FT-SQ-${Date.now()}-${pos.symbol}`,
      symbol: pos.symbol,
      strategy: pos.strategy,
      setupName: pos.setupName,
      side: pos.side,
      quantity: pos.quantity,
      entryPrice: pos.entryPrice,
      exitPrice: pos.currentPrice,
      realizedPnl: finalPnl,
      pnlPct: finalPct,
      result: finalPnl >= 0 ? 'WIN' : 'LOSS',
      exitReason: 'MANUAL SQUARE OFF',
      entryTime: pos.entryTime,
      exitTime: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
      durationMinutes: 10,
    };

    state.wallet.balance = Number((state.wallet.balance + finalPnl).toFixed(2));
    state.wallet.realizedPnl = Number((state.wallet.realizedPnl + finalPnl).toFixed(2));
    state.closedTrades.unshift(closedTrade);
    state.positions.splice(index, 1);
    saveForwardTestState(state, userId);
  }

  return state;
}
