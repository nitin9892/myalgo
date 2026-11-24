import { NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const FALLBACK_TOKENS = ['ALGO-MASTER-777', 'VIP-ACCESS-2026', 'ADMIN-NITIN-9892'];

export async function POST(request: Request) {
  try {
    const { code } = await request.json();
    if (!code || typeof code !== 'string') {
      return NextResponse.json({ success: false, message: 'Please enter an access code' }, { status: 400 });
    }

    const cleanCode = code.trim().toUpperCase();

    // 1. Check fallback master tokens first
    if (FALLBACK_TOKENS.includes(cleanCode)) {
      const response = NextResponse.json({
        success: true,
        message: 'Master access granted',
        token: { code: cleanCode, label: 'Master Access' },
      });
      response.cookies.set('myalgo_access_token', cleanCode, {
        path: '/',
        maxAge: 60 * 60 * 24 * 30, // 30 days
        httpOnly: false, // accessible to client for session checks
      });
      return response;
    }

    // 2. Check Supabase access_tokens table
    const supabase = getAdminSupabase();
    const { data, error } = await supabase
      .from('access_tokens')
      .select('*')
      .eq('code', cleanCode)
      .single();

    if (error || !data) {
      return NextResponse.json({ success: false, message: 'Invalid access code' }, { status: 401 });
    }

    if (!data.is_active) {
      return NextResponse.json({ success: false, message: 'This access code has been revoked by admin' }, { status: 403 });
    }

    if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ success: false, message: 'This access code has expired' }, { status: 403 });
    }

    if (data.max_uses && data.used_count >= data.max_uses) {
      return NextResponse.json({ success: false, message: 'This access code usage limit has been reached' }, { status: 403 });
    }

    // Increment used count
    await supabase
      .from('access_tokens')
      .update({ used_count: (data.used_count || 0) + 1 })
      .eq('id', data.id);

    const response = NextResponse.json({
      success: true,
      message: 'Access granted successfully',
      token: { code: data.code, label: data.label },
    });

    response.cookies.set('myalgo_access_token', cleanCode, {
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
      httpOnly: false,
    });

    return response;
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
