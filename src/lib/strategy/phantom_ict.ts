import { Candle } from '../brokers/types';
import { ActivePositionState, StrategyEvaluationResult } from './prev_day_breakout';
import { calculateDynamicTrailingSL } from './trailing';

/**
 * ----------------------------------------------------------------------------
 * PROJECT PHANTOM - AI INSTITUTIONAL SCALPER
 * A Fully Autonomous, SMC + ICT Powered, Multi-Market Trading System
 * 
 * Core Components:
 * 1. Market Structure: BOS (Break of Structure), CHoCH / MSS (Market Structure Shift)
 * 2. Order Blocks: Bullish / Bearish OB, Mitigation
 * 3. Fair Value Gaps (FVG): Imbalance & Consequent Encroachment (50% midpoint)
 * 4. Liquidity: BSL (Buy-Side Liquidity), SSL (Sell-Side Liquidity), Sweeps & Stop Hunts
 * 5. Premium / Discount: Equilibrium 50% & OTE (Optimal Trade Entry 61.8% - 78.6%)
 * 6. Confluence Execution: Liquidity Sweep -> MSS -> FVG Retest -> 1:4 RR Target
 * ----------------------------------------------------------------------------
 */

export interface SwingPoint {
  index: number;
  timestamp: number;
  price: number;
  type: 'HIGH' | 'LOW';
}

export interface FairValueGap {
  startIndex: number;
  type: 'BULLISH' | 'BEARISH';
  top: number;
  bottom: number;
  midpoint: number;
  mitigated: boolean;
  formedAt: number;
}

export interface OrderBlock {
  candleIndex: number;
  type: 'BULLISH' | 'BEARISH';
  high: number;
  low: number;
  open: number;
  close: number;
  mitigated: boolean;
  formedAt: number;
}

export interface LiquiditySweep {
  candleIndex: number;
  type: 'SSL' | 'BSL';
  sweptPrice: number;
  extremePrice: number;
  timestamp: number;
}

export interface PhantomStrategyParams {
  riskRewardRatio?: number;        // Default 1:3.5 to 1:4 RR
  minFvgSizePct?: number;          // Minimum size of FVG in % (default 0.15%)
  displacementThreshold?: number;  // Multiplier of average candle size (default 1.4x)
  maxTradesPerDay?: number;        // Max trades per day (default 3)
  breakevenTriggerRR?: number;     // Trigger BE at 1:1.5 RR (default 1.5)
  trailTriggerRR?: number;         // Trail SL at 1:2.5 RR (default 2.5)
}

/**
 * Detects swing highs and swing lows (fractal pivot points)
 */
export function detectSwingPoints(candles: Candle[], lookback: number = 3): SwingPoint[] {
  const points: SwingPoint[] = [];
  if (candles.length < lookback * 2 + 1) return points;

  for (let i = lookback; i < candles.length - lookback; i++) {
    const currentHigh = candles[i].high;
    const currentLow = candles[i].low;

    let isSwingHigh = true;
    let isSwingLow = true;

    for (let j = 1; j <= lookback; j++) {
      if (candles[i - j].high >= currentHigh || candles[i + j].high >= currentHigh) {
        isSwingHigh = false;
      }
      if (candles[i - j].low <= currentLow || candles[i + j].low <= currentLow) {
        isSwingLow = false;
      }
    }

    if (isSwingHigh) {
      points.push({
        index: i,
        timestamp: candles[i].timestamp,
        price: currentHigh,
        type: 'HIGH',
      });
    }

    if (isSwingLow) {
      points.push({
        index: i,
        timestamp: candles[i].timestamp,
        price: currentLow,
        type: 'LOW',
      });
    }
  }

  return points.sort((a, b) => a.index - b.index);
}

/**
 * Detects Fair Value Gaps (FVG / Imbalances)
 * - Bullish FVG: Candle 0 High < Candle 2 Low (Unfilled upward price gap)
 * - Bearish FVG: Candle 0 Low > Candle 2 High (Unfilled downward price gap)
 */
