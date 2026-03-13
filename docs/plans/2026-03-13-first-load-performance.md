# First-Load Performance Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the page shell and current-room experience render first, while leaderboard, history, and player directory load only when needed.

**Architecture:** Keep all business rules in `src/App.jsx`, but extract load-policy decisions into small pure utilities so lazy-loading behavior can be tested with existing Vitest coverage. Remove unused/duplicated startup requests, add per-tab loaded/loading flags, and keep current UI behavior by showing localized loading states only inside deferred panels.

**Tech Stack:** React 18, Vite, Vitest, Supabase JS, Tailwind CSS utilities in `src/index.css`.

---

### Task 1: Extract first-load policy helpers

**Files:**
- Create: `/Users/zengze/Documents/New project/src/utils/firstLoadPolicy.js`
- Create: `/Users/zengze/Documents/New project/src/utils/firstLoadPolicy.test.js`

**Step 1: Write the failing test**

Add tests for three behaviors:

```js
import { describe, expect, it } from 'vitest';
import {
  deriveInitialLoadPlan,
  shouldLoadTabData,
  shouldLoadPlayerDirectory,
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

  it('only loads tab data once per tab', () => {
    expect(shouldLoadTabData({ activeTab: 'leaderboard', loaded: false, loading: false })).toBe(true);
    expect(shouldLoadTabData({ activeTab: 'leaderboard', loaded: true, loading: false })).toBe(false);
    expect(shouldLoadTabData({ activeTab: 'room', loaded: false, loading: false })).toBe(false);
  });

  it('loads player directory only for owner search in all-players view', () => {
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
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/utils/firstLoadPolicy.test.js`
Expected: FAIL because the module does not exist.

**Step 3: Write minimal implementation**

Implement pure helpers:

```js
export function deriveInitialLoadPlan({ persistedRoomId }) {
  const roomId = String(persistedRoomId || '').trim();
  return {
    restoreRoomId: roomId,
    loadOpenRooms: !roomId,
  };
}

export function shouldLoadTabData({ activeTab, targetTab, loaded, loading }) {
  return activeTab === targetTab && !loaded && !loading;
}

export function shouldLoadPlayerDirectory({ hasJoinedRoom, amRoomOwner, showMineOnly, focused, loaded, loading }) {
  return hasJoinedRoom && amRoomOwner && !showMineOnly && focused && !loaded && !loading;
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/utils/firstLoadPolicy.test.js`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/utils/firstLoadPolicy.js src/utils/firstLoadPolicy.test.js
git commit -m "test: add first-load policy helpers"
```

### Task 2: Refactor startup flow to current-room-first

**Files:**
- Modify: `/Users/zengze/Documents/New project/src/App.jsx`
- Test: `/Users/zengze/Documents/New project/src/utils/firstLoadPolicy.test.js`

**Step 1: Write the failing test**

Extend `firstLoadPolicy.test.js` to cover the startup policy that no longer preloads leaderboard/history/profile directory during initial user-ready handling.

```js
it('does not include deferred datasets in initial load plan', () => {
  const plan = deriveInitialLoadPlan({ persistedRoomId: '20260313' });
  expect(plan.loadOpenRooms).toBe(false);
  expect(plan.restoreRoomId).toBe('20260313');
});
```

**Step 2: Run test to verify baseline behavior**

Run: `npm test -- src/utils/firstLoadPolicy.test.js`
Expected: PASS, confirming the helper contract before wiring it into React.

**Step 3: Write minimal implementation**

In `src/App.jsx`:
- Import `deriveInitialLoadPlan`.
- Remove these startup calls from `onUserReady()`:
  - `loadProfileDirectory()`
  - `loadLeaderboard()`
  - `loadHistorySessions()`
  - `loadGlobalStats()`
- Use `deriveInitialLoadPlan()` to decide:
  - restore persisted room first via `joinExistingRoom(persistedRoomId)`
  - otherwise load only `openRooms`
- Keep `ensureProfile(user)` in the critical path.
- Do not change auth bootstrap or room persistence behavior.
- Delete unused `globalStats` state and `loadGlobalStats()` if it remains unreferenced.

**Step 4: Run verification**

Run: `npm test`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/App.jsx src/utils/firstLoadPolicy.test.js
git commit -m "perf: prioritize current-room startup path"
```

### Task 3: Add lazy loading for leaderboard and history tabs

**Files:**
- Modify: `/Users/zengze/Documents/New project/src/App.jsx`
- Modify: `/Users/zengze/Documents/New project/src/index.css`
- Test: `/Users/zengze/Documents/New project/src/utils/firstLoadPolicy.test.js`

**Step 1: Write the failing test**

Add tests for tab-triggered loading decisions:

```js
it('loads leaderboard only when leaderboard tab is active', () => {
  expect(shouldLoadTabData({ activeTab: 'leaderboard', targetTab: 'leaderboard', loaded: false, loading: false })).toBe(true);
  expect(shouldLoadTabData({ activeTab: 'history', targetTab: 'leaderboard', loaded: false, loading: false })).toBe(false);
});

it('does not reload history when already loaded', () => {
  expect(shouldLoadTabData({ activeTab: 'history', targetTab: 'history', loaded: true, loading: false })).toBe(false);
});
```

