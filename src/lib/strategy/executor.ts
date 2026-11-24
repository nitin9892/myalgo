import { getAdminSupabase } from '../supabase';
import { getBrokerAdapter } from '../brokers';
import { calculateEMA, calculateRSI, calculateSupertrend } from './indicators';
import { BrokerType, OrderRequest } from '../brokers/types';

export interface StrategyRecord {
  id: string;
  name: string;
  broker_name: BrokerType;
  symbol: string;
  timeframe: string;
  strategy_type: 'EMA_CROSSOVER' | 'RSI_REVERSAL' | 'SUPERTREND' | 'CUSTOM_WEBHOOK';
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
        const candles = await adapter.getLatestCandles(strat.symbol, strat.timeframe, 60);

        if (candles.length < 25) {
          logs.push(`[${strat.name}] Not enough candles (${candles.length}) for calculation.`);
          continue;
        }

        const closes = candles.map((c) => c.close);
        const currentPrice = closes[closes.length - 1];
        let signal: 'BUY' | 'SELL' | null = null;
        let signalReason = '';

        // Strategy logic evaluation
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

        // Check if an open trade already exists for this strategy
        const { data: openTrades } = await supabase
          .from('trades')
          .select('*')
          .eq('strategy_id', strat.id)
          .eq('status', 'OPEN');

        const hasOpenTrade = openTrades && openTrades.length > 0;

        if (signal && !hasOpenTrade) {
          // Calculate Quantity & Risk
          const capital = strat.capital_allocation || 50000;
          const riskAmount = capital * ((strat.risk_percentage || 1) / 100);
          const stopLossPct = strat.stop_loss_pct || 0.5;
          const slDistance = currentPrice * (stopLossPct / 100);
          let quantity = Math.max(1, Math.floor(riskAmount / (slDistance || 1)));

          // Special sizing for Crypto/Forex
          if (strat.broker_name === 'DELTA') {
            quantity = Math.max(1, Math.min(10, quantity));
          } else if (strat.broker_name === 'METATRADER') {
            quantity = 0.01; // 1 micro lot default
          }

          const stopLoss = signal === 'BUY' ? currentPrice - slDistance : currentPrice + slDistance;
          const takeProfit = signal === 'BUY' 
            ? currentPrice + (slDistance * 2) 
            : currentPrice - (slDistance * 2);

          const orderRequest: OrderRequest = {
            symbol: strat.symbol,
            side: signal,
            quantity,
            orderType: 'MARKET',
            price: currentPrice,
            stopLoss,
            takeProfit,
            paperTrade: strat.paper_trading,
          };

          // Execute Order
          const orderResult = await adapter.placeOrder(orderRequest);

          if (orderResult.success) {
            // Record trade in Supabase
            await supabase.from('trades').insert({
              strategy_id: strat.id,
              broker_name: strat.broker_name,
              symbol: strat.symbol,
              side: signal,
              quantity,
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
              message: `[${strat.name}] Executed ${signal} ${quantity} ${strat.symbol} @ ${currentPrice} (${signalReason})`,
              metadata: { orderResult, strategyId: strat.id },
            });

            logs.push(`SUCCESS: Placed ${signal} order for ${strat.name} @ ${currentPrice}`);
          } else {
            logs.push(`FAILED: Could not place order for ${strat.name}: ${orderResult.message}`);
          }
        } else {
          logs.push(`[${strat.name}] Price: ${currentPrice} | Signal: ${signal || 'NEUTRAL'} | Open Positions: ${hasOpenTrade ? '1' : '0'}`);
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
