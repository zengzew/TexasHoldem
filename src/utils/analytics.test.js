import { describe, expect, it } from 'vitest';
import { aggregateLeaderboardRows, buildDateRange, filterRowsByDateRange, sortLeaderboardRows } from './analytics';

describe('analytics utils', () => {
  it('buildDateRange handles 3m preset', () => {
    const now = new Date('2026-03-02T12:00:00.000Z');
    const range = buildDateRange({ preset: '3m', now });
    expect(range.from?.toISOString()).toBe('2025-11-30T16:00:00.000Z');
    expect(range.to?.toISOString()).toBe('2026-03-02T15:59:59.999Z');
  });

  it('buildDateRange handles custom range for all preset', () => {
    const range = buildDateRange({ preset: 'all', customStart: '2026-02-01', customEnd: '2026-02-20' });
    expect(range.from?.toISOString()).toBe('2026-01-31T16:00:00.000Z');
    expect(range.to?.toISOString()).toBe('2026-02-20T15:59:59.999Z');
  });

  it('filters rows by date range inclusively', () => {
    const rows = [
      { id: 'a', createdAt: '2026-01-01T10:00:00.000Z' },
      { id: 'b', createdAt: '2026-02-10T10:00:00.000Z' },
      { id: 'c', createdAt: '2026-03-01T10:00:00.000Z' },
    ];
    const range = buildDateRange({ preset: 'all', customStart: '2026-02-01', customEnd: '2026-02-28' });
    expect(filterRowsByDateRange(rows, range).map((r) => r.id)).toEqual(['b']);
  });

  it('aggregates total games, winning games, win rate and RMB amount', () => {
    const rows = [
      { playerId: 'u1', playerName: 'A', buyIn: 2000, netResult: 1000, rmbPer2000: 100 },
      { playerId: 'u1', playerName: 'A', buyIn: 3000, netResult: -500, rmbPer2000: 120 },
      { playerId: 'u2', playerName: 'B', buyIn: 2000, netResult: 0, rmbPer2000: 100 },
    ];

    const aggregated = aggregateLeaderboardRows(rows);
    const a = aggregated.find((row) => row.playerId === 'u1');

    expect(a?.totalSessions).toBe(2);
    expect(a?.winningGames).toBe(1);
    expect(a?.winRate).toBe(50);
    expect(a?.totalProfit).toBe(500);
    expect(a?.amountRmb).toBe(20);
  });

  it('supports sort metric amount and winRate', () => {
    const rows = [
      {
        playerId: 'a',
        totalProfit: 100,
        totalSessions: 2,
        winRate: 40,
        amountRmb: 50,
        roi: 10,
        avgProfitPerSession: 50,
        avgAmountPerSession: 25,
      },
      {
        playerId: 'b',
        totalProfit: 50,
        totalSessions: 3,
        winRate: 85,
        amountRmb: 20,
        roi: 8,
        avgProfitPerSession: 17,
        avgAmountPerSession: 6.7,
      },
      {
        playerId: 'c',
        totalProfit: 10,
        totalSessions: 1,
        winRate: 20,
        amountRmb: 99,
        roi: 2,
        avgProfitPerSession: 10,
        avgAmountPerSession: 99,
      },
    ];

    expect(sortLeaderboardRows(rows, 'amount').map((row) => row.playerId)).toEqual(['c', 'a', 'b']);
    expect(sortLeaderboardRows(rows, 'winRate').map((row) => row.playerId)).toEqual(['b', 'a', 'c']);
    expect(sortLeaderboardRows(rows, 'efficiency').map((row) => row.playerId)).toEqual(['c', 'a', 'b']);
  });
});
