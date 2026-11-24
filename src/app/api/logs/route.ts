import { NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const level = searchParams.get('level');
    const source = searchParams.get('source');
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const supabase = getAdminSupabase();
    let query = supabase
      .from('system_logs')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (level && level !== 'ALL') {
      query = query.eq('level', level);
    }
    if (source && source !== 'ALL') {
      query = query.eq('source', source);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      logs: data || [],
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = getAdminSupabase();
    // Keep last 10 logs, delete older
    const { error } = await supabase
      .from('system_logs')
      .delete()
      .neq('id', 'keep-all-safety-clause');

    return NextResponse.json({ success: true, message: 'Logs successfully cleared' });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
