import { NextResponse } from 'next/server';
import { isAuthorizedAdminEmail, DEFAULT_ADMIN_PASSCODE, createAdminSessionToken } from '@/lib/auth/admin';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { email, passcode } = await request.json();

    if (!email || !isAuthorizedAdminEmail(email)) {
      return NextResponse.json({
        success: false,
        message: 'Unauthorized: This email is not an authorized administrator',
      }, { status: 403 });
    }

    if (!passcode || passcode !== DEFAULT_ADMIN_PASSCODE) {
      return NextResponse.json({
        success: false,
        message: 'Invalid Admin passcode',
      }, { status: 401 });
    }

    const sessionToken = createAdminSessionToken(email.trim());

    const response = NextResponse.json({
      success: true,
      message: 'Admin authenticated successfully',
      token: sessionToken,
      adminEmail: email.trim().toLowerCase(),
    });

    // Set secure HTTP-only session token cookie
    response.cookies.set('myalgo_admin_token', sessionToken, {
      path: '/',
      maxAge: 60 * 60 * 24, // 24 hours
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });

    // Clean up old insecure cookie if present
    response.cookies.delete('myalgo_admin_session');

    return response;
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
