# Buy-In History Popover and Background Motion Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add subtle background motion, remove the background grid, record confirmed buy-in events, and surface them through a glass popover beside each player's cumulative buy-in.

**Architecture:** Keep current room and settlement aggregates unchanged. Introduce a dedicated buy-in-events table for append-only event history, then lazily fetch per-player history into a lightweight popover on demand. Reuse the existing glass visual system and close-on-outside-click behavior.

**Tech Stack:** React, Vite, Supabase, Tailwind utility classes, custom CSS, Vitest.

---

### Task 1: Add buy-in event schema

**Files:**
- Modify: `/Users/zengze/Documents/New project/supabase_schema.sql`
- Modify: `/Users/zengze/Documents/New project/scripts/cleanup.sql`
- Modify: `/Users/zengze/Documents/New project/docs/DATABASE.md`

**Step 1: Write the failing test**
- Add or extend a lightweight SQL-related behavior test only if the project already has schema-focused tests. Otherwise document the manual verification command in this plan and rely on runtime tests for the event flow.

**Step 2: Run test to verify it fails**
- If adding a JS runtime test around the Supabase query contract, run that targeted test and confirm it fails because `buy_in_events` is missing from mocked responses.

**Step 3: Write minimal implementation**
- Add `public.buy_in_events` table.
- Add indexes and RLS policies.
- Extend cleanup SQL to truncate/delete `buy_in_events` before player/session cleanup.
- Update DB docs.

**Step 4: Run verification**
Run:
```bash
rg -n "buy_in_events" /Users/zengze/Documents/New\ project/supabase_schema.sql /Users/zengze/Documents/New\ project/scripts/cleanup.sql /Users/zengze/Documents/New\ project/docs/DATABASE.md
```
Expected: references exist in all three files.

**Step 5: Commit**
```bash
git add /Users/zengze/Documents/New\ project/supabase_schema.sql /Users/zengze/Documents/New\ project/scripts/cleanup.sql /Users/zengze/Documents/New\ project/docs/DATABASE.md
git commit -m "feat: add buy-in event schema"
```

### Task 2: Add failing tests for buy-in event UI behavior

**Files:**
- Modify: `/Users/zengze/Documents/New project/src/utils/game.test.js`
- Modify: `/Users/zengze/Documents/New project/src/App.jsx` (later)
- Optionally create: `/Users/zengze/Documents/New project/src/utils/buyInHistory.js`
- Test: `/Users/zengze/Documents/New project/src/utils/buyInHistory.test.js`

**Step 1: Write the failing test**
- Add tests for chronological sorting, `HH:mm` formatting, and signed amount formatting.
- Add a test for confirm-buy-in flow causing event creation payload generation.

**Step 2: Run test to verify it fails**
Run:
```bash
npm test -- src/utils/buyInHistory.test.js src/utils/game.test.js
```
Expected: FAIL because helper / event behavior does not exist yet.

**Step 3: Write minimal implementation**
- Add helper(s) to format event rows and normalize order.
- Keep logic small and pure for reuse in UI.

**Step 4: Run test to verify it passes**
Run:
```bash
npm test -- src/utils/buyInHistory.test.js src/utils/game.test.js
```
Expected: PASS.

**Step 5: Commit**
```bash
git add /Users/zengze/Documents/New\ project/src/utils/buyInHistory.js /Users/zengze/Documents/New\ project/src/utils/buyInHistory.test.js /Users/zengze/Documents/New\ project/src/utils/game.test.js
git commit -m "test: cover buy-in history formatting"
```

### Task 3: Wire buy-in event writes into confirm-buy-in

**Files:**
- Modify: `/Users/zengze/Documents/New project/src/App.jsx`
- Optionally modify: `/Users/zengze/Documents/New project/src/supabase.js`

**Step 1: Write the failing test**
- Add a targeted component or logic test asserting confirm-buy-in updates cumulative totals and issues a buy-in event insert.

