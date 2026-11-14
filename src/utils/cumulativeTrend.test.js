import { expect, it } from 'vitest';
import { buildCumulativeTrend, DEFAULT_TREND_MIN_SESSIONS, lastTrendIndex } from './cumulativeTrend';

const row = (playerId, day, netResult, sessionId = `room-${day}`) => ({
  playerId,
  playerName: playerId,
  sessionId,
  netResult,
  createdAt: `2026-11-${String(day).padStart(2, '0')}T13:00:00Z`,
});

it('qualifies by distinct settled sessions and keeps results from before the fifth session', () => {
  const { series, times } = buildCumulativeTrend([
    row('A', 7, 1), row('A', 1, -300), row('A', 4, 300), row('A', 5, 100), row('A', 10, -250),
    row('A', 10, -250), row('B', 2, 0), row('B', 4, 50), row('B', 5, -30), row('B', 12, -20),
    { ...row('B', 13, 500), createdAt: null },
  ]);
  expect(series.filter((player) => player.sessionCount >= DEFAULT_TREND_MIN_SESSIONS).map((player) => player.playerId)).toEqual(['A']);
  expect(series[0].points.map(({ score }) => score)).toEqual([-300, 0, 100, 101, -149]);
  expect(series[1].sessionCount).toBe(4);
  expect(times.at(-1)).toBe(Date.parse(row('B', 12, 0).createdAt));
});

it('uses one coordinate for simultaneous sessions and carries the last score between sessions', () => {
  const { series, times } = buildCumulativeTrend([
    row('A', 4, -50, 'a1'), row('A', 4, 25, 'a2'), row('A', 9, 15),
    row('B', 6, 50), row('B', 2, 30),
  ]);
  const points = series[0].points;
  expect(lastTrendIndex(points, times[0], ({ time }) => time)).toBe(-1);
  expect(points[lastTrendIndex(points, times[2], ({ time }) => time)].score).toBe(-25);
  expect(points.map(({ score }) => score)).toEqual([-25, -10]);
});
