import { Candle } from '../brokers/types';

export interface KeyLevels {
  prevHigh: number;
  prevLow: number;
  prevClose: number;
}

export interface BreakoutStrategyParams {
  slCandleMode?: 'signal_candle' | 'prev_candle'; // default: 'signal_candle'
  maxTradesPerDay?: number;                       // default: 3
  lotSize?: number;                               // default: 50
  trailStepPoints?: number;                       // default: 10
  trailAmountPoints?: number;                     // default: 3
  sessionStart?: string;                          // "09:15"
  noTradeStart?: string;                          // "11:00"
  noTradeEnd?: string;                            // "13:00"
  squareOffTime?: string;                         // "15:30"
}

export interface ActivePositionState {
  tradeId?: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  entryPrice: number;
  initialSlPrice: number;
  initialSlPoints: number;
  initialTargetPrice: number;
  currentSlPrice: number;
  currentTargetPrice: number;
  trailingMilestones: number;
  highestFavorablePoints: number;
  entryTime: string;
}

export interface StrategyEvaluationResult {
  canEnterNewTrade: boolean;
  blockReason?: string;
  isForceSquareOff: boolean;
  signal: 'BUY' | 'SELL' | null;
  setupNumber?: 1 | 2 | 3 | 4 | 5 | 6;
  setupName?: string;
  riskReward?: string;
  entryPrice?: number;
  stopLoss?: number;
  target?: number;
  slPoints?: number;
  targetPoints?: number;
  levelBroken?: string;
  signalReason?: string;
  pendingSetup?: {
    setupNumber: 1 | 2 | 3 | 4 | 5 | 6;
    setupName: string;
    levelName: string;
    levelPrice: number;
    direction: 'BUY' | 'SELL';
    triggerPrice: number;
    stopLoss: number;
    target: number;
  };
  exitSignal?: {
    shouldExit: boolean;
    reason: 'SL_HIT' | 'TARGET_HIT' | 'TIME_EXIT_1530' | null;
    exitPrice: number;
  };
  trailingUpdate?: {
    newSl: number;
    newTarget: number;
    milestone: number;
    pointsTrailed: number;
  };
}

/**
 * Converts date to IST (Asia/Kolkata) minutes from midnight
 */
export function getISTMinutesFromMidnight(date: Date = new Date()): { minutes: number; timeStr: string } {
  // Use Intl to format IST time cleanly
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const hour = parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10);
  const minute = parseInt(parts.find((p) => p.type === 'minute')?.value || '0', 10);
  const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;

  return {
    minutes: hour * 60 + minute,
    timeStr,
  };
}

/**
 * Parse "HH:MM" string to minutes from midnight
 */
export function timeStringToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * Checks time session rules:
 * - No entries before 09:15
 * - Entry block window: 11:00 to 13:00 (manage open trade only)
 * - Force square-off at 15:30
 */
export function checkTradingSessionTime(params: BreakoutStrategyParams, date: Date = new Date()) {
  const { minutes, timeStr } = getISTMinutesFromMidnight(date);

  const sessionStartMin = timeStringToMinutes(params.sessionStart || '09:15');
  const noTradeStartMin = timeStringToMinutes(params.noTradeStart || '11:00');
  const noTradeEndMin = timeStringToMinutes(params.noTradeEnd || '13:00');
  const squareOffMin = timeStringToMinutes(params.squareOffTime || '15:30');

  const isBeforeOpen = minutes < sessionStartMin;
  const isBlockedWindow = minutes >= noTradeStartMin && minutes < noTradeEndMin;
  const isSquareOffTime = minutes >= squareOffMin;
  const canOpenNewTrade = !isBeforeOpen && !isBlockedWindow && !isSquareOffTime;

  let windowStatus = 'NORMAL_TRADING';
  if (isBeforeOpen) windowStatus = `PRE_MARKET (Before ${params.sessionStart || '09:15'})`;
  else if (isBlockedWindow) windowStatus = `ENTRY_BLOCKED_WINDOW (${params.noTradeStart || '11:00'} - ${params.noTradeEnd || '13:00'})`;
  else if (isSquareOffTime) windowStatus = `FORCE_SQUARE_OFF (>= ${params.squareOffTime || '15:30'})`;

  return {
    timeStr,
    minutes,
    canOpenNewTrade,
    isBlockedWindow,
    isSquareOffTime,
    windowStatus,
  };
}

/**
 * Core Strategy Evaluator:
 * Checks 5m candle breakouts, calculates 1:3 target, dynamic SL candle modes,
 * step trailing (every +10 pts trail +3 pts), and 15:30 square-off.
 */
