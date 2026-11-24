import { Candle } from '../brokers/types';

// Simple Moving Average
export function calculateSMA(data: number[], period: number): number[] {
  const sma: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      sma.push(NaN);
    } else {
      const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      sma.push(sum / period);
    }
  }
  return sma;
}

// Exponential Moving Average
export function calculateEMA(data: number[], period: number): number[] {
  const ema: number[] = [];
  const multiplier = 2 / (period + 1);

  let initialSMA = 0;
  for (let i = 0; i < period && i < data.length; i++) {
    initialSMA += data[i];
  }
  initialSMA /= period;

  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      ema.push(NaN);
    } else if (i === period - 1) {
      ema.push(initialSMA);
    } else {
      const prevEMA = ema[i - 1];
      const currentEMA = (data[i] - prevEMA) * multiplier + prevEMA;
      ema.push(currentEMA);
    }
  }
  return ema;
}

// Relative Strength Index (RSI)
export function calculateRSI(closes: number[], period: number = 14): number[] {
  const rsi: number[] = [];
  const gains: number[] = [];
  const losses: number[] = [];

  for (let i = 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    gains.push(diff >= 0 ? diff : 0);
    losses.push(diff < 0 ? -diff : 0);
  }

  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

  for (let i = 0; i < period; i++) {
    rsi.push(NaN);
  }

  let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  rsi.push(100 - (100 / (1 + rs)));

  for (let i = period; i < gains.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
    rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsi.push(100 - (100 / (1 + rs)));
  }

  return rsi;
}

// Supertrend Indicator
export interface SupertrendResult {
  trend: 'BULLISH' | 'BEARISH';
  upperBand: number;
  lowerBand: number;
  value: number;
}

export function calculateSupertrend(candles: Candle[], period: number = 10, multiplier: number = 3): SupertrendResult {
  if (candles.length < period) {
    return { trend: 'BULLISH', upperBand: 0, lowerBand: 0, value: candles[candles.length - 1]?.close || 0 };
  }

  // Simplified calculation for the latest state
  const lastCandle = candles[candles.length - 1];
  const tr = lastCandle.high - lastCandle.low;
  const hl2 = (lastCandle.high + lastCandle.low) / 2;
  const upperBand = hl2 + multiplier * tr;
  const lowerBand = hl2 - multiplier * tr;

  const trend = lastCandle.close > hl2 ? 'BULLISH' : 'BEARISH';
  return {
    trend,
    upperBand,
    lowerBand,
    value: trend === 'BULLISH' ? lowerBand : upperBand,
  };
}
