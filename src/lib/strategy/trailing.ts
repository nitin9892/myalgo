/**
 * Universal Dynamic Trailing Stop-Loss Engine
 * 
 * CORE QUANTITATIVE RULE:
 * "Whenever market moves 100% of risk distance in favorable direction (1R),
 * trail Stop Loss by 35% of risk distance (0.35R).
 * Every additional 100% favorable move (2R, 3R, ...) trails SL by another +35%."
 * 
 * Examples:
 * - At +100% move (+1.0R): SL moves to Entry + 0.35R (Locking in +35% of Risk as guaranteed profit)
 * - At +200% move (+2.0R): SL moves to Entry + 0.70R (Locking in +70% of Risk as profit)
 * - At +300% move (+3.0R): SL moves to Entry + 1.05R (Locking in +105% of Risk as profit)
 */

export interface TrailingEvaluation {
  shouldTrail: boolean;
  newSl: number;
  milestone: number;
  profitPctLocked: number;
  pointsTrailed: number;
  reason: string;
}

export function calculateDynamicTrailingSL(
  isBuy: boolean,
  entryPrice: number,
  initialSlPrice: number,
  currentSlPrice: number,
  currentOrFavorablePrice: number
): TrailingEvaluation {
  const riskPoints = Math.abs(entryPrice - initialSlPrice);

  if (riskPoints <= 0) {
    return {
      shouldTrail: false,
      newSl: currentSlPrice,
      milestone: 0,
      profitPctLocked: 0,
      pointsTrailed: 0,
      reason: 'Zero risk points; cannot calculate trailing ratio.',
    };
  }

  const favorablePoints = isBuy
    ? currentOrFavorablePrice - entryPrice
    : entryPrice - currentOrFavorablePrice;

  if (favorablePoints <= 0) {
    return {
      shouldTrail: false,
      newSl: currentSlPrice,
      milestone: 0,
      profitPctLocked: 0,
      pointsTrailed: 0,
      reason: 'Trade currently flat or in negative territory.',
    };
  }

  // How many complete 100% (1.0x Risk) moves have been achieved?
  const milestone = Math.floor(favorablePoints / riskPoints);

  if (milestone >= 1) {
    // 35% of initial risk distance per 100% move
    const profitLockPoints = milestone * 0.35 * riskPoints;
    const computedSl = isBuy ? entryPrice + profitLockPoints : entryPrice - profitLockPoints;

    // SL can only move in a more favorable direction, never loosen
    const isMoreFavorable = isBuy ? computedSl > currentSlPrice : computedSl < currentSlPrice;

    if (isMoreFavorable) {
      const pointsTrailed = Number(Math.abs(computedSl - currentSlPrice).toFixed(2));
      const profitPctLocked = Number((milestone * 35).toFixed(1));

      return {
        shouldTrail: true,
        newSl: Number(computedSl.toFixed(2)),
        milestone,
        profitPctLocked,
        pointsTrailed,
        reason: `Hit ${milestone * 100}% favorable move! Trailed SL to ${computedSl.toFixed(2)} (+${profitPctLocked}% risk locked in profit).`,
      };
    }
  }

  return {
    shouldTrail: false,
    newSl: currentSlPrice,
    milestone,
    profitPctLocked: milestone * 35,
    pointsTrailed: 0,
    reason: `Favorable move is ${(favorablePoints / riskPoints * 100).toFixed(1)}% of risk; next trailing milestone at ${(milestone + 1) * 100}%.`,
  };
}
