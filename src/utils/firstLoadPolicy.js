export function deriveInitialLoadPlan({ persistedRoomId }) {
  const restoreRoomId = String(persistedRoomId || '').trim();
  return {
    restoreRoomId,
    loadOpenRooms: !restoreRoomId,
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
