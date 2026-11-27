import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getBrokerAdapter } from '@/lib/brokers';
import { BrokerType } from '@/lib/brokers/types';
import { saveRiskConfiguration } from '@/lib/risk/engine';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { broker, credentials } = await request.json();

    if (!broker || !credentials) {
      return NextResponse.json(
        { success: false, message: 'Broker ID and credentials are required for sync' },
        { status: 400 }
      );
    }

    const adapter = getBrokerAdapter(broker as BrokerType, credentials);
    const result = await adapter.testConnection();

    // If connection succeeds, persist credentials for autonomous background engine execution
    if (result.success) {
      try {
        const credsDir = path.join(process.cwd(), 'data');
        if (!fs.existsSync(credsDir)) fs.mkdirSync(credsDir, { recursive: true });
        const credsFile = path.join(credsDir, 'broker_creds.json');
        let existing: Record<string, any> = {};
        if (fs.existsSync(credsFile)) {
          try { existing = JSON.parse(fs.readFileSync(credsFile, 'utf-8')); } catch {}
        }
        existing[broker] = credentials;
        fs.writeFileSync(credsFile, JSON.stringify(existing, null, 2), 'utf-8');
      } catch (saveErr: any) {
        console.warn('Could not save credentials to broker_creds.json:', saveErr.message);
      }
    }

    // If connection succeeds and balance is available, automatically sync into risk engine wallet balance
    if (result.success && typeof result.balance === 'number' && result.balance > 0) {
      try {
        await saveRiskConfiguration({
          walletBalance: Number(result.balance.toFixed(2)),
          autoSyncWallet: true,
        });
      } catch (err: any) {
        console.warn('Could not update risk configuration balance:', err.message);
      }
    }

    return NextResponse.json({
      success: result.success,
      message: result.message,
      balance: result.balance,
      currency: result.currency || 'INR',
      balanceDisplay: result.balanceDisplay,
      syncedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err.message || 'Failed to sync broker balance' },
      { status: 500 }
    );
  }
}
