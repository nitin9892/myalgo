import { Candle } from '../brokers/types';

export interface BacktestParams {
  symbol: string;
  timeframe: '5m' | '15m' | '1h';
  days: number;
  initialCapital: number;
  perTradeRiskPct: number;
  leverage: number;
  maxTradesPerDay: number;
  trailingEnabled?: boolean;
}

export interface BacktestTrade {
  id: string;
  entryTime: string;
  exitTime: string;
  symbol: string;
  setupName: string;
  side: 'BUY' | 'SELL';
  entryPrice: number;
  exitPrice: number;
  stopLoss: number;
  takeProfit: number;
  quantity: number;
  pnl: number;
  pnlPct: number;
  result: 'WIN' | 'LOSS';
  exitReason: string;
  durationCandles: number;
}

export interface BacktestResult {
  symbol: string;
  timeframe: string;
  days: number;
  totalCandles: number;
  dataSource: string;
  initialCapital: number;
  finalCapital: number;
  netPnl: number;
  returnPct: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRatePct: number;
  profitFactor: number;
  maxDrawdownPct: number;
  avgTradePnl: number;
  trades: BacktestTrade[];
}

/**
 * Normalizes symbol to standard coin representation
 */
export function normalizeSymbol(raw: string): { deltaSym: string; binanceSym: string } {
  let s = raw.toUpperCase().trim().replace('/', '');
  if (s === 'BTC' || s === 'BTCUSDT' || s === 'BTCUSD') return { deltaSym: 'BTCUSD', binanceSym: 'BTCUSDT' };
  if (s === 'ETH' || s === 'ETHUSDT' || s === 'ETHUSD') return { deltaSym: 'ETHUSD', binanceSym: 'ETHUSDT' };
  if (s === 'SOL' || s === 'SOLUSDT' || s === 'SOLUSD' || s === 'SPL' || s === 'SPLUSD') return { deltaSym: 'SOLUSD', binanceSym: 'SOLUSDT' };
  if (s === 'XRP' || s === 'XRPUSDT' || s === 'XRPUSD') return { deltaSym: 'XRPUSD', binanceSym: 'XRPUSDT' };
  return { deltaSym: s, binanceSym: `${s.replace('USD', '')}USDT` };
}

/**
 * Fetches 100% REAL historical candles from Delta Exchange with Binance backup
 */
export async function fetchRealHistoricalCandles(
  symbol: string,
  timeframe: string = '5m',
  days: number = 7
): Promise<{ candles: Candle[]; source: string }> {
  const { deltaSym, binanceSym } = normalizeSymbol(symbol);
  const resolution = timeframe.replace('m', '');
  const to = Math.floor(Date.now() / 1000);
  const from = to - days * 24 * 60 * 60;

  // 1. Try Delta Exchange Live Chart API
  try {
    const deltaUrl = `https://api.india.delta.exchange/v2/chart/history?symbol=${deltaSym}&resolution=${resolution}&from=${from}&to=${to}`;
    const res = await fetch(deltaUrl, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (data.result && data.result.t && data.result.t.length > 50) {
        const candles: Candle[] = data.result.t.map((t: number, i: number) => ({
          timestamp: t * 1000,
          open: Number(data.result.o[i]),
          high: Number(data.result.h[i]),
          low: Number(data.result.l[i]),
          close: Number(data.result.c[i]),
          volume: Number(data.result.v[i] || 0),
        }));
        return { candles, source: `Delta Exchange Real Feed (${deltaSym})` };
      }
    }
  } catch (err: any) {
    console.warn('Delta chart API failed in backtest:', err.message);
  }

  // 2. Resilient Real Market Backup: Binance Public Spot Klines
  try {
    const limit = Math.min(1000, Math.max(100, Math.floor((days * 24 * 60) / (timeframe === '5m' ? 5 : 15))));
    const binanceUrl = `https://api.binance.com/api/v3/klines?symbol=${binanceSym}&interval=${timeframe}&limit=${limit}`;
    const bRes = await fetch(binanceUrl, { cache: 'no-store' });
    if (bRes.ok) {
      const rawKlines = await bRes.json();
      if (Array.isArray(rawKlines) && rawKlines.length > 0) {
        const candles: Candle[] = rawKlines.map((k: any) => ({
          timestamp: Number(k[0]),
          open: parseFloat(k[1]),
          high: parseFloat(k[2]),
          low: parseFloat(k[3]),
          close: parseFloat(k[4]),
          volume: parseFloat(k[5]),
        }));
        return { candles, source: `Binance Real Market Feed (${binanceSym})` };
      }
    }
  } catch (bErr: any) {
    console.warn('Binance kline backup failed:', bErr.message);
  }

  throw new Error(`Could not fetch real market data for ${symbol}. Check connection.`);
}

