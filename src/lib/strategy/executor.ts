import { getAdminSupabase } from '../supabase';
import { getBrokerAdapter } from '../brokers';
import { calculateEMA, calculateRSI, calculateSupertrend } from './indicators';
import { evaluatePrevDayBreakout, ActivePositionState, KeyLevels, BreakoutStrategyParams } from './prev_day_breakout';
import { 
  getRiskConfiguration, 
  evaluateDailyLossAndKillSwitch, 
  calculateDynamicPositionSize 
} from '../risk/engine';
import { BrokerType, OrderRequest } from '../brokers/types';

export interface StrategyRecord {
  id: string;
  name: string;
  broker_name: BrokerType;
  symbol: string;
  timeframe: string;
  strategy_type: 'EMA_CROSSOVER' | 'RSI_REVERSAL' | 'SUPERTREND' | 'CUSTOM_WEBHOOK' | 'PREV_DAY_BREAKOUT';
  is_active: boolean;
  paper_trading: boolean;
  capital_allocation: number;
  risk_percentage: number;
  stop_loss_pct: number;
  take_profit_pct: number;
  parameters: any;
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

    // 1. Fetch active strategies
    const { data: strategies, error } = await supabase
      .from('strategies')
      .select('*')
      .eq('is_active', true);

    if (error || !strategies || strategies.length === 0) {
      logs.push('No active strategies found in database.');
      return { success: true, count: 0, logs };
    }

    // 2. Iterate each strategy and evaluate signals
    for (const strat of strategies as StrategyRecord[]) {
      try {
        const adapter = getBrokerAdapter(strat.broker_name);
        const candles = await adapter.getLatestCandles(strat.symbol, strat.timeframe || '5m', 60);

        if (candles.length < 5) {
          logs.push(`[${strat.name}] Not enough candles (${candles.length}) for calculation.`);
          continue;
        }

        const closes = candles.map((c) => c.close);
        const currentPrice = closes[closes.length - 1];

        // Check open trade for this strategy
        const { data: openTrades } = await supabase
          .from('trades')
          .select('*')
          .eq('strategy_id', strat.id)
          .eq('status', 'OPEN');

        const activeTrade = openTrades && openTrades.length > 0 ? openTrades[0] : null;

        // ====================================================================
        // STRATEGY: PREVIOUS DAY LEVELS BREAKOUT & 1:3 STEP TRAILING
        // ====================================================================
        if (strat.strategy_type === 'PREV_DAY_BREAKOUT') {
          const p = strat.parameters || {};
          let prevHigh = Number(p.prev_high);
          let prevLow = Number(p.prev_low);
          let prevClose = Number(p.prev_close);

          if (!prevHigh || !prevLow || !prevClose) {
            const highs = candles.map((c) => c.high);
            const lows = candles.map((c) => c.low);
            prevHigh = Math.max(...highs.slice(0, -10));
            prevLow = Math.min(...lows.slice(0, -10));
            prevClose = candles[candles.length - 15]?.close || currentPrice;
          }

          const levels: KeyLevels = { prevHigh, prevLow, prevClose };
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
              symbol: strat.symbol,
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

          const evalRes = evaluatePrevDayBreakout(
            candles,
            levels,
            strategyParams,
            activePosState,
            currentPrice
          );

          // 1. Exits (SL, Target, or 15:30 Force Square-Off)
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
              symbol: strat.symbol,
              side: exitSide,
              quantity: qty,
              orderType: 'MARKET',
              paperTrade: strat.paper_trading,
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
              source: `EXIT_${strat.broker_name}`,
              message: `[${strat.name}] POSITION CLOSED: ${exitReason} for ${strat.symbol} @ ${exitPrice} | P&L: ₹${pnl.toFixed(2)} (${pnlPct.toFixed(2)}%)`,
              metadata: { exitReason, exitPrice, pnl },
            });

            logs.push(`EXIT: [${strat.name}] Closed position via ${exitReason} @ ${exitPrice} (P&L: ₹${pnl.toFixed(2)})`);
            continue;
          }

