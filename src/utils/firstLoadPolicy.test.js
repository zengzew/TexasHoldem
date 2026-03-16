import { describe, expect, it } from 'vitest';
import {
  deriveInitialLoadPlan,
  deriveInvalidationPlan,
  shouldLoadRoomPlayerDetails,
  shouldRefreshHistoryViews,
  shouldRefreshLeaderboardViews,
  shouldRefreshSettledViews,
  shouldLoadPlayerDirectory,
  shouldLoadTabData,
} from './firstLoadPolicy';

describe('firstLoadPolicy', () => {
  it('restores room first when persisted room exists', () => {
    expect(deriveInitialLoadPlan({ persistedRoomId: '20260313' })).toEqual({
      restoreRoomId: '20260313',
      loadOpenRooms: false,
      preserveRoomShell: true,
    });
  });

  it('loads open rooms when there is no persisted room', () => {
    expect(deriveInitialLoadPlan({ persistedRoomId: '' })).toEqual({
      restoreRoomId: '',
      loadOpenRooms: true,
      preserveRoomShell: false,
    });
  });

  it('loads tab data only when target tab is active and not yet loaded', () => {
    expect(
      shouldLoadTabData({
        activeTab: 'leaderboard',
        targetTab: 'leaderboard',
        loaded: false,
        loading: false,
      })
    ).toBe(true);

    expect(
      shouldLoadTabData({
        activeTab: 'history',
        targetTab: 'leaderboard',
        loaded: false,
        loading: false,
      })
    ).toBe(false);

    expect(
      shouldLoadTabData({
        activeTab: 'leaderboard',
        targetTab: 'leaderboard',
        loaded: true,
        loading: false,
      })
    ).toBe(false);
  });

  it('loads player directory only for owner search in all-player mode', () => {
    expect(
      shouldLoadPlayerDirectory({
        hasJoinedRoom: true,
        amRoomOwner: true,
        showMineOnly: false,
        focused: true,
        loaded: false,
        loading: false,
      })
    ).toBe(true);

    expect(
      shouldLoadPlayerDirectory({
        hasJoinedRoom: true,
        amRoomOwner: false,
        showMineOnly: false,
        focused: true,
        loaded: false,
        loading: false,
      })
    ).toBe(false);
  });

  it('loads room player details only when switching to all-player mode', () => {
    expect(
      shouldLoadRoomPlayerDetails({
        hasJoinedRoom: true,
        showMineOnly: false,
        loaded: false,
        loading: false,
      })
    ).toBe(true);

    expect(
      shouldLoadRoomPlayerDetails({
        hasJoinedRoom: true,
        showMineOnly: true,
        loaded: false,
        loading: false,
      })
    ).toBe(false);

    expect(
      shouldLoadRoomPlayerDetails({
        hasJoinedRoom: true,
        showMineOnly: false,
        loaded: true,
        loading: false,
      })
    ).toBe(false);
  });

  it('marks only required datasets dirty after room actions', () => {
    expect(deriveInvalidationPlan('add-player')).toEqual({
      room: true,
      openRooms: true,
      leaderboard: false,
      history: false,
    });

    expect(deriveInvalidationPlan('settle-room')).toEqual({
      room: true,
      openRooms: true,
      leaderboard: true,
      history: true,
    });
  });

  it('refreshes settled views only when total settled games changes', () => {
    expect(shouldRefreshSettledViews({ previousSettledCount: 3, nextSettledCount: 3 })).toBe(false);
    expect(shouldRefreshSettledViews({ previousSettledCount: 3, nextSettledCount: 4 })).toBe(true);
    expect(shouldRefreshSettledViews({ previousSettledCount: 0, nextSettledCount: 1 })).toBe(true);
  });

  it('refreshes leaderboard only when settled-session freshness changes', () => {
    expect(
      shouldRefreshLeaderboardViews({
        previousSignature: { settledCount: 4 },
        nextSignature: { settledCount: 4 },
      })
    ).toBe(false);

    expect(
      shouldRefreshLeaderboardViews({
        previousSignature: { settledCount: 4 },
        nextSignature: { settledCount: 5 },
      })
    ).toBe(true);
  });

  it('refreshes history only when the history signature changes', () => {
    expect(
      shouldRefreshHistoryViews({
        previousSignature: { totalCount: 5, settledCount: 4, latestMarker: '2026-03-17T08:00:00.000Z' },
        nextSignature: { totalCount: 5, settledCount: 4, latestMarker: '2026-03-17T08:00:00.000Z' },
      })
    ).toBe(false);

    expect(
      shouldRefreshHistoryViews({
        previousSignature: { totalCount: 5, settledCount: 4, latestMarker: '2026-03-17T08:00:00.000Z' },
        nextSignature: { totalCount: 6, settledCount: 4, latestMarker: '2026-03-17T08:00:00.000Z' },
      })
    ).toBe(true);

    expect(
      shouldRefreshHistoryViews({
        previousSignature: { totalCount: 5, settledCount: 4, latestMarker: '2026-03-17T08:00:00.000Z' },
        nextSignature: { totalCount: 5, settledCount: 5, latestMarker: '2026-03-17T08:00:00.000Z' },
      })
    ).toBe(true);

    expect(
      shouldRefreshHistoryViews({
        previousSignature: { totalCount: 5, settledCount: 4, latestMarker: '2026-03-17T08:00:00.000Z' },
        nextSignature: { totalCount: 5, settledCount: 4, latestMarker: '2026-03-17T09:00:00.000Z' },
      })
    ).toBe(true);
  });
});