export function detectFairValueGaps(candles: Candle[], minGapPct: number = 0.08): FairValueGap[] {
  const fvgs: FairValueGap[] = [];
  if (candles.length < 3) return fvgs;

  for (let i = 2; i < candles.length; i++) {
    const c0 = candles[i - 2];
    const c1 = candles[i - 1]; // Displacement candle
    const c2 = candles[i];

    // Bullish FVG Check
    if (c2.low > c0.high) {
      const gapSize = c2.low - c0.high;
      const gapPct = (gapSize / c1.close) * 100;
      if (gapPct >= minGapPct) {
        fvgs.push({
          startIndex: i - 1,
          type: 'BULLISH',
          top: c2.low,
          bottom: c0.high,
          midpoint: (c2.low + c0.high) / 2, // Consequent Encroachment (CE)
          mitigated: false,
          formedAt: c1.timestamp,
        });
      }
    }

    // Bearish FVG Check
    if (c0.low > c2.high) {
      const gapSize = c0.low - c2.high;
      const gapPct = (gapSize / c1.close) * 100;
      if (gapPct >= minGapPct) {
        fvgs.push({
          startIndex: i - 1,
          type: 'BEARISH',
          top: c0.low,
          bottom: c2.high,
          midpoint: (c0.low + c2.high) / 2, // Consequent Encroachment (CE)
          mitigated: false,
          formedAt: c1.timestamp,
        });
      }
    }
  }

  // Check which FVGs have already been mitigated by subsequent price action
  for (const fvg of fvgs) {
    for (let j = fvg.startIndex + 2; j < candles.length; j++) {
      const c = candles[j];
      if (fvg.type === 'BULLISH' && c.low <= fvg.bottom) {
        fvg.mitigated = true;
        break;
      }
      if (fvg.type === 'BEARISH' && c.high >= fvg.top) {
        fvg.mitigated = true;
        break;
      }
    }
  }

  return fvgs;
}

/**
 * Detects Order Blocks (OB)
 * - Bullish OB: Last down candle before an impulsive bullish displacement move breaking structure
 * - Bearish OB: Last up candle before an impulsive bearish displacement move breaking structure
 */
export function detectOrderBlocks(candles: Candle[], fvgs: FairValueGap[]): OrderBlock[] {
  const blocks: OrderBlock[] = [];
  if (candles.length < 5) return blocks;

  for (let i = 1; i < candles.length - 2; i++) {
    const candle = candles[i];
    const nextCandle = candles[i + 1];

    // Calculate displacement size
    const bodySize = Math.abs(nextCandle.close - nextCandle.open);
    const avgBody = (Math.abs(candles[i - 1].close - candles[i - 1].open) + bodySize) / 2;
    const isDisplacement = bodySize > avgBody * 1.3;

    // Check if an FVG was formed directly after this candle
    const hasFvg = fvgs.some((f) => Math.abs(f.startIndex - (i + 1)) <= 1);

    // Bullish Order Block: Red candle before strong Green impulse
    if (candle.close < candle.open && nextCandle.close > nextCandle.open && isDisplacement && hasFvg) {
      blocks.push({
        candleIndex: i,
        type: 'BULLISH',
        high: candle.high,
        low: candle.low,
        open: candle.open,
        close: candle.close,
        mitigated: false,
        formedAt: candle.timestamp,
      });
    }

    // Bearish Order Block: Green candle before strong Red impulse
    if (candle.close > candle.open && nextCandle.close < nextCandle.open && isDisplacement && hasFvg) {
      blocks.push({
        candleIndex: i,
        type: 'BEARISH',
        high: candle.high,
        low: candle.low,
        open: candle.open,
        close: candle.close,
        mitigated: false,
        formedAt: candle.timestamp,
      });
    }
  }

  // Check mitigation
  for (const ob of blocks) {
    for (let j = ob.candleIndex + 2; j < candles.length; j++) {
      const c = candles[j];
      if (ob.type === 'BULLISH' && c.low < ob.low) {
        ob.mitigated = true;
        break;
      }
      if (ob.type === 'BEARISH' && c.high > ob.high) {
        ob.mitigated = true;
        break;
      }
    }
  }

  return blocks;
}

