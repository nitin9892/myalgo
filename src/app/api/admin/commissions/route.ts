import { NextResponse } from 'next/server';
import { 
  getAllUserCommissionReports, 
  updateUserCommission, 
  loadCommissionSettings, 
  saveCommissionSettings 
} from '@/lib/commissions/store';

export const dynamic = 'force-dynamic';

function isAuthorizedAdmin(request: Request): boolean {
  const adminEmail = request.headers.get('x-admin-email');
  if (adminEmail && adminEmail.trim()) return true;

  const cookieHeader = request.headers.get('cookie') || '';
  if (cookieHeader.includes('myalgo_admin_session')) return true;

  return false;
}

export async function GET(request: Request) {
  try {
    if (!isAuthorizedAdmin(request)) {
      return NextResponse.json({ success: false, message: 'Unauthorized admin access' }, { status: 401 });
    }

    const data = await getAllUserCommissionReports();
    return NextResponse.json({ success: true, ...data });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    if (!isAuthorizedAdmin(request)) {
      return NextResponse.json({ success: false, message: 'Unauthorized admin access' }, { status: 401 });
    }

    const body = await request.json();
    const action = body.action || 'UPDATE_COMMISSION';

    if (action === 'UPDATE_DEFAULT_RATE') {
      const rate = Number(body.defaultRate);
      if (isNaN(rate) || rate < 0 || rate > 100) {
        return NextResponse.json({ success: false, message: 'Invalid commission rate (must be 0-100)' }, { status: 400 });
      }
      const settings = loadCommissionSettings();
      settings.defaultCommissionRate = rate;
      saveCommissionSettings(settings);

      const data = await getAllUserCommissionReports();
      return NextResponse.json({ success: true, message: `Default commission rate updated to ${rate}%`, ...data });
    }

    if (action === 'SETTLE_USER_COMMISSION') {
      const { userId, settledAmount, notes } = body;
      if (!userId) {
        return NextResponse.json({ success: false, message: 'User ID is required' }, { status: 400 });
      }

      await updateUserCommission(userId, {
        markSettled: true,
        settledAmount: typeof settledAmount === 'number' ? settledAmount : undefined,
        settlementNotes: notes || 'Settled by Admin',
      });

      const data = await getAllUserCommissionReports();
      return NextResponse.json({ success: true, message: `Commission marked settled for ${userId}`, ...data });
    }

    if (action === 'UPDATE_USER_RATE') {
      const { userId, commissionRate } = body;
      if (!userId || commissionRate === undefined) {
        return NextResponse.json({ success: false, message: 'User ID and commission rate are required' }, { status: 400 });
      }

      await updateUserCommission(userId, {
        commissionRate: Number(commissionRate),
      });

      const data = await getAllUserCommissionReports();
      return NextResponse.json({ success: true, message: `Commission rate updated to ${commissionRate}% for ${userId}`, ...data });
    }

    return NextResponse.json({ success: false, message: `Unknown action: ${action}` }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
