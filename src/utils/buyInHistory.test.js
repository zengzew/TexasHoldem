import { describe, expect, it } from 'vitest';
import { buildBuyInEventPayload, formatBuyInEventTime, normalizeBuyInEvents } from './buyInHistory';

describe('buyInHistory utils', () => {
  it('sorts buy-in events by created_at ascending', () => {
    const events = normalizeBuyInEvents([
      { amount: -1000, created_at: '2026-03-15T08:10:00.000Z' },
      { amount: 2000, created_at: '2026-03-15T08:05:00.000Z' },
      { amount: 500, created_at: '2026-03-15T08:06:00.000Z' },
    ]);

    expect(events.map((event) => event.amount)).toEqual([2000, 500, -1000]);
  });

  it('formats event time in Asia/Shanghai at HH:mm precision', () => {
    expect(formatBuyInEventTime('2026-03-15T08:05:00.000Z')).toBe('16:05');
  });

  it('normalizes signed chip values for display', () => {
    const events = normalizeBuyInEvents([{ amount: 2000, created_at: '2026-03-15T08:05:00.000Z' }]);
    expect(events[0].displayAmount).toBe('+2000');
  });

  it('keeps negative correction values in display', () => {
    const events = normalizeBuyInEvents([{ amount: -1000, created_at: '2026-03-15T08:05:00.000Z' }]);
    expect(events[0].displayAmount).toBe('-1000');
  });

  it('builds a buy-in event payload for confirmed drafts', () => {
    expect(
      buildBuyInEventPayload({
        roomId: '20260315',
        playerId: 'player-1',
        createdBy: 'owner-1',
        amount: -2000,
      })
    ).toEqual({
      room_id: '20260315',
      player_id: 'player-1',
      created_by: 'owner-1',
      amount: -2000,
    });
  });
});