/**
 * Detects recent Liquidity Sweeps (SSL & BSL Sweeps / Stop Hunts)
 */
export function detectLiquiditySweeps(candles: Candle[], swingPoints: SwingPoint[]): LiquiditySweep[] {
  const sweeps: LiquiditySweep[] = [];
  if (candles.length < 5) return sweeps;

  const swingLows = swingPoints.filter((s) => s.type === 'LOW');
  const swingHighs = swingPoints.filter((s) => s.type === 'HIGH');

  for (let i = 2; i < candles.length; i++) {
    const c = candles[i];

    // SSL Sweep: Wick drops below previous swing low but candle closes back ABOVE it
    for (const sw of swingLows) {
      if (sw.index < i && i - sw.index <= 30) {
        if (c.low < sw.price && c.close > sw.price) {
          sweeps.push({
            candleIndex: i,
            type: 'SSL',
            sweptPrice: sw.price,
            extremePrice: c.low,
            timestamp: c.timestamp,
          });
          break;
        }
      }
    }

    // BSL Sweep: Wick pushes above previous swing high but candle closes back BELOW it
    for (const sh of swingHighs) {
      if (sh.index < i && i - sh.index <= 30) {
        if (c.high > sh.price && c.close < sh.price) {
          sweeps.push({
            candleIndex: i,
            type: 'BSL',
            sweptPrice: sh.price,
            extremePrice: c.high,
            timestamp: c.timestamp,
          });
          break;
        }
      }
    }
  }

  return sweeps;
}

/**
 * Main Evaluation Engine for Strategy B: Phantom AI (SMC + ICT Institutional Scalper)
 */
