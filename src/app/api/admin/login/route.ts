import { NextResponse } from 'next/server';
import { isAuthorizedAdminEmail, DEFAULT_ADMIN_PASSCODE } from '@/lib/auth/admin';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { email, passcode } = await request.json();

    if (!isAuthorizedAdminEmail(email)) {
      return NextResponse.json({
        success: false,
        message: 'Unauthorized: This Gmail is not an authorized administrator',
      }, { status: 403 });
    }

    if (!passcode || passcode !== DEFAULT_ADMIN_PASSCODE) {
      return NextResponse.json({
        success: false,
        message: 'Invalid Admin passcode',
      }, { status: 401 });
    }

    const response = NextResponse.json({
      success: true,
      message: 'Admin authenticated successfully',
      adminEmail: email,
    });

    response.cookies.set('myalgo_admin_session', email, {
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      httpOnly: false,
    });

    return response;
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
