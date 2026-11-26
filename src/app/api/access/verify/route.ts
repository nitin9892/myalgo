import { NextResponse } from 'next/server';
import { verifyAndConsumeAccessToken, verifyAccessTokenStatusOnly } from '@/lib/auth/tokenStorage';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { code, checkOnly } = await request.json();
    if (!code || typeof code !== 'string') {
      return NextResponse.json({ success: false, message: 'Please enter an access code' }, { status: 400 });
    }

    const cleanCode = code.trim().toUpperCase();

    // If checkOnly is true, only verify active status without incrementing used_count
    if (checkOnly) {
      const verification = await verifyAccessTokenStatusOnly(cleanCode);
      if (!verification.valid) {
        const response = NextResponse.json(
          { success: false, revoked: true, message: verification.message },
          { status: 401 }
        );
        response.cookies.delete('myalgo_access_token');
        return response;
      }

      return NextResponse.json({
        success: true,
        message: verification.message,
        token: {
          code: verification.token?.code || cleanCode,
          label: verification.token?.label || 'Trader Access',
        },
      });
    }

    // Regular full verification and consumption
    const verification = await verifyAndConsumeAccessToken(cleanCode);

    if (!verification.valid) {
      const response = NextResponse.json(
        { success: false, message: verification.message },
        { status: 401 }
      );
      response.cookies.delete('myalgo_access_token');
      return response;
    }

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
