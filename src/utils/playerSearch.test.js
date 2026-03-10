import { describe, expect, it } from 'vitest';
import { buildLeftMatchSuggestions, findBestProfileForAdd, normalizeNicknameForSearch } from './playerSearch';

describe('playerSearch', () => {
  const profiles = [
    { id: '1', nickname: 'Bigfish' },
    { id: '2', nickname: 'Ben' },
    { id: '3', nickname: 'alice' },
  ];

  it('normalizes nickname for search', () => {
    expect(normalizeNicknameForSearch('  Big fish  ')).toBe('bigfish');
  });

  it('builds left-match suggestions', () => {
    const result = buildLeftMatchSuggestions(profiles, 'b');
    expect(result.map((x) => x.nickname)).toEqual(['Bigfish', 'Ben']);
  });

  it('skips existing players', () => {
    const result = buildLeftMatchSuggestions(profiles, 'b', new Set(['1']));
    expect(result.map((x) => x.nickname)).toEqual(['Ben']);
  });

  it('finds exact first then left-match fallback for add action', () => {
    expect(findBestProfileForAdd(profiles, 'ben')?.nickname).toBe('Ben');
    expect(findBestProfileForAdd(profiles, 'b')?.nickname).toBe('Bigfish');
  });
});
