const BEIJING_TIME_ZONE = 'Asia/Shanghai';

function toChipInt(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n);
}

export function formatBuyInEventTime(createdAt) {
  if (!createdAt) return '--:--';
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: BEIJING_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(createdAt));
}

export function normalizeBuyInEvents(events) {
  const localEvents = Array.isArray(events) ? events : [];
  return [...localEvents]
    .sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime())
    .map((event) => {
      const amount = toChipInt(event.amount);
      return {
        ...event,
        amount,
        displayAmount: `${amount >= 0 ? '+' : ''}${amount}`,
        displayTime: formatBuyInEventTime(event.created_at),
      };
    });
}

export function buildBuyInEventPayload({ roomId, playerId, createdBy, amount }) {
  return {
    room_id: roomId,
    player_id: playerId,
    created_by: createdBy,
    amount: toChipInt(amount),
  };
}

export function buildInitialBuyInEventPayload({ roomId, playerId, createdBy }) {
  return buildBuyInEventPayload({
    roomId,
    playerId,
    createdBy,
    amount: 2000,
  });
}
