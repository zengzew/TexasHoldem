# Personal Trend Chart Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Optimize the personal dashboard recent-10-game chart so each game’s win/loss is visually readable without showing an x-axis.

**Architecture:** Keep the existing lightweight DOM chart in `src/App.jsx`; do not introduce a chart library. Render positive/negative bars around a subtle zero baseline, show compact value labels on each bar, hide coordinate labels, and keep existing glass tooltip details.

**Tech Stack:** React, Tailwind CSS classes, existing helper functions (`toChips`, `toRmb`, `formatDateTime`).

---

### Task 1: Update Chart Markup

**Files:**
- Modify: `src/App.jsx`

**Step 1:** Locate the `近 10 局盈亏趋势` block in the personal dashboard panel.

**Step 2:** Replace the current bottom ordinal label with per-bar profit labels.

**Step 3:** Keep tooltip content and accessibility labels, but do not show x-axis labels.

**Step 4:** Make positive bars extend upward from center and negative bars extend downward from center.

### Task 2: Preserve Mobile Layout

**Files:**
- Modify: `src/App.jsx`

**Step 1:** Keep fixed chart height and compact gaps.

**Step 2:** Use small tabular numeric labels that do not wrap.

**Step 3:** Ensure zero values render as a neutral short line with `0` label.

### Task 3: Verify

**Commands:**
- `npm test -- --run`
- `npm run build`

**Expected:** All tests pass and production build succeeds.
