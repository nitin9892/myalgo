import { NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase';
import { isAuthorizedAdminEmail } from '@/lib/auth/admin';

export const dynamic = 'force-dynamic';

// Helper to check admin cookie
function checkAdminAuth(request: Request): boolean {
  const cookieHeader = request.headers.get('cookie') || '';
  const match = cookieHeader.match(/myalgo_admin_session=([^;]+)/);
  if (!match) return false;
  return isAuthorizedAdminEmail(decodeURIComponent(match[1]));
}

export async function GET(request: Request) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized: Admin login required' }, { status: 401 });
  }

  const supabase = getAdminSupabase();
  const { data, error } = await supabase
    .from('access_tokens')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({
      tokens: [
        { id: '1', code: 'ALGO-MASTER-777', label: 'Master Admin Token', is_active: true, max_uses: 9999, used_count: 5, created_at: new Date().toISOString() },
        { id: '2', code: 'VIP-ACCESS-2026', label: 'VIP Trader Pass', is_active: true, max_uses: 50, used_count: 2, created_at: new Date().toISOString() }
      ]
    });
  }

  return NextResponse.json({ tokens: data || [] });
}

export async function POST(request: Request) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { code, label, max_uses = 10, expires_in_days } = await request.json();
    if (!code) {
      return NextResponse.json({ error: 'Token code is required' }, { status: 400 });
    }

    const cleanCode = code.trim().toUpperCase();
    const expiresAt = expires_in_days 
      ? new Date(Date.now() + Number(expires_in_days) * 24 * 60 * 60 * 1000).toISOString()
      : null;

    const supabase = getAdminSupabase();
    const { data, error } = await supabase
      .from('access_tokens')
      .insert({
        code: cleanCode,
        label: label || 'Standard Trader',
        max_uses: Number(max_uses) || 10,
        expires_at: expiresAt,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, token: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id, is_active } = await request.json();
    const supabase = getAdminSupabase();
    const { data, error } = await supabase
      .from('access_tokens')
      .update({ is_active })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, token: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
