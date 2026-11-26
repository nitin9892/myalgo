import { NextResponse } from 'next/server';
import { 
  loadForwardTestState, 
  saveForwardTestState, 
  resetVirtualWallet 
} from '@/lib/forward_test/store';
import { 
  runForwardTestCycle, 
  runOneDayRealtimeReplay, 
  squareOffForwardPosition 
} from '@/lib/forward_test/engine';

export const dynamic = 'force-dynamic';

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

export async function GET() {
  try {
    const state = loadForwardTestState();
    const stats = computeStats(state);
    return NextResponse.json({ success: true, state, stats });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const action = body.action || 'SYNC_CYCLE';

    let state = loadForwardTestState();

    switch (action) {
      case 'SYNC_CYCLE': {
        state = await runForwardTestCycle();
        break;
      }

      case 'RUN_1DAY_REPLAY': {
        const strategy = body.strategy || state.config.strategy || 'Strategy C';
        const symbols = body.symbols && Array.isArray(body.symbols) && body.symbols.length > 0
          ? body.symbols
          : state.config.symbols;
        const capital = Math.max(1000, Number(body.startingCapital || state.wallet.startingBalance || 100000));
        const riskPct = Math.min(10, Math.max(0.5, Number(body.perTradeRiskPct || state.config.perTradeRiskPct || 2)));

        state = await runOneDayRealtimeReplay(strategy, symbols, capital, riskPct);
        break;
      }

      case 'START': {
        state.config.isRunning = true;
        saveForwardTestState(state);
        state = await runForwardTestCycle();
        break;
      }

      case 'PAUSE': {
        state.config.isRunning = false;
        saveForwardTestState(state);
        break;
      }

      case 'UPDATE_CONFIG': {
        if (body.strategy) state.config.strategy = body.strategy;
        if (body.symbols && Array.isArray(body.symbols) && body.symbols.length > 0) {
          state.config.symbols = body.symbols;
        }
        if (body.perTradeRiskPct) state.config.perTradeRiskPct = Number(body.perTradeRiskPct);
        if (body.leverage) state.config.leverage = Number(body.leverage);
        saveForwardTestState(state);
        break;
      }

      case 'RESET_WALLET': {
        const newBalance = Math.max(1000, Number(body.startingBalance || 100000));
        state = resetVirtualWallet(newBalance);
        break;
      }

      case 'SQUARE_OFF': {
        if (body.positionId) {
          state = squareOffForwardPosition(body.positionId);
        }
        break;
      }

      default: {
        return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
      }
    }

    const stats = computeStats(state);
    return NextResponse.json({ success: true, state, stats });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
