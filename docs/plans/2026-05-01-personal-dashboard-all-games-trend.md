# Personal Dashboard All-Games Trend Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Change the personal dashboard trend from recent 10 games to all filtered games, while keeping mobile chart density readable and adding lightweight UI motion.

**Architecture:** Keep aggregation logic in `src/utils/personalDashboard.js`; `App.jsx` only renders memoized rows. The trend chart remains lightweight DOM/CSS, with horizontal scrolling when game count exceeds the mobile viewport.

**Tech Stack:** React, Vite, Tailwind CSS, Vitest.

---

### Task 1: Update Trend Helper Behavior

**Files:**
- Modify: `src/utils/personalDashboard.js`
- Test: `src/utils/personalDashboard.test.js`

**Steps:**
1. Change the test to expect all rows by default, preserving ascending time order.
2. Run the specific test and verify it fails with the old 10-row limit.
3. Change `buildPersonalTrend()` so the default limit is unlimited, while preserving optional limit support for future callers.
4. Re-run the helper tests.

### Task 2: Update Personal Dashboard UI

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/index.css`

**Steps:**
1. Rename chart title from `近 10 局盈亏趋势` to `全部对局盈亏趋势`.
2. Reduce chart column width/gap for mobile so 8-10 bars are visible at once.
3. Add subtle entry animations for personal summary cards and trend bars.
4. Keep chart overflow horizontal only; avoid page-level horizontal overflow.

### Task 3: Verify

**Commands:**
- `npm test -- --run src/utils/personalDashboard.test.js`
- `npm test -- --run`
- `npm run build`

**Expected:** All tests and production build pass.
