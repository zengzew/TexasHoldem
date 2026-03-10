export function normalizeNicknameForSearch(value) {
  return String(value || '').normalize('NFKC').trim().replace(/\s+/g, '').toLowerCase();
}

export function buildLeftMatchSuggestions(profiles, query, existingPlayerIds = new Set(), limit = 8) {
  const q = normalizeNicknameForSearch(query);
  if (!q) return [];
  const exists = existingPlayerIds instanceof Set ? existingPlayerIds : new Set(existingPlayerIds || []);
  return (profiles || [])
    .filter((row) => row && row.id)
    .filter((row) => {
      if (exists.has(row.id)) return false;
      return normalizeNicknameForSearch(row.nickname).startsWith(q);
    })
    .slice(0, limit);
}

export function findBestProfileForAdd(profiles, rawInput, existingPlayerIds = new Set()) {
  const q = normalizeNicknameForSearch(rawInput);
  if (!q) return null;
  const exists = existingPlayerIds instanceof Set ? existingPlayerIds : new Set(existingPlayerIds || []);
  const pool = (profiles || []).filter((row) => row && row.id && !exists.has(row.id));
  const exact = pool.find((row) => normalizeNicknameForSearch(row.nickname) === q);
  if (exact) return exact;
  return pool.find((row) => normalizeNicknameForSearch(row.nickname).startsWith(q)) || null;
}
