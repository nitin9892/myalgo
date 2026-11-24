import { NextResponse } from 'next/server';
import { 
  getRiskConfiguration, 
  saveRiskConfiguration, 
  evaluateDailyLossAndKillSwitch,
  emergencyCloseAllPositions 
} from '@/lib/risk/engine';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const config = await getRiskConfiguration();
    const evaluation = await evaluateDailyLossAndKillSwitch(config.walletBalance, config.maxDailyLossPct);

    return NextResponse.json({
      config,
      todayNetPnl: evaluation.todayNetPnl,
      maxAllowedDailyLoss: evaluation.maxAllowedLoss,
      isKillSwitchActive: config.killSwitchActive || evaluation.killSwitchTriggered,
      killSwitchReason: config.killSwitchReason,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { 
      walletBalance, 
      maxDailyLossPct, 
      perTradeRiskPct, 
      maxOpenTrades, 
      killSwitchActive,
      triggerEmergencyKill,
      resetKillSwitch 
    } = body;

    if (triggerEmergencyKill) {
      await emergencyCloseAllPositions('MANUAL_USER_KILL_SWITCH');
      const updated = await saveRiskConfiguration({
        killSwitchActive: true,
        killSwitchReason: 'Manual emergency kill switch triggered by user',
      });
      return NextResponse.json({ success: true, config: updated, message: 'Kill Switch Triggered! All trades closed.' });
    }

    if (resetKillSwitch) {
      const updated = await saveRiskConfiguration({
        killSwitchActive: false,
        killSwitchReason: null,
      });
      return NextResponse.json({ success: true, config: updated, message: 'Kill Switch Disarmed and Reset.' });
    }

    const updates: any = {};
    if (typeof walletBalance === 'number') updates.walletBalance = walletBalance;
    if (typeof maxDailyLossPct === 'number') updates.maxDailyLossPct = maxDailyLossPct;
    if (typeof perTradeRiskPct === 'number') updates.perTradeRiskPct = perTradeRiskPct;
    if (typeof maxOpenTrades === 'number') updates.maxOpenTrades = maxOpenTrades;
    if (typeof killSwitchActive === 'boolean') updates.killSwitchActive = killSwitchActive;

    const saved = await saveRiskConfiguration(updates);
    return NextResponse.json({ success: true, config: saved });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
