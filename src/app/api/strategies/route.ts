import { NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase';
import { DEFAULT_MASTER_STRATEGY } from '@/lib/strategy/executor';

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

    const strategyRecord = {
      id: body.id || 'master-5m-breakout',
      name: body.name || '5m Previous Day Levels Breakout Engine',
      broker_name: body.broker_name || 'DHAN',
      symbol: body.symbol || 'NIFTY',
      timeframe: '5m',
      strategy_type: 'PREV_DAY_BREAKOUT',
      is_active: body.is_active ?? true,
      paper_trading: body.paper_trading ?? true,
      parameters: body.params || body.parameters || {},
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('strategies')
      .upsert(strategyRecord)
      .select();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    await supabase.from('system_logs').insert({
      level: 'INFO',
      source: 'STRATEGY_CONFIG',
      message: `Master Strategy updated: Broker=${strategyRecord.broker_name}, Symbol=${strategyRecord.symbol}, Active=${strategyRecord.is_active}, Paper=${strategyRecord.paper_trading}`,
      metadata: strategyRecord,
    });

    return NextResponse.json({ success: true, strategy: data?.[0] || strategyRecord });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
