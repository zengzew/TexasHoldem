import { expect, it } from 'vitest';
import { buildCumulativeTrend, DEFAULT_TREND_MIN_SESSIONS, findTrendPoint } from './cumulativeTrend';

const row = (playerId, day, netResult, sessionId = `room-${day}`) => ({
  playerId,
  playerName: playerId,
  sessionId,
  netResult,
  createdAt: `2026-11-${String(day).padStart(2, '0')}T13:00:00Z`,
});

it('qualifies by distinct settled sessions and keeps results from before the fifth session', () => {
  const { series, sessions } = buildCumulativeTrend([
    row('A', 7, 1), row('A', 1, -300), row('A', 4, 300), row('A', 5, 100), row('A', 10, -250),
    row('A', 10, -250), row('B', 2, 0), row('B', 4, 50), row('B', 5, -30), row('B', 12, -20),
    { ...row('B', 13, 500), createdAt: null },
  ]);
  expect(series.filter((player) => player.sessionCount >= DEFAULT_TREND_MIN_SESSIONS).map((player) => player.playerId)).toEqual(['A']);
  expect(series[0].points.map(({ score }) => score)).toEqual([-300, 0, 100, 101, -149]);
  expect(series[1].sessionCount).toBe(4);
  expect(sessions.at(-1).time).toBe(Date.parse(row('B', 12, 0).createdAt));
});

it('keeps separate positions for simultaneous sessions and omits absent players from the selected session', () => {
  const { series, sessions, sessionIndexes } = buildCumulativeTrend([
    row('A', 4, 25, 'a2'), row('A', 4, -50, 'a1'), row('A', 9, 15),
    row('B', 4, 30, 'a2'), row('B', 6, 0), row('B', 2, 30),
  ]);
  expect(sessions.map(({ sessionId }) => sessionId)).toEqual(['room-2', 'a1', 'a2', 'room-6', 'room-9']);
  const a = series.find(({ playerId }) => playerId === 'A').points;
  const b = series.find(({ playerId }) => playerId === 'B').points;
  expect(a.map(({ sessionIndex, score }) => [sessionIndex, score])).toEqual([[1, -50], [2, -25], [4, -10]]);
  expect(findTrendPoint(b, sessionIndexes.get('a1'))).toBeUndefined();
  expect(findTrendPoint(b, sessionIndexes.get('a2'))?.score).toBe(60);
  expect(findTrendPoint(a, sessionIndexes.get('room-6'))).toBeUndefined();
  expect(findTrendPoint(b, sessionIndexes.get('room-6'))?.score).toBe(60);
});
