import { describe, expect, it } from 'vitest';
import { LEADERBOARD_BENCHMARKS } from './leaderboardBenchmarks';

describe('leaderboard benchmarks', () => {
  it('keeps the visible benchmark order without roi and win rate', () => {
    expect(LEADERBOARD_BENCHMARKS.map((item) => item.key)).toEqual([
      'profit',
      'avgProfit',
      'amount',
      'efficiency',
    ]);
    expect(LEADERBOARD_BENCHMARKS.some((item) => item.key === 'roi')).toBe(false);
    expect(LEADERBOARD_BENCHMARKS.some((item) => item.key === 'winRate')).toBe(false);
  });
});
