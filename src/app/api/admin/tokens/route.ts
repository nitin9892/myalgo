import { NextResponse } from 'next/server';
import { getAdminAuthFromRequest } from '@/lib/auth/admin';
import { 
  getAllAccessTokens, 
  createAccessToken, 
  updateAccessTokenStatus 
} from '@/lib/auth/tokenStorage';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = getAdminAuthFromRequest(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: 'Unauthorized: Admin login required' }, { status: 401 });
  }

  try {
    const tokens = await getAllAccessTokens();
    return NextResponse.json({ success: true, tokens });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message, tokens: [] }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = getAdminAuthFromRequest(request);
    if (!auth.authorized) {
      return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 401 });
    }

    const body = await request.json();
    const { 
      code, 
      label, 
      max_uses = 10, 
      expires_in_days,
      allowed_brokers,
      allowed_strategies,
      commission_rate
    } = body;
    if (!code) {
      return NextResponse.json({ error: 'Token code is required' }, { status: 400 });
    }

    const result = await createAccessToken(
      code,
      label || 'Trader Access',
      Number(max_uses) || 10,
      expires_in_days ? Number(expires_in_days) : undefined,
      auth.email || 'ADMIN',
      allowed_brokers,
      allowed_strategies,
      commission_rate !== undefined ? Number(commission_rate) : 20
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to generate token' }, { status: 500 });
    }

    return NextResponse.json({ success: true, token: result.token });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = getAdminAuthFromRequest(request);
    if (!auth.authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, is_active } = body;
    if (!id || typeof is_active !== 'boolean') {
      return NextResponse.json({ error: 'Invalid token parameters' }, { status: 400 });
    }

    const result = await updateAccessTokenStatus(id, is_active);
    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to update token' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = getAdminAuthFromRequest(request);
    if (!auth.authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing token ID' }, { status: 400 });
    }

    // Revoke token on delete
    const result = await updateAccessTokenStatus(id, false);
    return NextResponse.json({ success: result.success });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