**Step 2: Run test to verify it fails if helper does not yet support the contract**

Run: `npm test -- src/utils/firstLoadPolicy.test.js`
Expected: FAIL if `shouldLoadTabData` is not yet parameterized by `targetTab`.

**Step 3: Write minimal implementation**

In `src/App.jsx`:
- Add state flags:
  - `leaderboardLoaded`, `leaderboardLoading`
  - `historyLoaded`, `historyLoading`
- Wrap `loadLeaderboard()` and `loadHistorySessions()` in guarded loaders that:
  - no-op if already loaded/loading
  - set `loaded` on success
- Add `useEffect` watchers on `activeTab` using `shouldLoadTabData()`.
- Add local panel-level loading UI:
  - leaderboard panel shows `加载积分榜中...`
  - history panel shows `加载历史记录中...`
- Do not block room tab rendering while these load.

In `src/index.css`:
- Add a minimal utility class only if needed for panel placeholders; avoid new animations.

**Step 4: Run verification**

Run:
- `npm test`
- `npm run build`

Expected: both PASS.

**Step 5: Commit**

```bash
git add src/App.jsx src/index.css src/utils/firstLoadPolicy.test.js
git commit -m "perf: lazy-load leaderboard and history data"
```

### Task 4: Defer player directory loading until owner search is used

**Files:**
- Modify: `/Users/zengze/Documents/New project/src/App.jsx`
- Test: `/Users/zengze/Documents/New project/src/utils/firstLoadPolicy.test.js`
- Test: `/Users/zengze/Documents/New project/src/utils/playerSearch.test.js`

**Step 1: Write the failing test**

Add a policy test:

```js
it('does not load player directory for non-owner or mine-only mode', () => {
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
```

**Step 2: Run test to verify it passes before React wiring**

Run: `npm test -- src/utils/firstLoadPolicy.test.js src/utils/playerSearch.test.js`
Expected: PASS.

**Step 3: Write minimal implementation**

In `src/App.jsx`:
- Remove `loadProfileDirectory()` from `onUserReady()`.
- Add state flags:
  - `profileDirectoryLoaded`
  - `profileDirectoryLoading`
- Trigger directory load only when:
  - in a room
  - current user is room owner
  - `showMineOnly === false`
  - add-player input is focused or has typed content
- Keep existing local suggestion behavior unchanged once the directory is loaded.
- Ensure repeated focus/blur does not trigger duplicate requests.

**Step 4: Run verification**

Run: `npm test`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/App.jsx src/utils/firstLoadPolicy.test.js src/utils/playerSearch.test.js
git commit -m "perf: defer player directory loading"
```

### Task 5: Remove redundant refreshes after room actions

**Files:**
- Modify: `/Users/zengze/Documents/New project/src/App.jsx`
- Test: `/Users/zengze/Documents/New project/src/utils/firstLoadPolicy.test.js`

**Step 1: Write the failing test**

Add a lightweight policy test for invalidation intent:

```js
import { deriveInvalidationPlan } from './firstLoadPolicy';

it('marks only room and open-room data dirty after add player', () => {
  expect(deriveInvalidationPlan('add-player')).toEqual({
    room: true,
    openRooms: true,
    leaderboard: false,
    history: false,
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/utils/firstLoadPolicy.test.js`
Expected: FAIL because `deriveInvalidationPlan` does not exist.

**Step 3: Write minimal implementation**

In `src/utils/firstLoadPolicy.js` add an invalidation helper for these actions:
- `add-player`
- `remove-player`
- `join-room`
- `create-room`
- `settle-room`

In `src/App.jsx` apply it to remove unnecessary unconditional refreshes, especially:
- avoid eager leaderboard/history reload after join/create
- reload leaderboard/history only if those tabs were already loaded or currently visible
- keep room/open-room data fresh where required

**Step 4: Run verification**

Run:
- `npm test`
- `npm run build`

Expected: both PASS.

**Step 5: Commit**

```bash
git add src/App.jsx src/utils/firstLoadPolicy.js src/utils/firstLoadPolicy.test.js
git commit -m "perf: tighten post-action data invalidation"
```

### Task 6: Manual performance verification and docs

**Files:**
- Modify: `/Users/zengze/Documents/New project/docs/CHANGELOG.md`
- Modify: `/Users/zengze/Documents/New project/docs/DEVELOPMENT.md`
- Modify: `/Users/zengze/Documents/New project/docs/ARCHITECTURE.md`

**Step 1: Run manual verification checklist**

Verify in browser:
- Login restore shows shell and current room before leaderboard/history data appears
- Without opening leaderboard/history tabs, those requests are not sent
- First entry into leaderboard shows localized loading state, then data
- First entry into history shows localized loading state, then data
- Owner search does not fetch `profiles` until search is used in “全部玩家” mode
- Refresh still preserves joined room state

**Step 2: Run final automated verification**

Run:
- `npm test`
- `npm run build`

Expected: both PASS.

**Step 3: Update docs**

Document:
- lazy-load startup flow
- deferred data sources
- invalidation strategy
- version/changelog entry

**Step 4: Commit**

```bash
git add docs/CHANGELOG.md docs/DEVELOPMENT.md docs/ARCHITECTURE.md
git commit -m "docs: document first-load performance changes"
```
