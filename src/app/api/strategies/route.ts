import { NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = getAdminSupabase();
  const { data, error } = await supabase.from('strategies').select('*').order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ strategies: data || [] });
}

export async function PATCH(request: Request) {
  try {
    const { id, is_active, paper_trading, capital_allocation, stop_loss_pct, take_profit_pct } = await request.json();
    const supabase = getAdminSupabase();

    const updateFields: any = { updated_at: new Date().toISOString() };
    if (typeof is_active === 'boolean') updateFields.is_active = is_active;
    if (typeof paper_trading === 'boolean') updateFields.paper_trading = paper_trading;
    if (capital_allocation) updateFields.capital_allocation = Number(capital_allocation);
    if (stop_loss_pct) updateFields.stop_loss_pct = Number(stop_loss_pct);
    if (take_profit_pct) updateFields.take_profit_pct = Number(take_profit_pct);

    const { data, error } = await supabase
      .from('strategies')
      .update(updateFields)
      .eq('id', id)
      .select();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await supabase.from('system_logs').insert({
      level: 'INFO',
      source: 'STRATEGY_CONFIG',
      message: `Updated strategy ${id}: Active=${is_active}, Paper=${paper_trading}`,
    });

    return NextResponse.json({ success: true, strategy: data[0] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
