import { NextResponse } from 'next/server';
import { getAdminAuthFromRequest } from '@/lib/auth/admin';
import { runRealMarketBacktest, BacktestParams } from '@/lib/backtest/engine';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const auth = getAdminAuthFromRequest(request);

    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Only verified administrators can access the Real Market Backtesting engine.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const params: BacktestParams = {
      strategy: body.strategy || 'Strategy C',
      symbol: body.symbol || 'BTCUSD',
      timeframe: body.timeframe || '5m',
      days: Math.min(60, Math.max(1, Number(body.days || 7))),
      initialCapital: Math.max(100, Number(body.initialCapital || 100000)),
      perTradeRiskPct: Math.min(25, Math.max(0.5, Number(body.perTradeRiskPct || 5))),
      leverage: Number(body.leverage || 10),
      maxTradesPerDay: Number(body.maxTradesPerDay || 3),
      trailingEnabled: body.trailingEnabled ?? true,
    };

    const results = await runRealMarketBacktest(params);
    return NextResponse.json({ success: true, results });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Backtest execution failed' },
      { status: 500 }
    );
  }
}