**Step 2: Run test to verify it fails**
Run the smallest matching test command.
Expected: FAIL because insert call is missing.

**Step 3: Write minimal implementation**
- Insert a `buy_in_events` row after successful buy-in confirmation.
- Preserve current optimistic update / loading semantics.
- Do not fetch history on room load.

**Step 4: Run test to verify it passes**
Run the same targeted test.
Expected: PASS.

**Step 5: Commit**
```bash
git add /Users/zengze/Documents/New\ project/src/App.jsx /Users/zengze/Documents/New\ project/src/supabase.js
git commit -m "feat: persist buy-in history events"
```

### Task 4: Add the info trigger and popover UI

**Files:**
- Modify: `/Users/zengze/Documents/New project/src/App.jsx`
- Modify: `/Users/zengze/Documents/New project/src/index.css`
- Optionally add asset: `/Users/zengze/Documents/New project/src/assets/info-circle.svg`

**Step 1: Write the failing test**
- Add UI tests asserting the info trigger renders next to cumulative buy-in and clicking it shows event rows or empty state.

**Step 2: Run test to verify it fails**
Run targeted test.
Expected: FAIL because trigger/popover is absent.

**Step 3: Write minimal implementation**
- Add `i` trigger next to cumulative buy-in.
- Add a lazily-loaded popover using the same glass system as account/date popovers.
- Cache room/player event data.
- Show `HH:mm` and signed amount rows.

**Step 4: Run test to verify it passes**
Run targeted test.
Expected: PASS.

**Step 5: Commit**
```bash
git add /Users/zengze/Documents/New\ project/src/App.jsx /Users/zengze/Documents/New\ project/src/index.css /Users/zengze/Documents/New\ project/src/assets/info-circle.svg
git commit -m "feat: add buy-in history popover"
```

### Task 5: Refresh the background and helper copy

**Files:**
- Modify: `/Users/zengze/Documents/New project/src/index.css`
- Modify: `/Users/zengze/Documents/New project/src/App.jsx`
- Modify: `/Users/zengze/Documents/New project/README.md`
- Modify: `/Users/zengze/Documents/New project/docs/CHANGELOG.md`

**Step 1: Write the failing test**
- Add or update a minimal UI assertion for the helper copy text.
- If no CSS test exists, capture behavior via a class presence assertion or document this as a visual verification step.

**Step 2: Run test to verify it fails**
Run targeted test.
Expected: FAIL because old copy remains.

**Step 3: Write minimal implementation**
- Remove grid background layer.
- Add subtle motion to existing background layers.
- Update helper copy text.
- Keep visual changes scoped.

**Step 4: Run test to verify it passes**
Run targeted test.
Expected: PASS.

**Step 5: Commit**
```bash
git add /Users/zengze/Documents/New\ project/src/index.css /Users/zengze/Documents/New\ project/src/App.jsx /Users/zengze/Documents/New\ project/README.md /Users/zengze/Documents/New\ project/docs/CHANGELOG.md
git commit -m "feat: refresh background and owner copy"
```

### Task 6: Full verification and deployment

**Files:**
- Modify if needed: `/Users/zengze/Documents/New project/docs/DEPLOYMENT.md`

**Step 1: Run the full test suite**
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
- Open current room.
- Confirm multiple positive/negative buy-ins.
- Open the info popover and verify chronological `HH:mm` rows.
- Verify outside-click close.
- Verify background no longer shows a grid and motion is subtle.

**Step 4: Update docs if deployment details changed**
- Add release note and any schema/deploy caveat.

**Step 5: Deploy**
Run Vercel production deploy and Cloudflare Pages deploy for the current `master` head.

**Step 6: Commit docs if changed**
```bash
git add /Users/zengze/Documents/New\ project/docs/DEPLOYMENT.md /Users/zengze/Documents/New\ project/docs/CHANGELOG.md /Users/zengze/Documents/New\ project/README.md
git commit -m "docs: record buy-in history release"
```
