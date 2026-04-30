function safeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function formatSignedPercent(value) {
  const amount = safeNumber(value);
  return `${amount > 0 ? '+' : ''}${amount.toFixed(1)}%`;
}

function formatRmb(value) {
  const amount = safeNumber(value);
  const absText = Math.abs(amount).toFixed(2);
  return `${amount < 0 ? '-' : ''}¥${absText}`;
}

function formatChips(value) {
  return String(Math.round(safeNumber(value)));
}

export function getLeaderboardMetric(row, metric = 'profit') {
  const totalProfit = safeNumber(row?.totalProfit);
  const avgProfitPerSession = safeNumber(row?.avgProfitPerSession);
  const amountRmb = safeNumber(row?.amountRmb);
  const avgAmountPerSession = safeNumber(row?.avgAmountPerSession);
  const winningGames = Math.round(safeNumber(row?.winningGames));
  const totalSessions = Math.round(safeNumber(row?.totalSessions));

  switch (metric) {
    case 'avgProfit':
      return {
        text: formatChips(avgProfitPerSession),
        isPositive: avgProfitPerSession >= 0,
      };
    case 'amount':
      return {
        text: formatRmb(amountRmb),
        isPositive: amountRmb >= 0,
      };
    case 'efficiency':
      return {
        text: formatRmb(avgAmountPerSession),
        isPositive: avgAmountPerSession >= 0,
      };
    case 'winningGames':
      return {
        text: `盈利 ${winningGames}/${totalSessions}`,
        isPositive: winningGames > 0,
      };
    case 'profit':
    default:
      return {
        text: formatChips(totalProfit),
        isPositive: totalProfit >= 0,
      };
  }
}
