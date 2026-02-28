export function todayRoomId() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

export function toMoney(value) {
  return Number(value || 0).toFixed(2);
}

export function toCents(value) {
  return Math.round(Number(value || 0) * 100);
}

export function centsToAmount(cents) {
  return Number((cents / 100).toFixed(2));
}

export function greedyTransfers(nets) {
  const debtors = [];
  const creditors = [];

  Object.entries(nets).forEach(([playerId, amount]) => {
    if (amount < 0) debtors.push({ playerId, amount });
    if (amount > 0) creditors.push({ playerId, amount });
  });

  debtors.sort((a, b) => a.amount - b.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const transfers = [];
  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];
    const pay = Math.min(-debtor.amount, creditor.amount);

    transfers.push({
      fromPlayerId: debtor.playerId,
      toPlayerId: creditor.playerId,
      amount: centsToAmount(pay),
    });

    debtor.amount += pay;
    creditor.amount -= pay;

    if (debtor.amount === 0) i += 1;
    if (creditor.amount === 0) j += 1;
  }

  return transfers;
}

export function validateAndBuildSettlement(players) {
  const localPlayers = Array.isArray(players) ? players : [];
  if (!localPlayers.length) {
    return { ok: false, error: '房间中还没有玩家' };
  }

  if (localPlayers.some((p) => p.final_chips == null)) {
    return { ok: false, error: '请先填写每位玩家最终积分' };
  }

  let buyInTotal = 0;
  let finalTotal = 0;
  const nets = {};

  localPlayers.forEach((p) => {
    const buyInCents = toCents(p.buy_in);
    const finalCents = toCents(p.final_chips);
    buyInTotal += buyInCents;
    finalTotal += finalCents;
    nets[p.player_id] = finalCents - buyInCents;
  });

  const diff = finalTotal - buyInTotal;
  if (diff !== 0) {
    return { ok: false, error: `数据未配平，当前差额 ${centsToAmount(diff)}` };
  }

  const netSum = Object.values(nets).reduce((acc, n) => acc + n, 0);
  if (netSum !== 0) {
    return { ok: false, error: '净输赢校验失败，请检查输入' };
  }

  return {
    ok: true,
    nets,
    transfers: greedyTransfers(nets),
    buyInTotal: centsToAmount(buyInTotal),
    finalTotal: centsToAmount(finalTotal),
  };
}
