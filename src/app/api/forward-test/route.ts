import { NextResponse } from 'next/server';
import { 
  loadForwardTestState, 
  saveForwardTestState, 
  resetVirtualWallet,
  cleanUserId
} from '@/lib/forward_test/store';
import { 
  runForwardTestCycle, 
  runOneDayRealtimeReplay, 
  squareOffForwardPosition 
} from '@/lib/forward_test/engine';

export const dynamic = 'force-dynamic';

function extractUserId(request: Request, body?: any): string {
  // 1. Header
  const headerToken = request.headers.get('x-access-token');
  if (headerToken && headerToken.trim()) {
    return cleanUserId(headerToken);
  }

  // 2. Request body
  if (body?.userId && typeof body.userId === 'string' && body.userId.trim()) {
    return cleanUserId(body.userId);
  }
  if (body?.token && typeof body.token === 'string' && body.token.trim()) {
    return cleanUserId(body.token);
  }

  // 3. Cookie header
  const cookieHeader = request.headers.get('cookie') || '';
  const match = cookieHeader.match(/myalgo_access_token=([^;]+)/);
  if (match && match[1]) {
    try {
      return cleanUserId(decodeURIComponent(match[1]));
    } catch {}
  }

  // 4. URL query param
  try {
    const url = new URL(request.url);
    const queryToken = url.searchParams.get('userId') || url.searchParams.get('token');
    if (queryToken && queryToken.trim()) {
      return cleanUserId(queryToken);
    }
  } catch {}

  return 'DEFAULT_TRADER';
}

function computeStats(state: any) {
  const closed = state.closedTrades || [];
  const wins = closed.filter((t: any) => t.result === 'WIN').length;
  const losses = closed.filter((t: any) => t.result === 'LOSS').length;
  const total = closed.length;
  const winRate = total > 0 ? Number(((wins / total) * 100).toFixed(1)) : 0;
  const netRealized = closed.reduce((acc: number, t: any) => acc + (t.realizedPnl || 0), 0);
  const netUnrealized = (state.positions || []).reduce((acc: number, p: any) => acc + (p.unrealizedPnl || 0), 0);

  return {
    totalTrades: total,
    winningTrades: wins,
    losingTrades: losses,
    winRatePct: winRate,
    netRealizedPnl: Number(netRealized.toFixed(2)),
    netUnrealizedPnl: Number(netUnrealized.toFixed(2)),
    totalPnl: Number((netRealized + netUnrealized).toFixed(2)),
    returnPct: state.wallet.startingBalance > 0
      ? Number((((netRealized + netUnrealized) / state.wallet.startingBalance) * 100).toFixed(2))
      : 0,
  };
}

export async function GET(request: Request) {
  try {
    const userId = extractUserId(request);
    const state = loadForwardTestState(userId);
    const stats = computeStats(state);
    return NextResponse.json({ success: true, userId, state, stats });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const action = body.action || 'SYNC_CYCLE';
    const userId = extractUserId(request, body);

    let state = loadForwardTestState(userId);

    switch (action) {
      case 'SYNC_CYCLE': {
        state = await runForwardTestCycle(userId);
        break;
      }

      case 'RUN_1DAY_REPLAY': {
        const strategy = body.strategy || state.config.strategy || 'Strategy B';
        const symbols = body.symbols && Array.isArray(body.symbols) && body.symbols.length > 0
          ? body.symbols
          : state.config.symbols;
        const capital = Math.max(100, Number(body.startingCapital || state.wallet.startingBalance || 10000));
        const riskPct = Math.min(10, Math.max(0.25, Number(body.perTradeRiskPct || state.config.perTradeRiskPct || 2)));
        const overallRiskPct = Math.min(50, Math.max(1, Number(body.overallRiskPct || state.config.overallRiskPct || 10)));
        if (body.timeframe) state.config.timeframe = body.timeframe;

        state = await runOneDayRealtimeReplay(strategy, symbols, capital, riskPct, userId, overallRiskPct);
        break;
      }

      case 'START': {
        state.config.isRunning = true;
        state.config.riskPausedReason = null;
        saveForwardTestState(state, userId);
        state = await runForwardTestCycle(userId);
        break;
      }

      case 'PAUSE': {
        state.config.isRunning = false;
        saveForwardTestState(state, userId);
        break;
      }

      case 'UPDATE_CONFIG': {
        if (body.strategy) state.config.strategy = body.strategy;
        if (body.symbols && Array.isArray(body.symbols) && body.symbols.length > 0) {
          state.config.symbols = body.symbols;
        }
        if (body.timeframe) state.config.timeframe = body.timeframe;
        if (body.perTradeRiskPct) state.config.perTradeRiskPct = Number(body.perTradeRiskPct);
        if (body.overallRiskPct) state.config.overallRiskPct = Number(body.overallRiskPct);
        if (body.leverage) {
          state.config.leverage = Number(body.leverage);
          state.config.autoLeverage = false;
        } else {
          state.config.autoLeverage = true;
        }
        state.config.riskPausedReason = null;
        saveForwardTestState(state, userId);
        break;
      }

      case 'RESET_WALLET': {
        const newBalance = Math.max(100, Number(body.startingBalance || 10000));
        state = resetVirtualWallet(userId, newBalance);
        break;
      }

      case 'SQUARE_OFF': {
        if (body.positionId) {
          state = squareOffForwardPosition(body.positionId, userId);
        }
        break;
      }

      default: {
        return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
      }
    }

    const stats = computeStats(state);
    return NextResponse.json({ success: true, userId, state, stats });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
