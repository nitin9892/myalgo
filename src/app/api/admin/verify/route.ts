import { NextResponse } from 'next/server';
import { getAdminAuthFromRequest } from '@/lib/auth/admin';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = getAdminAuthFromRequest(request);
  if (!auth.authorized || !auth.email) {
    return NextResponse.json({ success: false, authorized: false, message: 'Unauthorized admin session' }, { status: 401 });
  }

  return NextResponse.json({
    success: true,
    authorized: true,
    email: auth.email,
  });
}
