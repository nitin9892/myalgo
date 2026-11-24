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
  entryPrice?: number;
  stopLoss?: number;
  target?: number;
  slPoints?: number;
  targetPoints?: number;
  levelBroken?: string;
  signalReason?: string;
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

  const { prevHigh, prevLow, prevClose } = levels;
  const monitoredLevels = [
    { name: 'PREV_HIGH', val: prevHigh },
    { name: 'PREV_LOW', val: prevLow },
    { name: 'PREV_CLOSE', val: prevClose },
  ].filter((lvl) => typeof lvl.val === 'number' && lvl.val > 0);

  const slMode = params.slCandleMode || 'signal_candle';

  // Check LONG breakout: GREEN candle breaks & closes above a key level
  if (isGreen) {
    for (const lvl of monitoredLevels) {
      if (prevCandle.close <= lvl.val && signalCandle.close > lvl.val) {
        const entryPrice = signalCandle.high;
        const initialSl = slMode === 'prev_candle' ? prevCandle.low : signalCandle.low;
        let slPoints = Math.max(1, entryPrice - initialSl);

        // Target: 1:3 Risk to Reward
        const targetPoints = slPoints * 3;
        const target = entryPrice + targetPoints;

        result.signal = 'BUY';
        result.entryPrice = Number(entryPrice.toFixed(2));
        result.stopLoss = Number(initialSl.toFixed(2));
        result.target = Number(target.toFixed(2));
        result.slPoints = Number(slPoints.toFixed(2));
        result.targetPoints = Number(targetPoints.toFixed(2));
        result.levelBroken = `${lvl.name} (${lvl.val})`;
        result.signalReason = `5m Green candle broke & closed above ${lvl.name} (${lvl.val}) @ ${signalCandle.close}. Entry @ High ${entryPrice}`;
        return result;
      }
    }
  }

  // Check SHORT breakout: RED candle breaks & closes below a key level
  if (isRed) {
    for (const lvl of monitoredLevels) {
      if (prevCandle.close >= lvl.val && signalCandle.close < lvl.val) {
        const entryPrice = signalCandle.low;
        const initialSl = slMode === 'prev_candle' ? prevCandle.high : signalCandle.high;
        let slPoints = Math.max(1, initialSl - entryPrice);

        // Target: 1:3 Risk to Reward
        const targetPoints = slPoints * 3;
        const target = entryPrice - targetPoints;

        result.signal = 'SELL';
        result.entryPrice = Number(entryPrice.toFixed(2));
        result.stopLoss = Number(initialSl.toFixed(2));
        result.target = Number(target.toFixed(2));
        result.slPoints = Number(slPoints.toFixed(2));
        result.targetPoints = Number(targetPoints.toFixed(2));
        result.levelBroken = `${lvl.name} (${lvl.val})`;
        result.signalReason = `5m Red candle broke & closed below ${lvl.name} (${lvl.val}) @ ${signalCandle.close}. Entry @ Low ${entryPrice}`;
        return result;
      }
    }
  }

  return result;
}
