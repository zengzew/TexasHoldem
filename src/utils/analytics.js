function parseNum(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toStartOfDay(dateValue) {
  const d = new Date(dateValue);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

function toEndOfDay(dateValue) {
  const d = new Date(dateValue);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
}

export function buildDateRange({ preset = 'all', customStart = '', customEnd = '', now = new Date() } = {}) {
  const safeNow = now instanceof Date && !Number.isNaN(now.getTime()) ? now : new Date();
  const safePreset = preset || 'all';

  const customFrom = customStart ? new Date(`${customStart}T00:00:00.000Z`) : null;
  const customTo = customEnd ? new Date(`${customEnd}T23:59:59.999Z`) : null;

  if (safePreset === 'all') {
    return {
      from: customFrom && !Number.isNaN(customFrom.getTime()) ? customFrom : null,
      to: customTo && !Number.isNaN(customTo.getTime()) ? customTo : null,
    };
  }

  const end = toEndOfDay(safeNow);
  let start;

  if (safePreset === '3m') {
    start = new Date(Date.UTC(safeNow.getUTCFullYear(), safeNow.getUTCMonth() - 3, 1, 0, 0, 0, 0));
  } else if (safePreset === '6m') {
    start = new Date(Date.UTC(safeNow.getUTCFullYear(), safeNow.getUTCMonth() - 6, 1, 0, 0, 0, 0));
  } else {
    start = toStartOfDay(new Date(Date.UTC(safeNow.getUTCFullYear() - 1, safeNow.getUTCMonth(), safeNow.getUTCDate())));
  }

  return { from: start, to: end };
}

export function filterRowsByDateRange(rows, range) {
  const list = Array.isArray(rows) ? rows : [];
  const from = range?.from ? new Date(range.from) : null;
  const to = range?.to ? new Date(range.to) : null;

  return list.filter((item) => {
    const ts = item?.createdAt || item?.created_at;
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return false;
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  });
}

export function aggregateLeaderboardRows(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const agg = new Map();

  list.forEach((item) => {
    const playerId = item?.playerId ?? item?.player_id;
    if (!playerId) return;

    if (!agg.has(playerId)) {
      agg.set(playerId, {
        playerId,
        name: item?.playerName || item?.name || item?.nickname || 'Unknown',
        totalSessions: 0,
        winningGames: 0,
        totalBuyIn: 0,
        totalProfit: 0,
        amountRmb: 0,
      });
    }

    const row = agg.get(playerId);
    const buyIn = Math.max(0, Math.round(parseNum(item?.buyIn ?? item?.buy_in, 0)));
    const netResult = Math.round(parseNum(item?.netResult ?? item?.net_result, 0));
    const rate = parseNum(item?.rmbPer2000 ?? item?.rmb_per_2000, 100);

    row.totalSessions += 1;
    if (netResult > 0) row.winningGames += 1;
    row.totalBuyIn += buyIn;
    row.totalProfit += netResult;
    row.amountRmb += (netResult / 2000) * rate;
  });

  return Array.from(agg.values()).map((row) => {
    const roi = row.totalBuyIn ? (row.totalProfit / row.totalBuyIn) * 100 : 0;
    const winRate = row.totalSessions ? (row.winningGames / row.totalSessions) * 100 : 0;
    return {
      ...row,
      totalBuyIn: Math.round(row.totalBuyIn),
      totalProfit: Math.round(row.totalProfit),
      amountRmb: Number(row.amountRmb.toFixed(2)),
      avgProfitPerSession: row.totalSessions ? Math.round(row.totalProfit / row.totalSessions) : 0,
      roi: Number(roi.toFixed(1)),
      winRate: Number(winRate.toFixed(1)),
    };
  });
}

export function sortLeaderboardRows(rows, metric = 'profit') {
  const list = [...(Array.isArray(rows) ? rows : [])];

  const sorters = {
    profit: (a, b) => b.totalProfit - a.totalProfit || b.totalSessions - a.totalSessions,
    roi: (a, b) => b.roi - a.roi || b.totalProfit - a.totalProfit,
    efficiency: (a, b) => b.avgProfitPerSession - a.avgProfitPerSession || b.totalProfit - a.totalProfit,
    amount: (a, b) => b.amountRmb - a.amountRmb || b.totalProfit - a.totalProfit,
    winRate: (a, b) => b.winRate - a.winRate || b.totalProfit - a.totalProfit,
  };

  const sorter = sorters[metric] || sorters.profit;
  return list.sort(sorter).map((item, idx) => ({ ...item, displayRank: idx + 1 }));
}
