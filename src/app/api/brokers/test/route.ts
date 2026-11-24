import { NextResponse } from 'next/server';
import { getBrokerAdapter } from '@/lib/brokers';
import { BrokerType } from '@/lib/brokers/types';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { broker, credentials } = await request.json();
    const adapter = getBrokerAdapter(broker as BrokerType, credentials);
    const result = await adapter.testConnection();
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