export function evaluatePrevDayBreakout(
  candles: Candle[],
  levels: KeyLevels,
  params: BreakoutStrategyParams = {},
  activePosition: ActivePositionState | null = null,
  currentPrice?: number,
  todayTradeCount: number = 0
): StrategyEvaluationResult {
  const result: StrategyEvaluationResult = {
    canEnterNewTrade: false,
    isForceSquareOff: false,
    signal: null,
  };

  const { canOpenNewTrade, isBlockedWindow, isSquareOffTime, windowStatus, timeStr } =
    checkTradingSessionTime(params);

  result.canEnterNewTrade = canOpenNewTrade;
  result.isForceSquareOff = isSquareOffTime;

  // Use latest price from candle or input
  const lastCandle = candles[candles.length - 1];
  const livePrice = currentPrice || (lastCandle ? lastCandle.close : 0);

  // --------------------------------------------------------------------------
  // 1. ACTIVE POSITION MANAGEMENT (SL, Target, Trailing & 15:30 Square-Off)
  // --------------------------------------------------------------------------
  if (activePosition) {
    result.canEnterNewTrade = false;
    result.blockReason = 'Active position already open';

    // A. Force Square-Off at 15:30
    if (isSquareOffTime) {
      result.exitSignal = {
        shouldExit: true,
        reason: 'TIME_EXIT_1530',
        exitPrice: livePrice,
      };
      return result;
    }

    const {
      side,
      entryPrice,
      currentSlPrice,
      currentTargetPrice,
      trailingMilestones = 0,
    } = activePosition;

    const trailStep = params.trailStepPoints || 10;
    const trailAmount = params.trailAmountPoints || 3;

    if (side === 'BUY') {
      // Check SL hit
      if (livePrice <= currentSlPrice) {
        result.exitSignal = {
          shouldExit: true,
          reason: 'SL_HIT',
          exitPrice: currentSlPrice,
        };
        return result;
      }
      // Check Target hit
      if (livePrice >= currentTargetPrice) {
        result.exitSignal = {
          shouldExit: true,
          reason: 'TARGET_HIT',
          exitPrice: currentTargetPrice,
        };
        return result;
      }

      // Step Trailing: for every +10 pts favorable move -> trail +3 pts
      const favorablePts = livePrice - entryPrice;
      if (favorablePts > 0) {
        const milestones = Math.floor(favorablePts / trailStep);
        if (milestones > trailingMilestones) {
          const milestoneDiff = milestones - trailingMilestones;
          const shiftPts = milestoneDiff * trailAmount;
          result.trailingUpdate = {
            newSl: currentSlPrice + shiftPts,
            newTarget: currentTargetPrice + shiftPts,
            milestone: milestones,
            pointsTrailed: shiftPts,
          };
        }
      }
    } else if (side === 'SELL') {
      // Check SL hit
      if (livePrice >= currentSlPrice) {
        result.exitSignal = {
          shouldExit: true,
          reason: 'SL_HIT',
          exitPrice: currentSlPrice,
        };
        return result;
      }
      // Check Target hit
      if (livePrice <= currentTargetPrice) {
        result.exitSignal = {
          shouldExit: true,
          reason: 'TARGET_HIT',
          exitPrice: currentTargetPrice,
        };
        return result;
      }

      // Step Trailing for Short: for every +10 pts favorable fall -> trail +3 pts
      const favorablePts = entryPrice - livePrice;
      if (favorablePts > 0) {
        const milestones = Math.floor(favorablePts / trailStep);
        if (milestones > trailingMilestones) {
          const milestoneDiff = milestones - trailingMilestones;
          const shiftPts = milestoneDiff * trailAmount;
          result.trailingUpdate = {
            newSl: currentSlPrice - shiftPts,
            newTarget: currentTargetPrice - shiftPts,
            milestone: milestones,
            pointsTrailed: shiftPts,
          };
        }
      }
    }

    return result;
  }

  // --------------------------------------------------------------------------
  // 2. ENTRY RULES (Checked on 5m Candle Close)
  // --------------------------------------------------------------------------
  if (!canOpenNewTrade) {
    result.blockReason = windowStatus;
    return result;
  }

  const maxTrades = params.maxTradesPerDay || 3;
  if (todayTradeCount >= maxTrades) {
    result.blockReason = `Max daily trades limit reached (${todayTradeCount}/${maxTrades})`;
    return result;
  }

  if (candles.length < 2) {
    result.blockReason = 'Insufficient candles for breakout check';
    return result;
  }

  const signalCandle = candles[candles.length - 1];
  const prevCandle = candles[candles.length - 2];

  const isGreen = signalCandle.close > signalCandle.open;
  const isRed = signalCandle.close < signalCandle.open;

  // --------------------------------------------------------------------------
  // 2. ENTRY RULES (Evaluates 6 Core Setups across PDH, PDL, PDC)
  // --------------------------------------------------------------------------
  // Level            BUY (Setup #)                    SELL (Setup #)
  // Yesterday High   Setup 1 (PDH Breakout BUY)       Setup 2 (PDH Breakdown SELL)
  // Yesterday Low    Setup 3 (PDL Breakout BUY)       Setup 4 (PDL Breakdown SELL)
  // Yesterday Close  Setup 5 (PDC Breakout BUY)       Setup 6 (PDC Breakdown SELL)
  // 
  // Rule:
  // - Close-level setups: SL = Signal candle opposite end (Low for BUY, High for SELL)
  // - Target = Strict 1:3 Risk to Reward (Entry ± 3 * SL Points)
  // - Trigger = Next candle breaks Signal candle High (for BUY) or Low (for SELL)
  // --------------------------------------------------------------------------

  const { prevHigh, prevLow, prevClose } = levels;
  const levelConfigs = [
    { type: 'PDH' as const, name: 'Yesterday High (PDH)', val: prevHigh, buySetupNum: 1 as const, sellSetupNum: 2 as const },
    { type: 'PDL' as const, name: 'Yesterday Low (PDL)', val: prevLow, buySetupNum: 3 as const, sellSetupNum: 4 as const },
    { type: 'PDC' as const, name: 'Yesterday Close (PDC)', val: prevClose, buySetupNum: 5 as const, sellSetupNum: 6 as const },
  ].filter((lvl) => typeof lvl.val === 'number' && lvl.val > 0);

  if (levelConfigs.length === 0) {
    result.blockReason = 'Waiting for valid PDH, PDL, PDC key levels';
    return result;
  }

  // We evaluate 2 scenarios for maximum responsiveness:
  // Scenario 1: signalCandle is candles[n - 2] (closed candle), trigger checked on candles[n - 1] (or livePrice)
  // Scenario 2: signalCandle is candles[n - 1] (just closed), trigger checked against livePrice
  const evalPairs: Array<{
    signalCandle: Candle;
    prevCandle: Candle;
    triggerCandle: Candle;
    isCurrentCandleActive: boolean;
  }> = [];

  const n = candles.length;
  if (n >= 3) {
    // Standard confirmed 2-candle sequence: candle[n-2] broke level, candle[n-1] is triggering high/low
    evalPairs.push({
      signalCandle: candles[n - 2],
      prevCandle: candles[n - 3],
      triggerCandle: candles[n - 1],
      isCurrentCandleActive: true,
    });
  }
  if (n >= 2) {
    // Just-closed candle breakout: candle[n-1] broke level, livePrice is triggering high/low
    evalPairs.push({
      signalCandle: candles[n - 1],
      prevCandle: candles[n - 2],
      triggerCandle: candles[n - 1],
      isCurrentCandleActive: false,
    });
  }

  for (const pair of evalPairs) {
    const { signalCandle, prevCandle, triggerCandle } = pair;
    const isGreen = signalCandle.close > signalCandle.open;
    const isRed = signalCandle.close < signalCandle.open;

    for (const lvl of levelConfigs) {
      // ----------------------------------------------------------------------
      // BUY SETUPS (Setup 1: PDH, Setup 3: PDL, Setup 5: PDC)
      // Condition: Bullish candle breaks & closes above the level
      // Trigger: Next candle (or live price) breaks bullish candle's HIGH
      // ----------------------------------------------------------------------
      if (isGreen) {
        const brokeAbove = prevCandle.close <= lvl.val && signalCandle.close > lvl.val;
        const reclaimedAbove = signalCandle.low <= lvl.val && signalCandle.close > lvl.val;

        if (brokeAbove || (lvl.type === 'PDL' && reclaimedAbove)) {
          const entryPrice = signalCandle.high;
          const stopLoss = signalCandle.low; // Opposite end of signal candle
          const slPoints = Math.max(0.5, entryPrice - stopLoss);
          const targetPoints = slPoints * 3; // Strict 1:3 RR
          const target = entryPrice + targetPoints;
          const setupNum = lvl.buySetupNum;
          const setupName = `Setup ${setupNum}: ${lvl.name} Breakout BUY`;

          // Check if trigger occurred: Next candle high >= signal candle high OR livePrice >= signal candle high
          const hasBrokenHigh = triggerCandle.high >= signalCandle.high || livePrice >= signalCandle.high;

          if (hasBrokenHigh) {
            result.signal = 'BUY';
            result.setupNumber = setupNum;
            result.setupName = setupName;
            result.levelBroken = `${lvl.type} (${lvl.val})`;
            result.entryPrice = Number(entryPrice.toFixed(2));
            result.stopLoss = Number(stopLoss.toFixed(2));
            result.target = Number(target.toFixed(2));
            result.slPoints = Number(slPoints.toFixed(2));
            result.targetPoints = Number(targetPoints.toFixed(2));
            result.riskReward = '1:3';
            result.signalReason = `[${setupName}] 5m Bullish candle closed above ${lvl.name} (${lvl.val}) @ ${signalCandle.close}. Next candle broke High @ ${entryPrice}. SL: ${stopLoss} (Low), 1:3 Target: ${target}.`;
            return result;
          } else {
            // Signal candle closed above level, but high not yet broken
            if (!result.pendingSetup) {
              result.pendingSetup = {
                setupNumber: setupNum,
                setupName,
                levelName: lvl.name,
                levelPrice: lvl.val,
                direction: 'BUY',
                triggerPrice: entryPrice,
                stopLoss,
                target,
              };
            }
          }
        }
      }

      // ----------------------------------------------------------------------
      // SELL SETUPS (Setup 2: PDH, Setup 4: PDL, Setup 6: PDC)
      // Condition: Bearish candle breaks & closes below the level
      // Trigger: Next candle (or live price) breaks bearish candle's LOW
      // ----------------------------------------------------------------------
      if (isRed) {
        const brokeBelow = prevCandle.close >= lvl.val && signalCandle.close < lvl.val;
        const rejectedBelow = signalCandle.high >= lvl.val && signalCandle.close < lvl.val;

        if (brokeBelow || (lvl.type === 'PDH' && rejectedBelow)) {
          const entryPrice = signalCandle.low;
          const stopLoss = signalCandle.high; // Opposite end of signal candle
          const slPoints = Math.max(0.5, stopLoss - entryPrice);
          const targetPoints = slPoints * 3; // Strict 1:3 RR
          const target = entryPrice - targetPoints;
          const setupNum = lvl.sellSetupNum;
          const setupName = `Setup ${setupNum}: ${lvl.name} Breakdown SELL`;

          // Check if trigger occurred: Next candle low <= signal candle low OR livePrice <= signal candle low
          const hasBrokenLow = triggerCandle.low <= signalCandle.low || livePrice <= signalCandle.low;

          if (hasBrokenLow) {
            result.signal = 'SELL';
            result.setupNumber = setupNum;
            result.setupName = setupName;
            result.levelBroken = `${lvl.type} (${lvl.val})`;
            result.entryPrice = Number(entryPrice.toFixed(2));
            result.stopLoss = Number(stopLoss.toFixed(2));
            result.target = Number(target.toFixed(2));
            result.slPoints = Number(slPoints.toFixed(2));
            result.targetPoints = Number(targetPoints.toFixed(2));
            result.riskReward = '1:3';
            result.signalReason = `[${setupName}] 5m Bearish candle closed below ${lvl.name} (${lvl.val}) @ ${signalCandle.close}. Next candle broke Low @ ${entryPrice}. SL: ${stopLoss} (High), 1:3 Target: ${target}.`;
            return result;
          } else {
            // Signal candle closed below level, but low not yet broken
            if (!result.pendingSetup) {
              result.pendingSetup = {
                setupNumber: setupNum,
                setupName,
                levelName: lvl.name,
                levelPrice: lvl.val,
                direction: 'SELL',
                triggerPrice: entryPrice,
                stopLoss,
                target,
              };
            }
          }
        }
      }
    }
  }

  if (result.pendingSetup) {
    const p = result.pendingSetup;
    result.blockReason = `⏳ [${p.setupName}] Signal candle closed across ${p.levelName} (${p.levelPrice}). Waiting for next candle to break ${p.direction === 'BUY' ? 'High' : 'Low'} @ ${p.triggerPrice}`;
  } else {
    result.blockReason = `Scanning 5m feed for 6 setups across PDH (${prevHigh}), PDL (${prevLow}), PDC (${prevClose})`;
  }

  return result;
}
