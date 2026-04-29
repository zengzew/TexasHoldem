function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toChipInt(value) {
  return Math.round(toNumber(value, 0));
}

function toMoney(value) {
  return Number(toNumber(value, 0).toFixed(2));
}

export function aggregatePersonalDashboard(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const totalSessions = list.length;
  const winningGames = list.filter((row) => toChipInt(row?.netResult) > 0).length;
  const totalBuyIn = list.reduce((sum, row) => sum + Math.max(0, toChipInt(row?.buyIn)), 0);
  const totalProfit = list.reduce((sum, row) => sum + toChipInt(row?.netResult), 0);
  const totalAmountRmb = list.reduce((sum, row) => sum + toNumber(row?.amountRmb, 0), 0);

  return {
    totalSessions,
    winningGames,
    totalBuyIn: Math.max(0, totalBuyIn),
    totalProfit,
    totalAmountRmb: toMoney(totalAmountRmb),
    avgProfitPerSession: totalSessions ? Math.round(totalProfit / totalSessions) : 0,
    avgAmountPerSession: totalSessions ? toMoney(totalAmountRmb / totalSessions) : 0,
  };
}

export function buildPersonalTrend(rows, limit = 10) {
  const list = [...(Array.isArray(rows) ? rows : [])]
    .sort((a, b) => new Date(a?.createdAt || 0).getTime() - new Date(b?.createdAt || 0).getTime())
    .slice(-Math.max(0, limit));

  return list.map((row, index) => ({
    sessionId: row?.sessionId || '',
    createdAt: row?.createdAt || null,
    netResult: toChipInt(row?.netResult),
    amountRmb: toMoney(row?.amountRmb),
    buyIn: Math.max(0, toChipInt(row?.buyIn)),
    ordinal: index + 1,
  }));
}

export function buildPersonalDashboardFreshness(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const settledCount = list.length;
  const latestMarker = list.reduce((latest, row) => {
    const candidate = String(row?.createdAt || '');
    return candidate > latest ? candidate : latest;
  }, '');

  return {
    settledCount,
    latestMarker,
  };
}
