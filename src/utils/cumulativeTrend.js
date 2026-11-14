export const DEFAULT_TREND_MIN_SESSIONS = 5;

export function buildCumulativeTrend(rows) {
  const players = new Map();
  const timestamps = new Set();

  for (const { playerId, playerName, sessionId, createdAt, netResult } of rows) {
    const time = createdAt ? Date.parse(createdAt) : NaN;
    if (!playerId || !sessionId || !Number.isFinite(time)) continue;

    if (!players.has(playerId)) players.set(playerId, { playerId, name: playerName || 'Unknown', games: new Map() });
    const { games } = players.get(playerId);
    if (games.has(sessionId)) continue;
    games.set(sessionId, { time, score: Math.round(Number(netResult) || 0) });
    timestamps.add(time);
  }

  const series = Array.from(players.values(), ({ games, ...player }) => {
    const points = [];
    let total = 0;
    for (const { time, score } of Array.from(games.values()).sort((a, b) => a.time - b.time)) {
      total += score;
      // Different sessions at the same time share a single chart coordinate.
      if (points.at(-1)?.time === time) points.at(-1).score = total;
      else points.push({ time, score: total });
    }
    return { ...player, sessionCount: games.size, points };
  }).sort((a, b) => b.sessionCount - a.sessionCount || a.name.localeCompare(b.name, 'zh-CN') || a.playerId.localeCompare(b.playerId));

  return { series, times: Array.from(timestamps).sort((a, b) => a - b) };
}

// Index of the latest result known at this point on the shared time axis.
export function lastTrendIndex(items, time, getTime) {
  let left = 0;
  let right = items.length;
  while (left < right) {
    const middle = (left + right) >>> 1;
    if (getTime(items[middle]) <= time) left = middle + 1;
    else right = middle;
  }
  return left - 1;
}
