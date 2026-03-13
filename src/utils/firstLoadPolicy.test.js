import { describe, expect, it } from 'vitest';
import {
  deriveInitialLoadPlan,
  deriveInvalidationPlan,
  shouldLoadPlayerDirectory,
  shouldLoadTabData,
} from './firstLoadPolicy';

describe('firstLoadPolicy', () => {
  it('restores room first when persisted room exists', () => {
    expect(deriveInitialLoadPlan({ persistedRoomId: '20260313' })).toEqual({
      restoreRoomId: '20260313',
      loadOpenRooms: false,
    });
  });

  it('loads open rooms when there is no persisted room', () => {
    expect(deriveInitialLoadPlan({ persistedRoomId: '' })).toEqual({
      restoreRoomId: '',
      loadOpenRooms: true,
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
});
