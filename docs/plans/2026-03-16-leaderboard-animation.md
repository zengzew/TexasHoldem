# Leaderboard Animation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为积分榜增加轻量动画效果，并移除胜率 benchmark，同时保持现有排序和数据逻辑稳定。

**Architecture:** 仅修改积分榜展示层和相关测试。通过现有 `leaderboardRenderKey` 触发卡片重挂载，再用轻量 CSS keyframes 实现淡入上浮动画。数据聚合层保留 `winRate` 字段，不作为当前 UI 的可选 benchmark。

**Tech Stack:** React, Vite, Tailwind CSS, project-level CSS, Vitest

---

### Task 1: Update tests for removed benchmark

**Files:**
- Modify: `src/utils/leaderboardMetric.test.js`
- Modify: `src/utils/analytics.test.js`
- Modify: `src/App.jsx`

**Step 1: Write the failing test**
- Add/adjust assertions so the visible benchmark set no longer includes `胜率`.
- Remove test dependence on `winRate` as a selectable UI metric.

**Step 2: Run test to verify it fails**
Run: `npm test -- src/utils/leaderboardMetric.test.js src/utils/analytics.test.js`
Expected: FAIL because implementation still exposes `胜率` benchmark in the UI path.

**Step 3: Write minimal implementation**
- Remove the `胜率` button from the leaderboard view selector.
- Remove the expanded `WinRateRing` block from leaderboard detail cards.

**Step 4: Run test to verify it passes**
Run: `npm test -- src/utils/leaderboardMetric.test.js src/utils/analytics.test.js`
Expected: PASS

### Task 2: Add lightweight leaderboard animation

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/index.css`

**Step 1: Write the failing test**
- Add a UI-level assertion for a leaderboard animation class on rendered leaderboard cards.

**Step 2: Run test to verify it fails**
Run: `npm test -- src/App.jsx`
Expected: FAIL because cards do not yet have the animation class.

**Step 3: Write minimal implementation**
- Add a leaderboard card animation class in `src/index.css`
- Apply the class to leaderboard cards in `src/App.jsx`
- Keep the animation to `opacity + translateY` only

**Step 4: Run test to verify it passes**
Run: `npm test -- src/App.jsx`
Expected: PASS

### Task 3: Full verification

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/index.css`
- Modify: `src/utils/leaderboardMetric.test.js`
- Modify: `src/utils/analytics.test.js`

**Step 1: Run targeted tests**
Run: `npm test -- src/utils/leaderboardMetric.test.js src/utils/analytics.test.js`
Expected: PASS

**Step 2: Run full test suite**
Run: `npm test`
Expected: PASS

**Step 3: Run production build**
Run: `npm run build`
Expected: PASS
