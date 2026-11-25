import { NextResponse } from 'next/server';
import { verifyAndConsumeAccessToken } from '@/lib/auth/tokenStorage';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { code } = await request.json();
    if (!code || typeof code !== 'string') {
      return NextResponse.json({ success: false, message: 'Please enter an access code' }, { status: 400 });
    }

    const verification = await verifyAndConsumeAccessToken(code);

    if (!verification.valid) {
      return NextResponse.json({ success: false, message: verification.message }, { status: 401 });
    }

    const cleanCode = code.trim().toUpperCase();
    const response = NextResponse.json({
      success: true,
      message: verification.message,
      token: { 
        code: verification.token?.code || cleanCode, 
        label: verification.token?.label || 'Trader Access' 
      },
    });

    response.cookies.set('myalgo_access_token', cleanCode, {
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      httpOnly: false, // accessible to client for session checks
    });

    return response;
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
