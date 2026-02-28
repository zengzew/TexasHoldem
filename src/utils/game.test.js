import { describe, expect, it } from 'vitest';
import {
  centsToAmount,
  greedyTransfers,
  toCents,
  toMoney,
  todayRoomId,
  validateAndBuildSettlement,
} from './game';

describe('game utils', () => {
  it('formats room id as YYYYMMDD', () => {
    expect(todayRoomId()).toMatch(/^\d{8}$/);
  });

  it('converts between money and cents', () => {
    expect(toMoney(12)).toBe('12.00');
    expect(toCents(12.34)).toBe(1234);
    expect(centsToAmount(567)).toBe(5.67);
  });

  it('builds minimal transfer suggestions with greedy matching', () => {
    const transfers = greedyTransfers({ A: -5000, B: -2000, C: 3000, D: 4000 });

    expect(transfers).toEqual([
      { fromPlayerId: 'A', toPlayerId: 'D', amount: 40 },
      { fromPlayerId: 'A', toPlayerId: 'C', amount: 10 },
      { fromPlayerId: 'B', toPlayerId: 'C', amount: 20 },
    ]);
  });

  it('rejects settlement when any final chips is missing', () => {
    const result = validateAndBuildSettlement([
      { player_id: 'A', buy_in: 100, final_chips: 90 },
      { player_id: 'B', buy_in: 100, final_chips: null },
    ]);

    expect(result.ok).toBe(false);
    expect(result.error).toContain('最终积分');
  });

  it('rejects settlement when totals are not balanced', () => {
    const result = validateAndBuildSettlement([
      { player_id: 'A', buy_in: 100, final_chips: 80 },
      { player_id: 'B', buy_in: 100, final_chips: 110 },
    ]);

    expect(result.ok).toBe(false);
    expect(result.error).toContain('数据未配平');
  });

  it('returns transfers for a valid balanced settlement', () => {
    const result = validateAndBuildSettlement([
      { player_id: 'A', buy_in: 100, final_chips: 70 },
      { player_id: 'B', buy_in: 100, final_chips: 130 },
    ]);

    expect(result.ok).toBe(true);
    expect(result.buyInTotal).toBe(200);
    expect(result.finalTotal).toBe(200);
    expect(result.transfers).toEqual([{ fromPlayerId: 'A', toPlayerId: 'B', amount: 30 }]);
  });
});
