export function getJoinedRoomStorageKey(userId) {
  const id = String(userId || '').trim();
  return id ? `holdem:joined-room:${id}` : '';
}

function safeStorage(storageArg) {
  if (storageArg) return storageArg;
  if (typeof window === 'undefined') return null;
  return window.localStorage || null;
}

export function loadPersistedJoinedRoom(userId, storageArg) {
  const key = getJoinedRoomStorageKey(userId);
  const storage = safeStorage(storageArg);
  if (!key || !storage) return '';
  try {
    return String(storage.getItem(key) || '').trim();
  } catch {
    return '';
  }
}

export function savePersistedJoinedRoom(userId, roomId, storageArg) {
  const key = getJoinedRoomStorageKey(userId);
  const storage = safeStorage(storageArg);
  if (!key || !storage) return;
  const value = String(roomId || '').trim();
  try {
    if (!value) {
      storage.removeItem(key);
      return;
    }
    storage.setItem(key, value);
  } catch {
    // ignore quota/privacy mode errors
  }
}

export function clearPersistedJoinedRoom(userId, storageArg) {
  savePersistedJoinedRoom(userId, '', storageArg);
}

