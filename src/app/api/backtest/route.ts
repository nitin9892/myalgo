import { NextResponse } from 'next/server';
import { runRealMarketBacktest, BacktestParams } from '@/lib/backtest/engine';
import { cleanUserId } from '@/lib/forward_test/store';

export const dynamic = 'force-dynamic';

function extractUserId(request: Request, body?: any): string {
  const headerToken = request.headers.get('x-access-token');
  if (headerToken && headerToken.trim()) return cleanUserId(headerToken);

  if (body?.userId && typeof body.userId === 'string' && body.userId.trim()) {
    return cleanUserId(body.userId);
  }
  if (body?.token && typeof body.token === 'string' && body.token.trim()) {
    return cleanUserId(body.token);
  }

  const cookieHeader = request.headers.get('cookie') || '';
  const match = cookieHeader.match(/myalgo_access_token=([^;]+)/);
  if (match && match[1]) {
    try { return cleanUserId(decodeURIComponent(match[1])); } catch {}
  }

  return 'DEFAULT_TRADER';
}

function calculateAutoLeverage(strategy: string, riskPct: number): number {
  let avgSlPct = 0.4; // 0.4% for Strategy B scalping
  if (strategy === 'Strategy C') avgSlPct = 1.0; // 1% for daily breakout
  if (strategy === 'Strategy A') avgSlPct = 1.2; // 1.2% for momentum

  const raw = Math.ceil(riskPct / avgSlPct);
  return Math.min(50, Math.max(1, raw));
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const userId = extractUserId(request, body);

    const strategy = body.strategy || 'Strategy B';
    const riskPct = Math.min(25, Math.max(0.25, Number(body.perTradeRiskPct || 2)));
    const initialCapital = Math.max(100, Number(body.initialCapital || 10000));
    
    // Auto calculate leverage if requested or unspecified
    let leverage = Number(body.leverage);
    if (!leverage || body.autoLeverage) {
      leverage = calculateAutoLeverage(strategy, riskPct);
    }

    const params: BacktestParams = {
      strategy,
      symbol: body.symbol || 'BTCUSD',
      timeframe: (body.timeframe as any) || '5m',
      days: Math.min(60, Math.max(1, Number(body.days || 7))),
      initialCapital,
      perTradeRiskPct: riskPct,
      leverage,
      maxTradesPerDay: Number(body.maxTradesPerDay || 5),
      trailingEnabled: body.trailingEnabled ?? true,
    };

    const results = await runRealMarketBacktest(params);
    return NextResponse.json({ 
      success: true, 
      userId, 
      autoLeverage: leverage,
      results 
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Backtest execution failed' },
      { status: 500 }
    );
  }
}
