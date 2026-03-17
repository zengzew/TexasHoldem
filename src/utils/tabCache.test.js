import { describe, expect, it } from 'vitest';
import {
  clearHistoryCache,
  clearLeaderboardCache,
  loadHistoryCache,
  loadLeaderboardCache,
  saveHistoryCache,
  saveLeaderboardCache,
} from './tabCache';

function createMockStorage() {
  const store = new Map();
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
  };
}

describe('tab cache persistence', () => {
  it('saves and loads leaderboard cache by user id', () => {
    const storage = createMockStorage();
    const payload = { rows: [{ playerId: 'u1' }], freshness: { settledCount: 3 } };

    saveLeaderboardCache('u1', payload, storage);

    expect(loadLeaderboardCache('u1', storage)).toEqual(payload);

    clearLeaderboardCache('u1', storage);
    expect(loadLeaderboardCache('u1', storage)).toBeNull();
  });

  it('saves and loads history cache by user id', () => {
    const storage = createMockStorage();
    const payload = { sessions: [{ id: '20260317' }], freshness: { totalCount: 1, settledCount: 0 } };

    saveHistoryCache('u1', payload, storage);

    expect(loadHistoryCache('u1', storage)).toEqual(payload);

    clearHistoryCache('u1', storage);
    expect(loadHistoryCache('u1', storage)).toBeNull();
  });
});
