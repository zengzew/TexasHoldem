function safeSessionStorage(storageArg) {
  if (storageArg) return storageArg;
  if (typeof window === 'undefined') return null;
  return window.sessionStorage || null;
}

function getTabCacheKey(userId, scope) {
  const id = String(userId || '').trim();
  const segment = String(scope || '').trim();
  return id && segment ? `holdem:tab-cache:${segment}:${id}` : '';
}

function loadJson(key, storage) {
  if (!key || !storage) return null;
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function saveJson(key, value, storage) {
  if (!key || !storage) return;
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore quota/privacy mode issues
  }
}

function clearKey(key, storage) {
  if (!key || !storage) return;
  try {
    storage.removeItem(key);
  } catch {
    // ignore quota/privacy mode issues
  }
}

export function loadLeaderboardCache(userId, storageArg) {
  return loadJson(getTabCacheKey(userId, 'leaderboard'), safeSessionStorage(storageArg));
}

export function saveLeaderboardCache(userId, payload, storageArg) {
  saveJson(getTabCacheKey(userId, 'leaderboard'), payload, safeSessionStorage(storageArg));
}

export function clearLeaderboardCache(userId, storageArg) {
  clearKey(getTabCacheKey(userId, 'leaderboard'), safeSessionStorage(storageArg));
}

export function loadHistoryCache(userId, storageArg) {
  return loadJson(getTabCacheKey(userId, 'history'), safeSessionStorage(storageArg));
}

export function saveHistoryCache(userId, payload, storageArg) {
  saveJson(getTabCacheKey(userId, 'history'), payload, safeSessionStorage(storageArg));
}

export function clearHistoryCache(userId, storageArg) {
  clearKey(getTabCacheKey(userId, 'history'), safeSessionStorage(storageArg));
}

export function loadPersonalDashboardCache(userId, storageArg) {
  return loadJson(getTabCacheKey(userId, 'personal-dashboard'), safeSessionStorage(storageArg));
}

export function savePersonalDashboardCache(userId, payload, storageArg) {
  saveJson(getTabCacheKey(userId, 'personal-dashboard'), payload, safeSessionStorage(storageArg));
}

export function clearPersonalDashboardCache(userId, storageArg) {
  clearKey(getTabCacheKey(userId, 'personal-dashboard'), safeSessionStorage(storageArg));
}