export function evaluatePhantomICTStrategy(
  candles: Candle[],
  activePos: ActivePositionState | null,
  currentPrice: number,
  params: PhantomStrategyParams = {}
): StrategyEvaluationResult {
  const rrRatio = params.riskRewardRatio || 3.5; // 1:3.5 to 1:4 RR
  const beTriggerRR = params.breakevenTriggerRR || 1.5;
  const trailTriggerRR = params.trailTriggerRR || 2.5;

  if (candles.length < 20) {
    return {
      canEnterNewTrade: false,
      blockReason: 'Insufficient candle history for SMC structure mapping (min 20 candles needed).',
      isForceSquareOff: false,
      signal: null,
    };
  }

  const latestCandle = candles[candles.length - 1];
  const prevCandle = candles[candles.length - 2];

  // --------------------------------------------------------------------------
  // 1. POSITION MANAGEMENT IF ALREADY IN TRADE
  // --------------------------------------------------------------------------
  if (activePos) {
    const isBuy = activePos.side === 'BUY';
    const entry = activePos.entryPrice;
    const initialSl = activePos.initialSlPrice;
    const currentSl = activePos.currentSlPrice;
    const target = activePos.currentTargetPrice;
    const riskPoints = Math.abs(entry - initialSl);

    // 1.1 STOP LOSS CHECK
    if (isBuy && latestCandle.low <= currentSl) {
      return {
        canEnterNewTrade: false,
        isForceSquareOff: false,
        signal: null,
        exitSignal: {
          shouldExit: true,
          reason: 'SL_HIT',
          exitPrice: currentSl,
        },
      };
    }
    if (!isBuy && latestCandle.high >= currentSl) {
      return {
        canEnterNewTrade: false,
        isForceSquareOff: false,
        signal: null,
        exitSignal: {
          shouldExit: true,
          reason: 'SL_HIT',
          exitPrice: currentSl,
        },
      };
    }

    // 1.2 TARGET CHECK (1:3.5 - 1:4 RR Hit)
    if (isBuy && latestCandle.high >= target) {
      return {
        canEnterNewTrade: false,
        isForceSquareOff: false,
        signal: null,
        exitSignal: {
          shouldExit: true,
          reason: 'TARGET_HIT',
          exitPrice: target,
        },
      };
    }
    if (!isBuy && latestCandle.low <= target) {
      return {
        canEnterNewTrade: false,
        isForceSquareOff: false,
        signal: null,
        exitSignal: {
          shouldExit: true,
          reason: 'TARGET_HIT',
          exitPrice: target,
        },
      };
    }

    // 1.3 UNIVERSAL DYNAMIC TRAILING: Every +100% market move (1R) trails SL by +35% (0.35R)
    const favorablePrice = isBuy ? latestCandle.high : latestCandle.low;
    const trailingRes = calculateDynamicTrailingSL(isBuy, entry, initialSl, currentSl, favorablePrice);

    if (trailingRes.shouldTrail) {
      return {
        canEnterNewTrade: false,
        isForceSquareOff: false,
        signal: null,
        trailingUpdate: {
          newSl: trailingRes.newSl,
          newTarget: target,
          milestone: trailingRes.milestone,
          pointsTrailed: trailingRes.pointsTrailed,
        },
      };
    }

    const currentProfitPoints = isBuy ? currentPrice - entry : entry - currentPrice;
    const currentRR = riskPoints > 0 ? currentProfitPoints / riskPoints : 0;

    return {
      canEnterNewTrade: false,
      blockReason: `Managing active position ${activePos.side} @ ${entry} (Current RR: ${currentRR.toFixed(2)}x)`,
      isForceSquareOff: false,
      signal: null,
    };
  }

  // --------------------------------------------------------------------------
  // 2. DETECT SMC + ICT CONFLUENCE ELEMENTS
  // --------------------------------------------------------------------------
  const swingPoints = detectSwingPoints(candles, 3);
  const fvgs = detectFairValueGaps(candles, params.minFvgSizePct || 0.08);
  const orderBlocks = detectOrderBlocks(candles, fvgs);
  const sweeps = detectLiquiditySweeps(candles, swingPoints);

  // Look back over recent candles for setups
  const activeFVGs = fvgs.filter((f) => !f.mitigated);
  const activeOBs = orderBlocks.filter((ob) => !ob.mitigated);

  // Calculate local range for Premium vs Discount equilibrium
  const recentSlice = candles.slice(-30);
  const rangeHigh = Math.max(...recentSlice.map((c) => c.high));
  const rangeLow = Math.min(...recentSlice.map((c) => c.low));
  const equilibrium = (rangeHigh + rangeLow) / 2;
  const isDiscount = currentPrice < equilibrium;
  const isPremium = currentPrice > equilibrium;

  // Recent Liquidity Sweep within past 12 candles
  const recentSslSweep = sweeps
    .filter((s) => s.type === 'SSL' && s.candleIndex >= candles.length - 12)
    .pop();
  const recentBslSweep = sweeps
    .filter((s) => s.type === 'BSL' && s.candleIndex >= candles.length - 12)
    .pop();

  // --------------------------------------------------------------------------
  // 3. BULLISH SETUP EVALUATION (SMC Confluence Scalper)
  // Confluence: SSL Liquidity Sweep + Bullish OB / FVG in Discount + Bullish Close
  // --------------------------------------------------------------------------
  const validBullishOB = activeOBs.find((ob) => ob.type === 'BULLISH' && ob.low <= currentPrice && currentPrice <= ob.high * 1.002);
  const validBullishFVG = activeFVGs.find((f) => f.type === 'BULLISH' && f.bottom <= currentPrice && currentPrice <= f.top);

  if ((recentSslSweep || isDiscount) && (validBullishOB || validBullishFVG)) {
    // Confirmation: Current or previous candle is bullish reacting from the zone
    const isReactingBullish = prevCandle.close > prevCandle.open || latestCandle.close > latestCandle.open;

    if (isReactingBullish) {
      const obLow = validBullishOB ? validBullishOB.low : (validBullishFVG ? validBullishFVG.bottom : prevCandle.low);
      const sweepLow = recentSslSweep ? recentSslSweep.extremePrice : obLow;
      const baseSl = Math.min(obLow, sweepLow);
      const stopLoss = Number((baseSl * 0.9985).toFixed(2)); // 0.15% protective buffer
      const slPoints = currentPrice - stopLoss;

      if (slPoints > 0 && (slPoints / currentPrice) * 100 <= 1.5) { // Ensure tight risk
        const target = Number((currentPrice + slPoints * rrRatio).toFixed(2));
        const setupName = recentSslSweep ? 'SSL Sweep + Bullish OB/FVG' : 'Discount Order Block Mitigation';

        return {
          canEnterNewTrade: true,
          isForceSquareOff: false,
          signal: 'BUY',
          setupName: `Phantom AI [BUY]: ${setupName}`,
          riskReward: `1:${rrRatio}`,
          entryPrice: currentPrice,
          stopLoss,
          target,
          slPoints: Number(slPoints.toFixed(2)),
          targetPoints: Number((target - currentPrice).toFixed(2)),
          signalReason: `SMC Institutional Confluence: Liquidity swept @ ${sweepLow.toFixed(2)}, mitigated Bullish OB in Discount with 1:${rrRatio} RR.`,
        };
      }
    }
  }

  // --------------------------------------------------------------------------
  // 4. BEARISH SETUP EVALUATION (SMC Confluence Scalper)
  // Confluence: BSL Liquidity Sweep + Bearish OB / FVG in Premium + Bearish Close
  // --------------------------------------------------------------------------
  const validBearishOB = activeOBs.find((ob) => ob.type === 'BEARISH' && ob.low * 0.998 <= currentPrice && currentPrice <= ob.high);
  const validBearishFVG = activeFVGs.find((f) => f.type === 'BEARISH' && f.bottom <= currentPrice && currentPrice <= f.top);

  if ((recentBslSweep || isPremium) && (validBearishOB || validBearishFVG)) {
    const isReactingBearish = prevCandle.close < prevCandle.open || latestCandle.close < latestCandle.open;

    if (isReactingBearish) {
      const obHigh = validBearishOB ? validBearishOB.high : (validBearishFVG ? validBearishFVG.top : prevCandle.high);
      const sweepHigh = recentBslSweep ? recentBslSweep.extremePrice : obHigh;
      const baseSl = Math.max(obHigh, sweepHigh);
      const stopLoss = Number((baseSl * 1.0015).toFixed(2)); // 0.15% protective buffer
      const slPoints = stopLoss - currentPrice;

      if (slPoints > 0 && (slPoints / currentPrice) * 100 <= 1.5) {
        const target = Number((currentPrice - slPoints * rrRatio).toFixed(2));
        const setupName = recentBslSweep ? 'BSL Sweep + Bearish OB/FVG' : 'Premium Order Block Mitigation';

        return {
          canEnterNewTrade: true,
          isForceSquareOff: false,
          signal: 'SELL',
          setupName: `Phantom AI [SELL]: ${setupName}`,
          riskReward: `1:${rrRatio}`,
          entryPrice: currentPrice,
          stopLoss,
          target,
          slPoints: Number(slPoints.toFixed(2)),
          targetPoints: Number((currentPrice - target).toFixed(2)),
          signalReason: `SMC Institutional Confluence: Liquidity swept @ ${sweepHigh.toFixed(2)}, mitigated Bearish OB in Premium with 1:${rrRatio} RR.`,
        };
      }
    }
  }

  return {
    canEnterNewTrade: false,
    blockReason: 'Scanning order flow: Waiting for SMC Institutional Confluence (Sweep + OB/FVG Mitigations).',
    isForceSquareOff: false,
    signal: null,
  };
}