/**
 * Runs 6 Core Setups Strategy Simulation over historical candles
 */
export async function runRealMarketBacktest(params: BacktestParams): Promise<BacktestResult> {
  const { candles, source } = await fetchRealHistoricalCandles(params.symbol, params.timeframe, params.days);

  let currentCapital = params.initialCapital;
  let peakCapital = params.initialCapital;
  let maxDrawdownPct = 0;
  const trades: BacktestTrade[] = [];

  let dailyTradesCount = 0;
  let currentTradingDay = '';

  // Simulation state
  let inTrade = false;
  let activeTrade: Partial<BacktestTrade> | null = null;
  let entryCandleIndex = 0;

  // We need at least 24 candles to establish previous day context
  const minLookback = 24;

  for (let i = minLookback; i < candles.length; i++) {
    const candle = candles[i];
    const prevCandle = candles[i - 1];

    // Day Boundary Detection (IST UTC+5.5 anchored at 01:00 AM)
    const candleDate = new Date(candle.timestamp);
    const dayKey = candleDate.toISOString().slice(0, 10);
    if (dayKey !== currentTradingDay) {
      currentTradingDay = dayKey;
      dailyTradesCount = 0;
    }

    // -------------------------------------------------------------
    // 1. POSITION MANAGEMENT IF IN TRADE
    // -------------------------------------------------------------
    if (inTrade && activeTrade) {
      const isBuy = activeTrade.side === 'BUY';
      let exitPrice = 0;
      let exitReason = '';
      let isClosed = false;

      // Check Stop Loss & Target in current candle
      if (isBuy) {
        if (candle.low <= (activeTrade.stopLoss || 0)) {
          exitPrice = activeTrade.stopLoss || 0;
          exitReason = 'STOP LOSS HIT';
          isClosed = true;
        } else if (candle.high >= (activeTrade.takeProfit || 0)) {
          exitPrice = activeTrade.takeProfit || 0;
          exitReason = '1:3 TARGET HIT';
          isClosed = true;
        }
      } else {
        if (candle.high >= (activeTrade.stopLoss || 0)) {
          exitPrice = activeTrade.stopLoss || 0;
          exitReason = 'STOP LOSS HIT';
          isClosed = true;
        } else if (candle.low <= (activeTrade.takeProfit || 0)) {
          exitPrice = activeTrade.takeProfit || 0;
          exitReason = '1:3 TARGET HIT';
          isClosed = true;
        }
      }

      // Trailing SL check if enabled
      if (!isClosed && params.trailingEnabled) {
        const favorablePoints = isBuy
          ? candle.high - (activeTrade.entryPrice || 0)
          : (activeTrade.entryPrice || 0) - candle.low;

        if (favorablePoints >= 10) {
          const trailSteps = Math.floor(favorablePoints / 10);
          const pointsToTrail = trailSteps * 3;
          if (isBuy) {
            const trailedSl = (activeTrade.stopLoss || 0) + pointsToTrail;
            if (trailedSl > (activeTrade.stopLoss || 0)) activeTrade.stopLoss = trailedSl;
          } else {
            const trailedSl = (activeTrade.stopLoss || 0) - pointsToTrail;
            if (trailedSl < (activeTrade.stopLoss || 0)) activeTrade.stopLoss = trailedSl;
          }
        }
      }

      // Max holding period safety (e.g. 30 candles max)
      if (!isClosed && (i - entryCandleIndex) >= 48) {
        exitPrice = candle.close;
        exitReason = 'TIME EXIT (End of Day)';
        isClosed = true;
      }

      if (isClosed) {
        const entryPrice = activeTrade.entryPrice || 0;
        const qty = activeTrade.quantity || 1;
        const rawPnl = isBuy ? (exitPrice - entryPrice) * qty : (entryPrice - exitPrice) * qty;
        const pnl = Number(rawPnl.toFixed(2));
        const pnlPct = Number(((pnl / currentCapital) * 100).toFixed(2));

        currentCapital += pnl;
        if (currentCapital > peakCapital) peakCapital = currentCapital;
        const dd = ((peakCapital - currentCapital) / peakCapital) * 100;
        if (dd > maxDrawdownPct) maxDrawdownPct = dd;

        trades.push({
          id: `BT-${trades.length + 1}`,
          entryTime: activeTrade.entryTime || '',
          exitTime: new Date(candle.timestamp).toLocaleString(),
          symbol: params.symbol,
          setupName: activeTrade.setupName || 'Strategy C',
          side: activeTrade.side || 'BUY',
          entryPrice,
          exitPrice,
          stopLoss: activeTrade.stopLoss || 0,
          takeProfit: activeTrade.takeProfit || 0,
          quantity: qty,
          pnl,
          pnlPct,
          result: pnl > 0 ? 'WIN' : 'LOSS',
          exitReason,
          durationCandles: i - entryCandleIndex,
        });

        inTrade = false;
        activeTrade = null;
      }

      continue;
    }

    // -------------------------------------------------------------
    // 2. CHECK DAILY TRADES CEILING (Max 3 Trades a Day)
    // -------------------------------------------------------------
    if (dailyTradesCount >= params.maxTradesPerDay) {
      continue;
    }

    // -------------------------------------------------------------
    // 3. CALCULATE PREVIOUS DAY HIGH (PDH), LOW (PDL), CLOSE (PDC)
    // -------------------------------------------------------------
    const lookbackCandles = candles.slice(Math.max(0, i - 48), i);
    const pdh = Math.max(...lookbackCandles.map(c => c.high));
    const pdl = Math.min(...lookbackCandles.map(c => c.low));
    const pdc = lookbackCandles[lookbackCandles.length - 1].close;

    // -------------------------------------------------------------
    // 4. EVALUATE 6 CORE SETUPS ON SIGNAL CANDLE (prevCandle)
    // -------------------------------------------------------------
    const isBullish = prevCandle.close > prevCandle.open;
    const isBearish = prevCandle.close < prevCandle.open;

    let triggerSide: 'BUY' | 'SELL' | null = null;
    let setupName = '';
    let triggerPrice = 0;
    let slPrice = 0;

    // 1. PDH Breakout (BUY)
    if (isBullish && prevCandle.close > pdh && prevCandle.open <= pdh) {
      if (candle.high > prevCandle.high) {
        triggerSide = 'BUY';
        setupName = '1. Yesterday High (PDH) Breakout';
        triggerPrice = prevCandle.high;
        slPrice = prevCandle.low;
      }
    }
    // 2. PDH Breakdown (SELL)
    else if (isBearish && prevCandle.close < pdh && prevCandle.high >= pdh) {
      if (candle.low < prevCandle.low) {
        triggerSide = 'SELL';
        setupName = '2. Yesterday High (PDH) Breakdown';
        triggerPrice = prevCandle.low;
        slPrice = prevCandle.high;
      }
    }
    // 3. PDL Breakout (BUY)
    else if (isBullish && prevCandle.close > pdl && prevCandle.low <= pdl) {
      if (candle.high > prevCandle.high) {
        triggerSide = 'BUY';
        setupName = '3. Yesterday Low (PDL) Breakout';
        triggerPrice = prevCandle.high;
        slPrice = prevCandle.low;
      }
    }
    // 4. PDL Breakdown (SELL)
    else if (isBearish && prevCandle.close < pdl && prevCandle.open >= pdl) {
      if (candle.low < prevCandle.low) {
        triggerSide = 'SELL';
        setupName = '4. Yesterday Low (PDL) Breakdown';
        triggerPrice = prevCandle.low;
        slPrice = prevCandle.high;
      }
    }
    // 5. PDC Breakout (BUY)
    else if (isBullish && prevCandle.close > pdc && prevCandle.open <= pdc) {
      if (candle.high > prevCandle.high) {
        triggerSide = 'BUY';
        setupName = '5. Yesterday Close (PDC) Breakout';
        triggerPrice = prevCandle.high;
        slPrice = prevCandle.low;
      }
    }
    // 6. PDC Breakdown (SELL)
    else if (isBearish && prevCandle.close < pdc && prevCandle.open >= pdc) {
      if (candle.low < prevCandle.low) {
        triggerSide = 'SELL';
        setupName = '6. Yesterday Close (PDC) Breakdown';
        triggerPrice = prevCandle.low;
        slPrice = prevCandle.high;
      }
    }

    // -------------------------------------------------------------
    // 5. ENTRY EXECUTION & 1:3 TARGET RATIO
    // -------------------------------------------------------------
    if (triggerSide && triggerPrice > 0 && slPrice > 0) {
      const slDist = Math.max(1, Math.abs(triggerPrice - slPrice));
      const targetDist = slDist * 3; // Strict 1:3 Risk to Reward
      const tpPrice = triggerSide === 'BUY' ? triggerPrice + targetDist : triggerPrice - targetDist;

      // Position Sizing based on risk percentage
      const riskAmount = currentCapital * (params.perTradeRiskPct / 100);
      const rawQty = Math.max(1, Math.floor(riskAmount / slDist));

      inTrade = true;
      entryCandleIndex = i;
      dailyTradesCount += 1;

      activeTrade = {
        entryTime: new Date(candle.timestamp).toLocaleString(),
        symbol: params.symbol,
        setupName,
        side: triggerSide,
        entryPrice: Number(triggerPrice.toFixed(2)),
        stopLoss: Number(slPrice.toFixed(2)),
        takeProfit: Number(tpPrice.toFixed(2)),
        quantity: rawQty,
      };
    }
  }

  // -------------------------------------------------------------
  // 6. AGGREGATE PERFORMANCE METRICS
  // -------------------------------------------------------------
  const totalTrades = trades.length;
  const winningTrades = trades.filter(t => t.result === 'WIN').length;
  const losingTrades = trades.filter(t => t.result === 'LOSS').length;
  const winRatePct = totalTrades > 0 ? Number(((winningTrades / totalTrades) * 100).toFixed(1)) : 0;

  const grossWins = trades.filter(t => t.pnl > 0).reduce((acc, t) => acc + t.pnl, 0);
  const grossLosses = Math.abs(trades.filter(t => t.pnl < 0).reduce((acc, t) => acc + t.pnl, 0));
  const profitFactor = grossLosses > 0 ? Number((grossWins / grossLosses).toFixed(2)) : (grossWins > 0 ? 99.9 : 1.0);

  const netPnl = Number((currentCapital - params.initialCapital).toFixed(2));
  const returnPct = Number(((netPnl / params.initialCapital) * 100).toFixed(2));
  const avgTradePnl = totalTrades > 0 ? Number((netPnl / totalTrades).toFixed(2)) : 0;

  return {
    symbol: params.symbol,
    timeframe: params.timeframe,
    days: params.days,
    totalCandles: candles.length,
    dataSource: source,
    initialCapital: params.initialCapital,
    finalCapital: Number(currentCapital.toFixed(2)),
    netPnl,
    returnPct,
    totalTrades,
    winningTrades,
    losingTrades,
    winRatePct,
    profitFactor,
    maxDrawdownPct: Number(maxDrawdownPct.toFixed(2)),
    avgTradePnl,
    trades: trades.reverse(), // latest trades first
  };
}
