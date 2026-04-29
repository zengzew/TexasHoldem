import { describe, expect, it } from 'vitest';
import {
  aggregatePersonalDashboard,
  buildPersonalDashboardFreshness,
  buildPersonalTrend,
} from './personalDashboard';

describe('personal dashboard helpers', () => {
  const baseRows = [
    {
      sessionId: '20260301',
      createdAt: '2026-03-01T12:00:00.000Z',
      buyIn: 2000,
      netResult: 1000,
      amountRmb: 50,
    },
    {
      sessionId: '20260302',
      createdAt: '2026-03-02T12:00:00.000Z',
      buyIn: 4000,
      netResult: -500,
      amountRmb: -25,
    },
    {
      sessionId: '20260303',
      createdAt: '2026-03-03T12:00:00.000Z',
      buyIn: 3000,
      netResult: 0,
      amountRmb: 0,
    },
  ];

  it('aggregates summary metrics correctly', () => {
    expect(aggregatePersonalDashboard(baseRows)).toEqual({
      totalSessions: 3,
      winningGames: 1,
      totalBuyIn: 9000,
      totalProfit: 500,
      totalAmountRmb: 25,
      avgProfitPerSession: 167,
      avgAmountPerSession: 8.33,
    });
  });

  it('builds ascending recent trend limited to the last 10 sessions', () => {
    const rows = Array.from({ length: 12 }, (_, index) => ({
      sessionId: `s${index + 1}`,
      createdAt: `2026-03-${String(index + 1).padStart(2, '0')}T12:00:00.000Z`,
      netResult: index + 1,
      amountRmb: index + 0.5,
      buyIn: 2000,
    }));

    const trend = buildPersonalTrend(rows);
    expect(trend).toHaveLength(10);
    expect(trend[0].sessionId).toBe('s3');
    expect(trend[9].sessionId).toBe('s12');
    expect(trend[0].ordinal).toBe(1);
    expect(trend[9].ordinal).toBe(10);
  });

  it('builds a freshness signature from settled rows', () => {
    expect(buildPersonalDashboardFreshness(baseRows)).toEqual({
      settledCount: 3,
      latestMarker: '2026-03-03T12:00:00.000Z',
    });
  });
});