          // 2. Trailing Updates
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
              message: `[${strat.name}] TRAILING MILESTONE #${milestone}: Trailed SL by +${pointsTrailed} pts to ${newSl}, Target to ${newTarget}`,
              metadata: evalRes.trailingUpdate,
            });

            logs.push(`TRAIL: [${strat.name}] Milestone #${milestone} reached! New SL: ${newSl}, Target: ${newTarget}`);
            continue;
          }

          // 3. Dynamic Position Sizing & Entry Trigger
          if (!activeTrade && evalRes.signal) {
            const signal = evalRes.signal;
            const entryPrice = evalRes.entryPrice || currentPrice;
            const stopLoss = evalRes.stopLoss || 0;
            const takeProfit = evalRes.target || 0;
            const slPoints = evalRes.slPoints || Math.abs(entryPrice - stopLoss);

            // DYNAMIC LOT SIZING VIA RISK ENGINE (% RISK PER TRADE)
            const sizing = calculateDynamicPositionSize(
              riskConfig.walletBalance,
              riskConfig.perTradeRiskPct,
              slPoints,
              strat.symbol,
              strat.broker_name
            );

            const orderResult = await adapter.placeOrder({
              symbol: strat.symbol,
              side: signal,
              quantity: sizing.quantity,
              orderType: 'MARKET',
              price: entryPrice,
              stopLoss,
              takeProfit,
              paperTrade: strat.paper_trading,
            });

            if (orderResult.success) {
              await supabase.from('trades').insert({
                strategy_id: strat.id,
                broker_name: strat.broker_name,
                symbol: strat.symbol,
                side: signal,
                quantity: sizing.quantity,
                entry_price: entryPrice,
                stop_loss: stopLoss,
                take_profit: takeProfit,
                status: 'OPEN',
                paper_trade: strat.paper_trading,
                broker_order_id: orderResult.orderId,
                notes: `${evalRes.signalReason} | Dynamic Qty: ${sizing.quantity} (Risk: ₹${sizing.effectiveRisk})`,
              });

              await supabase.from('system_logs').insert({
                level: 'TRADE_SIGNAL',
                source: `ENGINE_${strat.broker_name}`,
                message: `[${strat.name}] ENTRY TRIGGERED: ${signal} ${sizing.quantity} ${strat.symbol} @ ${entryPrice} (SL: ${stopLoss}, 1:3 TP: ${takeProfit}) | Risk: ₹${sizing.effectiveRisk}`,
                metadata: { orderResult, sizing, evalRes },
              });

              logs.push(`SUCCESS: [${strat.name}] Placed ${signal} order (${sizing.quantity} qty) @ ${entryPrice}`);
            }
            continue;
          }

          logs.push(`[${strat.name}] Price: ${currentPrice} | Window: ${evalRes.blockReason || 'SCANNING'} | Position: ${activeTrade ? 'ACTIVE' : 'NONE'}`);
          continue;
        }

        // ====================================================================
        // STANDARD STRATEGIES (EMA, RSI, SUPERTREND) WITH DYNAMIC RISK SIZING
        // ====================================================================
        let signal: 'BUY' | 'SELL' | null = null;
        let signalReason = '';

        if (strat.strategy_type === 'EMA_CROSSOVER') {
          const fastPeriod = strat.parameters?.fast_ema || 9;
          const slowPeriod = strat.parameters?.slow_ema || 21;
          const fastEMA = calculateEMA(closes, fastPeriod);
          const slowEMA = calculateEMA(closes, slowPeriod);

          const len = closes.length - 1;
          const prevFast = fastEMA[len - 1];
          const prevSlow = slowEMA[len - 1];
          const currFast = fastEMA[len];
          const currSlow = slowEMA[len];

          if (prevFast <= prevSlow && currFast > currSlow) {
            signal = 'BUY';
            signalReason = `Bullish EMA Crossover (${fastPeriod} crossed above ${slowPeriod})`;
          } else if (prevFast >= prevSlow && currFast < currSlow) {
            signal = 'SELL';
            signalReason = `Bearish EMA Crossunder (${fastPeriod} crossed below ${slowPeriod})`;
          }
        } else if (strat.strategy_type === 'RSI_REVERSAL') {
          const rsiPeriod = strat.parameters?.period || 14;
          const oversold = strat.parameters?.oversold || 30;
          const overbought = strat.parameters?.overbought || 70;
          const rsiValues = calculateRSI(closes, rsiPeriod);
          const currRSI = rsiValues[rsiValues.length - 1];

          if (currRSI < oversold) {
            signal = 'BUY';
            signalReason = `RSI Oversold condition (${currRSI.toFixed(1)} < ${oversold})`;
          } else if (currRSI > overbought) {
            signal = 'SELL';
            signalReason = `RSI Overbought condition (${currRSI.toFixed(1)} > ${overbought})`;
          }
        } else if (strat.strategy_type === 'SUPERTREND') {
          const st = calculateSupertrend(candles, 10, 3);
          if (st.trend === 'BULLISH' && currentPrice > st.value) {
            signal = 'BUY';
            signalReason = `Supertrend Bullish Flip (Price ${currentPrice} > Band ${st.value.toFixed(2)})`;
          } else if (st.trend === 'BEARISH' && currentPrice < st.value) {
            signal = 'SELL';
            signalReason = `Supertrend Bearish Flip (Price ${currentPrice} < Band ${st.value.toFixed(2)})`;
          }
        }

        if (signal && !activeTrade) {
          const stopLossPct = strat.stop_loss_pct || 0.5;
          const slDistance = currentPrice * (stopLossPct / 100);

          // DYNAMIC SIZING
          const sizing = calculateDynamicPositionSize(
            riskConfig.walletBalance,
            riskConfig.perTradeRiskPct,
            slDistance,
            strat.symbol,
            strat.broker_name
          );

          const stopLoss = signal === 'BUY' ? currentPrice - slDistance : currentPrice + slDistance;
          const takeProfit = signal === 'BUY' 
            ? currentPrice + (slDistance * 2) 
            : currentPrice - (slDistance * 2);

          const orderRequest: OrderRequest = {
            symbol: strat.symbol,
            side: signal,
            quantity: sizing.quantity,
            orderType: 'MARKET',
            price: currentPrice,
            stopLoss,
            takeProfit,
            paperTrade: strat.paper_trading,
          };

          const orderResult = await adapter.placeOrder(orderRequest);

          if (orderResult.success) {
            await supabase.from('trades').insert({
              strategy_id: strat.id,
              broker_name: strat.broker_name,
              symbol: strat.symbol,
              side: signal,
              quantity: sizing.quantity,
              entry_price: currentPrice,
              stop_loss: stopLoss,
              take_profit: takeProfit,
              status: 'OPEN',
              paper_trade: strat.paper_trading,
              broker_order_id: orderResult.orderId,
              notes: signalReason,
            });

            await supabase.from('system_logs').insert({
              level: 'TRADE_SIGNAL',
              source: `ENGINE_${strat.broker_name}`,
              message: `[${strat.name}] Executed ${signal} ${sizing.quantity} ${strat.symbol} @ ${currentPrice} (${signalReason}) | Risk: ₹${sizing.effectiveRisk}`,
              metadata: { orderResult, strategyId: strat.id, sizing },
            });

            logs.push(`SUCCESS: Placed ${signal} order (${sizing.quantity} qty) for ${strat.name} @ ${currentPrice}`);
          }
        } else {
          logs.push(`[${strat.name}] Price: ${currentPrice} | Signal: ${signal || 'NEUTRAL'} | Open: ${activeTrade ? 'YES' : 'NO'}`);
        }
      } catch (innerErr: any) {
        logs.push(`ERROR in ${strat.name}: ${innerErr.message}`);
      }
    }

    return { success: true, count: strategies.length, logs };
  } catch (err: any) {
    return { success: false, error: err.message, logs };
  }
}
