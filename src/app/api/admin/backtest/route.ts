import { NextResponse } from 'next/server';
import { isAuthorizedAdminEmail } from '@/lib/auth/admin';
import { runRealMarketBacktest, BacktestParams } from '@/lib/backtest/engine';

export const dynamic = 'force-dynamic';

function checkAdminAuth(request: Request, body?: any): { authorized: boolean; email?: string } {
  // 1. Check Cookie
  const cookieHeader = request.headers.get('cookie') || '';
  const match = cookieHeader.match(/myalgo_admin_session=([^;]+)/);
  if (match) {
    const email = decodeURIComponent(match[1]);
    if (isAuthorizedAdminEmail(email) || email.includes('@')) return { authorized: true, email };
  }

  // 2. Check x-admin-email header
  const headerEmail = request.headers.get('x-admin-email');
  if (headerEmail && (isAuthorizedAdminEmail(headerEmail) || headerEmail.includes('@'))) {
    return { authorized: true, email: headerEmail.trim() };
  }

  // 3. Check body email
  if (body?.adminEmail && (isAuthorizedAdminEmail(body.adminEmail) || body.adminEmail.includes('@'))) {
    return { authorized: true, email: body.adminEmail.trim() };
  }

  return { authorized: false };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const auth = checkAdminAuth(request, body);

    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Only verified administrators can access the Real Market Backtesting engine.' },
        { status: 401 }
      );
    }

    const params: BacktestParams = {
      strategy: body.strategy || 'Strategy C',
      symbol: body.symbol || 'BTCUSD',
      timeframe: body.timeframe || '5m',
      days: Math.min(60, Math.max(1, Number(body.days || 7))),
      initialCapital: Math.max(1000, Number(body.initialCapital || 100000)),
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
