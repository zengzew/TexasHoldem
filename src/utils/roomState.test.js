import { describe, expect, it } from 'vitest';
import { clearPersistedJoinedRoom, getJoinedRoomStorageKey, loadPersistedJoinedRoom, savePersistedJoinedRoom } from './roomState';

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

describe('room state persistence', () => {
  it('builds storage key by user id', () => {
    expect(getJoinedRoomStorageKey('u1')).toBe('holdem:joined-room:u1');
  });

  it('saves and loads joined room id', () => {
    const storage = createMockStorage();
    savePersistedJoinedRoom('u1', '20260307', storage);
    expect(loadPersistedJoinedRoom('u1', storage)).toBe('20260307');

    clearPersistedJoinedRoom('u1', storage);
    expect(loadPersistedJoinedRoom('u1', storage)).toBe('');
  });
});

