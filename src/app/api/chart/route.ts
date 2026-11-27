import { NextResponse } from 'next/server';
import { fetchRealHistoricalCandles } from '@/lib/backtest/engine';
import { 
  detectFairValueGaps, 
  detectOrderBlocks, 
  detectLiquiditySweeps, 
  detectSwingPoints, 
  evaluatePhantomICTStrategy 
} from '@/lib/strategy/phantom_ict';
import { cleanUserId, loadForwardTestState } from '@/lib/forward_test/store';

export const dynamic = 'force-dynamic';

function extractUserId(request: Request): string {
  const headerToken = request.headers.get('x-access-token');
  if (headerToken && headerToken.trim()) return cleanUserId(headerToken);

  const cookieHeader = request.headers.get('cookie') || '';
  const match = cookieHeader.match(/myalgo_access_token=([^;]+)/);
  if (match && match[1]) {
    try { return cleanUserId(decodeURIComponent(match[1])); } catch {}
  }

  try {
    const url = new URL(request.url);
    const q = url.searchParams.get('userId');
    if (q) return cleanUserId(q);
  } catch {}

  return 'DEFAULT_TRADER';
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawSymbol = searchParams.get('symbol') || 'BTCUSD';
    const symbol = rawSymbol.toUpperCase().replace('/', '').trim();
    const timeframe = (searchParams.get('timeframe') || '5m') as '1m' | '5m' | '15m' | '1h';
    const strategy = searchParams.get('strategy') || 'Strategy B';
    const userId = extractUserId(request);

    // 1. Fetch real historical candles from Delta India / Binance Vision Feed
    // 3 days covers plenty of candles for 5m (864 candles)
    const days = timeframe === '1h' ? 14 : (timeframe === '15m' ? 5 : 2);
    const { candles, source } = await fetchRealHistoricalCandles(symbol, timeframe === '1m' ? '5m' : timeframe, days);

    if (!candles || candles.length === 0) {
      return NextResponse.json({ success: false, error: `No candles returned for ${symbol}` }, { status: 404 });
    }

    // Take the last 120 candles for clean high-frequency chart rendering
    const chartCandles = candles.slice(-120);
    const latestCandle = chartCandles[chartCandles.length - 1];
    const currentPrice = latestCandle.close;

    // 2. Automated Smart Markings Detection (SMC + ICT Engine)
    const swingPoints = detectSwingPoints(chartCandles, 3);
    const fvgs = detectFairValueGaps(chartCandles, 0.05);
    const orderBlocks = detectOrderBlocks(chartCandles, fvgs);
    const sweeps = detectLiquiditySweeps(chartCandles, swingPoints);

    // 3. Compute Key Reference Levels (PDH, PDL, PDC)
    // Anchored to the candles preceding the current day
    const prevCandles = candles.slice(0, Math.max(1, candles.length - 24));
    const pdh = Math.max(...prevCandles.map((c) => c.high));
    const pdl = Math.min(...prevCandles.map((c) => c.low));
    const pdc = prevCandles[prevCandles.length - 1]?.close || currentPrice;

    // 4. Run Strategy Brain Evaluation
    const strategyEval = evaluatePhantomICTStrategy(chartCandles.slice(-40), null, currentPrice, { riskRewardRatio: 3.5 });

    // 5. Look for Active Trade (from Forward Test or Live)
    let activeTrade: any = null;
    try {
      const fState = loadForwardTestState(userId);
      const pos = (fState.positions || []).find((p) => p.symbol.includes(symbol) || symbol.includes(p.symbol));
      if (pos) {
        activeTrade = {
          id: pos.id,
          side: pos.side,
          entryPrice: pos.entryPrice,
          currentPrice: pos.currentPrice || currentPrice,
          stopLoss: pos.stopLoss,
          takeProfit: pos.takeProfit,
          unrealizedPnl: pos.unrealizedPnl,
          unrealizedPnlPct: pos.unrealizedPnlPct,
          setupName: pos.setupName,
        };
      }
    } catch {}

    // 6. Formulate Bot Brain AI Insights
    const freshBullishOb = orderBlocks.filter((b) => b.type === 'BULLISH' && !b.mitigated).slice(-1)[0];
    const freshBearishOb = orderBlocks.filter((b) => b.type === 'BEARISH' && !b.mitigated).slice(-1)[0];
    const recentSweep = sweeps.slice(-1)[0];

    const aiContext = [
      strategyEval.signalReason || (strategyEval.signal ? `${strategyEval.signal} Signal: ${strategyEval.setupName}` : 'Scanning for Institutional Confluence'),
      freshBullishOb ? `Bullish OB Zone at $${freshBullishOb.low.toFixed(1)} - $${freshBullishOb.high.toFixed(1)}` : null,
      freshBearishOb ? `Bearish OB Zone at $${freshBearishOb.low.toFixed(1)} - $${freshBearishOb.high.toFixed(1)}` : null,
      recentSweep ? `${recentSweep.type} swept at $${recentSweep.sweptPrice.toFixed(1)}` : null,
      activeTrade ? `Active ${activeTrade.side} trade running (${activeTrade.unrealizedPnlPct}%)` : 'Targeting 1:3.5 RR setup',
    ].filter(Boolean).join(' • ');

    return NextResponse.json({
      success: true,
      symbol,
      timeframe,
      dataSource: source,
      currentPrice,
      candles: chartCandles,
      orderBlocks: orderBlocks.slice(-8), // Keep recent key OBs
      fvgs: fvgs.slice(-8), // Keep recent FVGs
      swingPoints: swingPoints.slice(-10),
      sweeps: sweeps.slice(-4),
      keyLevels: {
        pdh: Number(pdh.toFixed(2)),
        pdl: Number(pdl.toFixed(2)),
        pdc: Number(pdc.toFixed(2)),
      },
      activeTrade,
      strategyEval: {
        canEnter: strategyEval.canEnterNewTrade,
        signal: strategyEval.signal,
        setupName: strategyEval.setupName,
        stopLoss: strategyEval.stopLoss,
        target: strategyEval.target,
        signalReason: strategyEval.signalReason,
      },
      aiContext,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to fetch live chart data' },
      { status: 500 }
    );
  }
}
