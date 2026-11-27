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
      .order('updated_at', { ascending: false })
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
    const leverageMode = (body.leverageMode || body.leverage_mode || 'MANUAL').toUpperCase() === 'DYNAMIC' ? 'DYNAMIC' : 'MANUAL';
    const leverage = Number(body.leverage || 10);

    // Sync risk configuration
    await saveRiskConfiguration({
      maxDailyLossPct: dailyLossPct,
      perTradeRiskPct: perTradeRiskPct,
      maxOpenTrades: 2,
    });

    const selectedTimeframe = body.timeframe || body.parameters?.timeframe || '5m';

    const strategyRecord = {
      id: body.id || 'master-strategy-active',
      name: strategyName,
      broker_name: body.broker_name || 'DELTA',
      symbol: symbol,
      timeframe: selectedTimeframe,
      strategy_type: 'CUSTOM_ALGO',
      is_active: body.is_active ?? true,
      paper_trading: false,
      parameters: {
        symbols: symbolsArray,
        timeframe: selectedTimeframe,
        daily_loss_pct: dailyLossPct,
        per_trade_risk_pct: perTradeRiskPct,
        max_trades_per_day: maxTradesPerDay,
        leverage_mode: leverageMode,
        leverage: leverage,
        trailing_rule: '35% SL trail per 100% favorable move',
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

    const leverageLabel = leverageMode === 'MANUAL' ? `${leverage}x (Manual)` : 'Dynamic Medium (5x-10x)';
    await supabase.from('system_logs').insert({
      level: 'INFO',
      source: 'STRATEGY_CONFIG',
      message: `Active Strategy Configured: [${strategyName}] on ${symbol} | Daily Loss: ${dailyLossPct}% | Risk/Trade: ${perTradeRiskPct}% | Max Trades/Day: ${maxTradesPerDay} | Leverage: ${leverageLabel}`,
      metadata: strategyRecord,
    });

    return NextResponse.json({ success: true, strategy: data?.[0] || strategyRecord });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const isActive = body.is_active !== undefined ? Boolean(body.is_active) : (body.isActive !== undefined ? Boolean(body.isActive) : true);
    const supabase = getAdminSupabase();

    const { data: existing } = await supabase.from('strategies').select('*').limit(1).maybeSingle();
    let updatedRecord: any = null;

    if (existing) {
      const { data, error } = await supabase
        .from('strategies')
        .update({ is_active: isActive, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
        .select();
      if (!error && data?.[0]) updatedRecord = data[0];
      if (error) console.warn('DB update error on algo switch:', error.message);
    } else {
      const { data, error } = await supabase
        .from('strategies')
        .upsert({
          ...DEFAULT_MASTER_STRATEGY,
          id: 'master-strategy-active',
          is_active: isActive,
          updated_at: new Date().toISOString(),
        })
        .select();
      if (!error && data?.[0]) updatedRecord = data[0];
      if (error) console.warn('DB upsert error on algo switch:', error.message);
    }

    const strategyId = existing?.id || 'master-strategy-active';

    await supabase.from('system_logs').insert({
      level: 'INFO',
      source: 'ALGO_SWITCH',
      message: `Master Algo Switch toggled to: ${isActive ? 'ON 🟢 (ACTIVE)' : 'OFF ⚪ (PAUSED)'}`,
      metadata: { is_active: isActive, strategyId },
    });

    return NextResponse.json({
      success: true,
      is_active: isActive,
      strategy: updatedRecord || { id: strategyId, is_active: isActive }
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
