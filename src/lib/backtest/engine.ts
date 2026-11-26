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
 * Fetches 100% REAL historical candles from Binance API with chunking support
 */
export async function fetchRealHistoricalCandles(
  symbol: string,
  timeframe: string = '5m',
  days: number = 7
): Promise<{ candles: Candle[]; source: string }> {
  const { binanceSym } = normalizeSymbol(symbol);
  const now = Date.now();
  const startTime = now - days * 24 * 60 * 60 * 1000;

  // Calculate number of chunks needed (1000 candles per request)
  const minutesPerCandle = timeframe === '5m' ? 5 : (timeframe === '15m' ? 15 : 60);
  const totalExpectedCandles = Math.floor((days * 24 * 60) / minutesPerCandle);
  const chunksCount = Math.min(6, Math.max(1, Math.ceil(totalExpectedCandles / 900)));

  const chunkDurationMs = Math.floor((now - startTime) / chunksCount);
  const allCandlesMap = new Map<number, Candle>();

  try {
    for (let c = 0; c < chunksCount; c++) {
      const chunkStart = startTime + c * chunkDurationMs;
      const chunkEnd = c === chunksCount - 1 ? now : startTime + (c + 1) * chunkDurationMs;

      const binanceUrl = `https://api.binance.com/api/v3/klines?symbol=${binanceSym}&interval=${timeframe}&limit=1000&startTime=${chunkStart}&endTime=${chunkEnd}`;
      const res = await fetch(binanceUrl, { cache: 'no-store' });

      if (res.ok) {
        const rawKlines = await res.json();
        if (Array.isArray(rawKlines)) {
          for (const k of rawKlines) {
            const ts = Number(k[0]);
            if (!allCandlesMap.has(ts)) {
              allCandlesMap.set(ts, {
                timestamp: ts,
                open: parseFloat(k[1]),
                high: parseFloat(k[2]),
                low: parseFloat(k[3]),
                close: parseFloat(k[4]),
                volume: parseFloat(k[5]),
              });
            }
          }
        }
      }
    }

    const candles = Array.from(allCandlesMap.values()).sort((a, b) => a.timestamp - b.timestamp);
    if (candles.length > 50) {
      return {
        candles,
        source: `Binance Public Market Feed (${binanceSym})`,
      };
    }
  } catch (err: any) {
    console.warn('Binance chunk fetch error:', err.message);
  }

  throw new Error(`Could not fetch real market data for ${symbol}. Please check internet connection.`);
}

/**
 * Runs 6 Core Setups Strategy Simulation over historical candles
 */
