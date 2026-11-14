export const DEFAULT_TREND_MIN_SESSIONS = 5;

export function buildCumulativeTrend(rows) {
  const players = new Map();
  const sessionTimes = new Map();

  for (const { playerId, playerName, sessionId, createdAt, netResult } of rows) {
    const time = createdAt ? Date.parse(createdAt) : NaN;
    if (!playerId || !sessionId || !Number.isFinite(time)) continue;

    if (!players.has(playerId)) players.set(playerId, { playerId, name: playerName || 'Unknown', games: new Map() });
    const { games } = players.get(playerId);
    if (games.has(sessionId)) continue;
    games.set(sessionId, Math.round(Number(netResult) || 0));
    if (!sessionTimes.has(sessionId)) sessionTimes.set(sessionId, time);
  }

  const sessions = Array.from(sessionTimes, ([sessionId, time]) => ({ sessionId, time }))
    .sort((a, b) => a.time - b.time || a.sessionId.localeCompare(b.sessionId));
  const sessionIndexes = new Map(sessions.map(({ sessionId }, index) => [sessionId, index]));

  const series = Array.from(players.values(), ({ games, ...player }) => {
    const results = Array.from(games, ([sessionId, score]) => ({ sessionIndex: sessionIndexes.get(sessionId), score }))
      .sort((a, b) => a.sessionIndex - b.sessionIndex);
    let total = 0;
    const points = results.map(({ sessionIndex, score }) => {
      total += score;
      return { sessionIndex, score: total };
    });
    return { ...player, sessionCount: games.size, points };
  }).sort((a, b) => b.sessionCount - a.sessionCount || a.name.localeCompare(b.name, 'zh-CN') || a.playerId.localeCompare(b.playerId));

  return { series, sessions, sessionIndexes };
}

export function findTrendPoint(points, sessionIndex) {
  let left = 0;
  let right = points.length;
  while (left < right) {
    const middle = (left + right) >>> 1;
    const point = points[middle];
    if (point.sessionIndex === sessionIndex) return point;
    if (point.sessionIndex < sessionIndex) left = middle + 1;
    else right = middle;
  }
  return undefined;
}
