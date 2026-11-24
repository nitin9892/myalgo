import { NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase';
import { DEFAULT_MASTER_STRATEGY } from '@/lib/strategy/executor';
import { saveRiskConfiguration } from '@/lib/risk/engine';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = getAdminSupabase();
    const { data } = await supabase
      .from('strategies')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (data) {
      return NextResponse.json({ success: true, strategy: data });
    }
    return NextResponse.json({ success: true, strategy: DEFAULT_MASTER_STRATEGY });
  } catch (err: any) {
    return NextResponse.json({ success: true, strategy: DEFAULT_MASTER_STRATEGY });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const supabase = getAdminSupabase();

    const strategyName = body.name || body.strategy || 'Strategy C';
    const symbolsArray = Array.isArray(body.symbols)
      ? body.symbols
      : (body.symbol ? body.symbol.split(',').map((x: string) => x.trim()) : ['BTCUSD']);
    const symbol = symbolsArray.join(',');
    const dailyLossPct = Number(body.dailyLossPct || body.daily_loss_pct || 15);
    const perTradeRiskPct = Number(body.perTradeRiskPct || body.per_trade_risk_pct || 5);
    const maxTradesPerDay = Number(body.maxTradesPerDay || body.max_trades_per_day || 3);

    // Sync risk configuration
    await saveRiskConfiguration({
      maxDailyLossPct: dailyLossPct,
      perTradeRiskPct: perTradeRiskPct,
      maxOpenTrades: 2,
    });

    const strategyRecord = {
      id: body.id || 'master-strategy-active',
      name: strategyName,
      broker_name: body.broker_name || 'DELTA',
      symbol: symbol,
      timeframe: '5m',
      strategy_type: 'CUSTOM_ALGO',
      is_active: body.is_active ?? true,
      paper_trading: body.paper_trading ?? true,
      parameters: {
        symbols: symbolsArray,
        daily_loss_pct: dailyLossPct,
        per_trade_risk_pct: perTradeRiskPct,
        max_trades_per_day: maxTradesPerDay,
        leverage_mode: 'MEDIUM',
        ...(body.params || {}),
      },
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('strategies')
      .upsert(strategyRecord)
      .select();

    if (error) {
      console.warn('DB upsert error (fallback to local success):', error.message);
    }

    await supabase.from('system_logs').insert({
      level: 'INFO',
      source: 'STRATEGY_CONFIG',
      message: `Active Strategy Configured: [${strategyName}] on ${symbol} | Daily Loss: ${dailyLossPct}% | Risk/Trade: ${perTradeRiskPct}% | Max Trades/Day: ${maxTradesPerDay} | Medium Leverage`,
      metadata: strategyRecord,
    });

    return NextResponse.json({ success: true, strategy: data?.[0] || strategyRecord });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
