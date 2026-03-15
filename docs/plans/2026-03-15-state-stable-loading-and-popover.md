# State-Stable Loading and Responsive Buy-In Popover Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Keep the room UI stable during refreshes, avoid unnecessary leaderboard/history reloads, defer all-player work until needed, and fix the mobile buy-in history popover layout.

**Architecture:** Extend the existing first-load strategy with lightweight freshness checks and stale-while-refreshing behavior. Keep current room and leaderboard/history state in place until new results arrive. Split popover placement into a responsive helper so mobile stays in-card and desktop keeps the side panel behavior.

**Tech Stack:** React, Vite, Supabase, Tailwind, custom CSS, Vitest.

---

### Task 1: Add failing tests for responsive buy-in popover placement

**Files:**
- Modify: `/Users/zengze/Documents/New project/src/utils/buyInPopover.test.js`
- Modify: `/Users/zengze/Documents/New project/src/utils/buyInPopover.js`

**Step 1: Write the failing test**
- Add a test for mobile placement returning an in-card downward popover class.
- Keep the existing desktop right-side placement assertion.

**Step 2: Run test to verify it fails**
Run:
```bash
npm test -- src/utils/buyInPopover.test.js
```
Expected: FAIL because mobile-specific placement helper does not exist yet.

**Step 3: Write minimal implementation**
- Update the helper to accept a mobile/desktop mode and return separate class names.

**Step 4: Run test to verify it passes**
Run:
```bash
npm test -- src/utils/buyInPopover.test.js
```
Expected: PASS.

**Step 5: Commit**
```bash
git add /Users/zengze/Documents/New\ project/src/utils/buyInPopover.js /Users/zengze/Documents/New\ project/src/utils/buyInPopover.test.js
git commit -m "test: cover responsive buy-in popover placement"
```

### Task 2: Add failing tests for freshness-gated reload policy

**Files:**
- Create: `/Users/zengze/Documents/New project/src/utils/refreshPolicy.js`
- Create: `/Users/zengze/Documents/New project/src/utils/refreshPolicy.test.js`

**Step 1: Write the failing test**
- Add tests for:
  - skipping leaderboard/history refresh when settled session counts are unchanged
  - refreshing when counts increase/decrease
  - not requiring all-player directory work until `showMineOnly === false`

**Step 2: Run test to verify it fails**
Run:
```bash
npm test -- src/utils/refreshPolicy.test.js
```
Expected: FAIL because helper does not exist.

**Step 3: Write minimal implementation**
- Implement pure helper functions for the new refresh decisions.

**Step 4: Run test to verify it passes**
Run:
```bash
npm test -- src/utils/refreshPolicy.test.js
```
Expected: PASS.

**Step 5: Commit**
```bash
git add /Users/zengze/Documents/New\ project/src/utils/refreshPolicy.js /Users/zengze/Documents/New\ project/src/utils/refreshPolicy.test.js
git commit -m "test: add refresh policy guards"
```

### Task 3: Keep current room state stable during refreshes

**Files:**
- Modify: `/Users/zengze/Documents/New project/src/App.jsx`

**Step 1: Write the failing test**
- Add a targeted logic/component test if practical, or extract a small helper to make stale-while-refreshing behavior testable.

**Step 2: Run test to verify it fails**
Run the targeted test command.
Expected: FAIL because refresh flow still clears room-adjacent state too early.

**Step 3: Write minimal implementation**
- Stop clearing visible room state during normal data refresh.
- Only clear room state on explicit room leave/logout/dissolve transitions.
- Preserve active tab and room card shell while refresh is pending.

**Step 4: Run test to verify it passes**
Run the targeted test command.
Expected: PASS.

**Step 5: Commit**
```bash
git add /Users/zengze/Documents/New\ project/src/App.jsx
git commit -m "perf: keep room state stable during refresh"
```

### Task 4: Gate leaderboard/history reloads by freshness signals

**Files:**
- Modify: `/Users/zengze/Documents/New project/src/App.jsx`
- Modify: `/Users/zengze/Documents/New project/src/utils/refreshPolicy.js`

**Step 1: Write the failing test**
- Add or extend tests around the refresh helper usage if needed.

**Step 2: Run test to verify it fails**
Run targeted tests.
Expected: FAIL because App still triggers unconditional refreshes.

**Step 3: Write minimal implementation**
- Store the last known settled-session counts for leaderboard/history scope.
- Skip refetch when counts are unchanged.
- Continue to force-refresh on explicit mutations that change result content.

**Step 4: Run test to verify it passes**
Run targeted tests.
Expected: PASS.

**Step 5: Commit**
```bash
git add /Users/zengze/Documents/New\ project/src/App.jsx /Users/zengze/Documents/New\ project/src/utils/refreshPolicy.js
git commit -m "perf: gate leaderboard and history refreshes"
```

### Task 5: Delay `全部玩家` work and fix responsive popover rendering

**Files:**
- Modify: `/Users/zengze/Documents/New project/src/App.jsx`
- Modify: `/Users/zengze/Documents/New project/src/index.css`
- Modify: `/Users/zengze/Documents/New project/src/utils/buyInPopover.js`

**Step 1: Write the failing test**
- Extend the placement tests if needed.
- Add any helper tests for deferred all-player loading decisions.

**Step 2: Run test to verify it fails**
Run targeted tests.
Expected: FAIL because mobile popover still renders sideward and all-player path is still eager.

**Step 3: Write minimal implementation**
- Restrict owner/player-directory fetches to the `全部玩家` view.
- Render buy-in history popover below the buy-in summary row on mobile.
- Keep desktop side placement.

**Step 4: Run test to verify it passes**
Run targeted tests.
Expected: PASS.

**Step 5: Commit**
```bash
git add /Users/zengze/Documents/New\ project/src/App.jsx /Users/zengze/Documents/New\ project/src/index.css /Users/zengze/Documents/New\ project/src/utils/buyInPopover.js
git commit -m "fix: adapt buy-in history popover for mobile"
```

### Task 6: Verification, docs, and Vercel deploy

**Files:**
- Modify as needed: `/Users/zengze/Documents/New project/README.md`
- Modify as needed: `/Users/zengze/Documents/New project/docs/CHANGELOG.md`

**Step 1: Run full tests**
Run:
```bash
npm test
```
Expected: all tests pass.

**Step 2: Run production build**
Run:
```bash
npm run build
```
Expected: build succeeds.

**Step 3: Manual verification**
- Join a room and confirm the room UI does not flash back to the landing state during refresh.
- Switch to `全部玩家` and confirm player-directory work only begins there.
- Open the buy-in popover on mobile width and verify it expands downward inside the card.
- Verify leaderboard/history do not refetch if settled session count is unchanged.

**Step 4: Update docs/release notes**
- Record the new stale-while-refreshing and popover behavior.

**Step 5: Deploy**
- Push to GitHub and deploy production to Vercel only.

