import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getBrokerAdapter } from '@/lib/brokers';
import { BrokerType } from '@/lib/brokers/types';
import { saveRiskConfiguration } from '@/lib/risk/engine';
import { 
  cleanUserId, 
  loadUserBrokerCreds, 
  saveUserBrokerCreds, 
  loadUserBrokerStatus, 
  saveUserBrokerStatus,
  maskCredential
} from '@/lib/brokers/store';

export const dynamic = 'force-dynamic';

function extractUserId(request: Request, body?: any): string {
  const headerToken = request.headers.get('x-access-token');
  if (headerToken && headerToken.trim()) return cleanUserId(headerToken);

  if (body?.userId && typeof body.userId === 'string' && body.userId.trim()) {
    return cleanUserId(body.userId);
  }
  if (body?.token && typeof body.token === 'string' && body.token.trim()) {
    return cleanUserId(body.token);
  }

  const cookieHeader = request.headers.get('cookie') || '';
  const match = cookieHeader.match(/myalgo_access_token=([^;]+)/);
  if (match && match[1]) {
    try { return cleanUserId(decodeURIComponent(match[1])); } catch {}
  }

  try {
    const url = new URL(request.url);
    const qToken = url.searchParams.get('userId') || url.searchParams.get('token');
    if (qToken && qToken.trim()) return cleanUserId(qToken);
  } catch {}

  return 'DEFAULT_TRADER';
}

async function detectServerPublicIp(): Promise<string | null> {
  try {
    const res = await fetch('https://api.ipify.org?format=json', {
      signal: AbortSignal.timeout(2000),
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.ip) return data.ip;
    }
  } catch {}
  return null;
}

export async function GET(request: Request) {
  try {
    const cleanId = extractUserId(request);
    const userStatus = loadUserBrokerStatus(cleanId);
    const userCreds = loadUserBrokerCreds(cleanId);
    const serverIp = await detectServerPublicIp();

    const maskedCreds: Record<string, Record<string, string>> = {};
    for (const [broker, creds] of Object.entries(userCreds)) {
      maskedCreds[broker] = {};
      if (creds && typeof creds === 'object') {
        for (const [k, v] of Object.entries(creds)) {
          maskedCreds[broker][k] = k.toLowerCase().includes('secret') || k.toLowerCase().includes('token')
            ? maskCredential(String(v))
            : String(v);
        }
      }
    }

    return NextResponse.json({
      success: true,
      userId: cleanId,
      status: userStatus,
      credentials: maskedCreds,
      serverIp: serverIp || '42.108.76.75',
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { broker, credentials } = body;
    const cleanId = extractUserId(request, body);

    if (!broker || !credentials) {
      return NextResponse.json(
        { success: false, message: 'Broker ID and credentials are required for sync' },
        { status: 400 }
      );
    }

    const adapter = getBrokerAdapter(broker as BrokerType, credentials);
    const result = await adapter.testConnection();

    // Check if Delta or broker returned an IP restriction error
    let detectedIp: string | null = null;
    if (!result.success && result.message) {
      const match = result.message.match(/\[\s*([0-9a-fA-F:.]+)\s*\]/);
      if (match) detectedIp = match[1];
    }
    if (!detectedIp) {
      detectedIp = await detectServerPublicIp();
    }

    // Load existing user-specific creds & status
    const userCreds = loadUserBrokerCreds(cleanId);
    const userStatus = loadUserBrokerStatus(cleanId);

    if (result.success) {
      userCreds[broker] = credentials;
      saveUserBrokerCreds(cleanId, userCreds);

      userStatus[broker] = {
        success: true,
        message: result.message,
        balance: result.balance,
        currency: result.currency || 'INR',
        balanceDisplay: result.balanceDisplay,
        accountStatus: 'CONNECTED',
        lastSynced: new Date().toISOString(),
      };
      saveUserBrokerStatus(cleanId, userStatus);

      // Also persist to global broker_creds.json as fallback for background engine
      try {
        const credsDir = path.join(process.cwd(), 'data');
        const credsFile = path.join(credsDir, 'broker_creds.json');
        let existing: Record<string, any> = {};
        if (fs.existsSync(credsFile)) {
          try { existing = JSON.parse(fs.readFileSync(credsFile, 'utf-8')); } catch {}
        }
        existing[broker] = credentials;
        fs.writeFileSync(credsFile, JSON.stringify(existing, null, 2), 'utf-8');
      } catch {}

      // Update wallet balance in risk engine
      if (typeof result.balance === 'number' && result.balance > 0) {
        try {
          await saveRiskConfiguration({
            walletBalance: Number(result.balance.toFixed(2)),
            autoSyncWallet: true,
          });
        } catch {}
      }
    } else {
      userStatus[broker] = {
        success: false,
        message: result.message,
        accountStatus: 'DISCONNECTED',
        lastSynced: new Date().toISOString(),
      };
      saveUserBrokerStatus(cleanId, userStatus);
    }

    return NextResponse.json({
      success: result.success,
      message: result.message,
      balance: result.balance,
      currency: result.currency || 'INR',
      balanceDisplay: result.balanceDisplay,
      syncedAt: new Date().toISOString(),
      detectedIp: detectedIp || '42.108.76.75',
      userId: cleanId,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err.message || 'Failed to sync broker balance' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const broker = searchParams.get('broker');
    const cleanId = extractUserId(request);

    if (!broker) {
      return NextResponse.json({ success: false, message: 'Broker ID required' }, { status: 400 });
    }

    const userCreds = loadUserBrokerCreds(cleanId);
    const userStatus = loadUserBrokerStatus(cleanId);

    delete userCreds[broker];
    delete userStatus[broker];

    saveUserBrokerCreds(cleanId, userCreds);
    saveUserBrokerStatus(cleanId, userStatus);

    return NextResponse.json({ 
      success: true, 
      message: `Broker ${broker} disconnected for user ${cleanId}`,
      userId: cleanId 
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