export async function runRealMarketBacktest(params: BacktestParams): Promise<BacktestResult> {
  const { candles, source } = await fetchRealHistoricalCandles(params.symbol, params.timeframe, params.days);

  // Helper to get IST calendar day anchored at 01:00 AM IST (UTC+5:30 offset - 1 hour)
  const getDayKey = (ts: number): string => {
    const ist = new Date(ts + 5.5 * 3600 * 1000 - 3600 * 1000);
    return ist.toISOString().slice(0, 10);
  };

  // Group historical candles by day to establish TRUE Yesterday High (PDH), Low (PDL), Close (PDC)
  const daysData: Record<string, { highs: number[]; lows: number[]; closes: number[] }> = {};
  for (const c of candles) {
    const dk = getDayKey(c.timestamp);
    if (!daysData[dk]) {
      daysData[dk] = { highs: [], lows: [], closes: [] };
    }
    daysData[dk].highs.push(c.high);
    daysData[dk].lows.push(c.low);
    daysData[dk].closes.push(c.close);
  }

  // Pre-calculate true PDH, PDL, PDC for every day
  const daysList = Object.keys(daysData).sort();
  const prevDayMap: Record<string, { pdh: number; pdl: number; pdc: number }> = {};
  for (let d = 1; d < daysList.length; d++) {
    const currentDay = daysList[d];
    const prevDay = daysList[d - 1];
    const prevDayStats = daysData[prevDay];
    prevDayMap[currentDay] = {
      pdh: Math.max(...prevDayStats.highs),
      pdl: Math.min(...prevDayStats.lows),
      pdc: prevDayStats.closes[prevDayStats.closes.length - 1],
    };
  }

  let currentCapital = params.initialCapital;
  let peakCapital = params.initialCapital;
  let maxDrawdownPct = 0;
  const trades: BacktestTrade[] = [];

  let inTrade = false;
  let activeTrade: Partial<BacktestTrade> | null = null;
  let entryCandleIndex = 0;
  const dailyTradeCounts: Record<string, number> = {};

  // Walk through candles and evaluate setups
  for (let i = 1; i < candles.length; i++) {
    const candle = candles[i];
    const prevCandle = candles[i - 1];
    const dayKey = getDayKey(candle.timestamp);
    const levels = prevDayMap[dayKey];

    // If previous day levels aren't available yet (first day in dataset), continue
    if (!levels) continue;

    if (!dailyTradeCounts[dayKey]) dailyTradeCounts[dayKey] = 0;

    // -------------------------------------------------------------
    // 1. POSITION MANAGEMENT IF IN TRADE
    // -------------------------------------------------------------
    if (inTrade && activeTrade) {
      const isBuy = activeTrade.side === 'BUY';
      let exitPrice: number | null = null;
      let exitReason = '';

      if (isBuy) {
        if (candle.low <= (activeTrade.stopLoss || 0)) {
          exitPrice = activeTrade.stopLoss || 0;
          exitReason = 'STOP LOSS HIT';
        } else if (candle.high >= (activeTrade.takeProfit || 0)) {
          exitPrice = activeTrade.takeProfit || 0;
          exitReason = '1:3 TARGET HIT';
        }
      } else {
        if (candle.high >= (activeTrade.stopLoss || 0)) {
          exitPrice = activeTrade.stopLoss || 0;
          exitReason = 'STOP LOSS HIT';
        } else if (candle.low <= (activeTrade.takeProfit || 0)) {
          exitPrice = activeTrade.takeProfit || 0;
          exitReason = '1:3 TARGET HIT';
        }
      }

      // Trailing SL check if enabled
      if (exitPrice === null && params.trailingEnabled) {
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

      // Time Exit safety (holding max 48 candles = 4 hours on 5m)
      if (exitPrice === null && (i - entryCandleIndex) >= 48) {
        exitPrice = candle.close;
        exitReason = 'TIME EXIT (Max Holding)';
      }

      if (exitPrice !== null) {
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
    // 2. CHECK DAILY MAX TRADES (Max 3 Trades per Day)
    // -------------------------------------------------------------
    if (dailyTradeCounts[dayKey] >= params.maxTradesPerDay) {
      continue;
    }

    // -------------------------------------------------------------
    // 3. EVALUATE 6 CORE SETUPS
    // -------------------------------------------------------------
    const { pdh, pdl, pdc } = levels;
    const isBullish = prevCandle.close > prevCandle.open;
    const isBearish = prevCandle.close < prevCandle.open;

    let triggerSide: 'BUY' | 'SELL' | null = null;
    let setupName = '';
    let triggerPrice = 0;
    let slPrice = 0;

    // 1. PDH Breakout (BUY)
    if (isBullish && prevCandle.close > pdh && prevCandle.open <= pdh && candle.high > prevCandle.high) {
      triggerSide = 'BUY';
      setupName = '1. Yesterday High (PDH) Breakout';
      triggerPrice = prevCandle.high;
      slPrice = prevCandle.low;
    }
    // 2. PDH Breakdown (SELL)
    else if (isBearish && prevCandle.close < pdh && prevCandle.high >= pdh && candle.low < prevCandle.low) {
      triggerSide = 'SELL';
      setupName = '2. Yesterday High (PDH) Breakdown';
      triggerPrice = prevCandle.low;
      slPrice = prevCandle.high;
    }
    // 3. PDL Breakout (BUY)
    else if (isBullish && prevCandle.close > pdl && prevCandle.low <= pdl && candle.high > prevCandle.high) {
      triggerSide = 'BUY';
      setupName = '3. Yesterday Low (PDL) Breakout';
      triggerPrice = prevCandle.high;
      slPrice = prevCandle.low;
    }
    // 4. PDL Breakdown (SELL)
    else if (isBearish && prevCandle.close < pdl && prevCandle.open >= pdl && candle.low < prevCandle.low) {
      triggerSide = 'SELL';
      setupName = '4. Yesterday Low (PDL) Breakdown';
      triggerPrice = prevCandle.low;
      slPrice = prevCandle.high;
    }
    // 5. PDC Breakout (BUY)
    else if (isBullish && prevCandle.close > pdc && prevCandle.open <= pdc && candle.high > prevCandle.high) {
      triggerSide = 'BUY';
      setupName = '5. Yesterday Close (PDC) Breakout';
      triggerPrice = prevCandle.high;
      slPrice = prevCandle.low;
    }
    // 6. PDC Breakdown (SELL)
    else if (isBearish && prevCandle.close < pdc && prevCandle.open >= pdc && candle.low < prevCandle.low) {
      triggerSide = 'SELL';
      setupName = '6. Yesterday Close (PDC) Breakdown';
      triggerPrice = prevCandle.low;
      slPrice = prevCandle.high;
    }

    if (triggerSide && triggerPrice > 0 && slPrice > 0) {
      const slDist = Math.abs(triggerPrice - slPrice);
      if (slDist >= 2) {
        // Target is strictly 1:3 RR
        const tpPrice = triggerSide === 'BUY' ? triggerPrice + 3 * slDist : triggerPrice - 3 * slDist;

        // Position sizing based on risk % and SL distance
        const riskAmount = currentCapital * (params.perTradeRiskPct / 100);
        const rawQty = Math.max(1, Math.floor(riskAmount / slDist));
        const quantity = Math.min(100, rawQty);

        inTrade = true;
        entryCandleIndex = i;
        activeTrade = {
          entryTime: new Date(candle.timestamp).toLocaleString(),
          setupName,
          side: triggerSide,
          entryPrice: triggerPrice,
          stopLoss: slPrice,
          takeProfit: tpPrice,
          quantity,
        };

        dailyTradeCounts[dayKey] = (dailyTradeCounts[dayKey] || 0) + 1;
      }
    }
  }

  // Aggregate stats
  const winningTrades = trades.filter((t) => t.result === 'WIN').length;
  const losingTrades = trades.filter((t) => t.result === 'LOSS').length;
  const totalTrades = trades.length;
  const winRatePct = totalTrades > 0 ? Number(((winningTrades / totalTrades) * 100).toFixed(1)) : 0;
  const netPnl = Number((currentCapital - params.initialCapital).toFixed(2));
  const returnPct = Number(((netPnl / params.initialCapital) * 100).toFixed(2));

  const grossProfit = trades.filter((t) => t.pnl > 0).reduce((acc, t) => acc + t.pnl, 0);
  const grossLoss = Math.abs(trades.filter((t) => t.pnl < 0).reduce((acc, t) => acc + t.pnl, 0));
  const profitFactor = grossLoss > 0 ? Number((grossProfit / grossLoss).toFixed(2)) : (grossProfit > 0 ? 99 : 0);
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
    trades: trades.reverse(), // most recent first
  };
}
