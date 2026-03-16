export function deriveInitialLoadPlan({ persistedRoomId }) {
  const restoreRoomId = String(persistedRoomId || '').trim();
  return {
    restoreRoomId,
    loadOpenRooms: !restoreRoomId,
    preserveRoomShell: Boolean(restoreRoomId),
  };
}

export function shouldLoadTabData({ activeTab, targetTab, loaded, loading }) {
  return activeTab === targetTab && !loaded && !loading;
}

export function shouldLoadPlayerDirectory({
  hasJoinedRoom,
  amRoomOwner,
  showMineOnly,
  focused,
  loaded,
  loading,
}) {
  return Boolean(hasJoinedRoom && amRoomOwner && !showMineOnly && focused && !loaded && !loading);
}

export function shouldLoadRoomPlayerDetails({ hasJoinedRoom, showMineOnly, loaded, loading }) {
  return Boolean(hasJoinedRoom && !showMineOnly && !loaded && !loading);
}

export function deriveInvalidationPlan(action) {
  switch (action) {
    case 'add-player':
    case 'remove-player':
    case 'join-room':
    case 'create-room':
      return {
        room: true,
        openRooms: true,
        leaderboard: false,
        history: false,
      };
    case 'settle-room':
      return {
        room: true,
        openRooms: true,
        leaderboard: true,
        history: true,
      };
    default:
      return {
        room: false,
        openRooms: false,
        leaderboard: false,
        history: false,
      };
  }
}

export function shouldRefreshSettledViews({ previousSettledCount, nextSettledCount }) {
  return Number(previousSettledCount || 0) !== Number(nextSettledCount || 0);
}

export function shouldRefreshLeaderboardViews({ previousSignature, nextSignature }) {
  return shouldRefreshSettledViews({
    previousSettledCount: previousSignature?.settledCount,
    nextSettledCount: nextSignature?.settledCount,
  });
}

export function shouldRefreshHistoryViews({ previousSignature, nextSignature }) {
  return (
    Number(previousSignature?.totalCount || 0) !== Number(nextSignature?.totalCount || 0) ||
    Number(previousSignature?.settledCount || 0) !== Number(nextSignature?.settledCount || 0) ||
    String(previousSignature?.latestMarker || '') !== String(nextSignature?.latestMarker || '')
  );
}
