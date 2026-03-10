import { describe, expect, it } from 'vitest';
import { getLeaderboardMetric } from './leaderboardMetric';

describe('leaderboard metric formatting', () => {
  const baseRow = {
    totalProfit: 7700,
    roi: 465,
    amountRmb: 242,
    winRate: 50,
    avgAmountPerSession: 121,
  };

  it('formats roi rows as percentages', () => {
    expect(getLeaderboardMetric(baseRow, 'roi')).toEqual({
      text: '+465.0%',
      isPositive: true,
    });
  });

  it('formats amount rows as RMB', () => {
    expect(getLeaderboardMetric(baseRow, 'amount')).toEqual({
      text: '¥242.00',
      isPositive: true,
    });
  });

  it('formats profit rows as chips', () => {
    expect(getLeaderboardMetric(baseRow, 'profit')).toEqual({
      text: '7700',
      isPositive: true,
    });
  });

  it('keeps negative roi on one line with explicit sign', () => {
    expect(getLeaderboardMetric({ ...baseRow, roi: -33.6 }, 'roi')).toEqual({
      text: '-33.6%',
      isPositive: false,
    });
  });
});
