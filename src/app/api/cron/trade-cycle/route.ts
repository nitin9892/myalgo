import { NextResponse } from 'next/server';
import { runTradingEngineCycle } from '@/lib/strategy/executor';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  // Optional security check for Vercel Cron
  const { searchParams } = new URL(request.url);
  const authHeader = request.headers.get('authorization');
  const secretParam = searchParams.get('key');
  const expectedSecret = process.env.CRON_SECRET;

  if (expectedSecret && secretParam !== expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: 'Unauthorized: Invalid CRON_SECRET' }, { status: 401 });
  }

  const result = await runTradingEngineCycle();
  return NextResponse.json({
    status: 'CYCLE_COMPLETED',
    timestamp: new Date().toISOString(),
    result,
  });
}
