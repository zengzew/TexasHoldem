import { describe, expect, it } from 'vitest';
import { getLeaderboardMetric } from './leaderboardMetric';

describe('leaderboard metric formatting', () => {
  const baseRow = {
    totalProfit: 7700,
    avgProfitPerSession: 3850,
    amountRmb: 242,
    avgAmountPerSession: 121,
    winningGames: 3,
    totalSessions: 4,
  };

  it('formats amount rows as RMB', () => {
    expect(getLeaderboardMetric(baseRow, 'amount')).toEqual({
      text: '¥242.00',
      isPositive: true,
    });
  });

  it('formats avg profit rows as chips', () => {
    expect(getLeaderboardMetric(baseRow, 'avgProfit')).toEqual({
      text: '3850',
      isPositive: true,
    });
  });

  it('formats profit rows as chips', () => {
    expect(getLeaderboardMetric(baseRow, 'profit')).toEqual({
      text: '7700',
      isPositive: true,
    });
  });

  it('falls back to profit for unsupported metrics', () => {
    expect(getLeaderboardMetric(baseRow, 'roi')).toEqual({
      text: '7700',
      isPositive: true,
    });
  });

  it('formats winning game rows as a count over total sessions', () => {
    expect(getLeaderboardMetric(baseRow, 'winningGames')).toEqual({
      text: '盈利 3/4',
      isPositive: true,
    });
  });
});
