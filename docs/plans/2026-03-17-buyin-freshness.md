# Buy-In Event Bootstrap And Freshness Guard Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 把默认 2000 积分写成真实买入事件，并进一步收紧积分榜/历史记录刷新条件。

**Architecture:** 维持现有房间状态字段不变，在默认买入初始化路径补写 `buy_in_events`。同时把 freshness 判定从宽泛的页面级刷新收紧到 leaderboard 的 settled count 和 history 的 participant-facing signature。

**Tech Stack:** React, Supabase, Vitest

---

### Task 1: Add tests for default buy-in event bootstrap

**Files:**
- Modify: `src/utils/buyInHistory.test.js`
- Modify: `src/App.jsx`

**Step 1: Write the failing test**
- 补一个最小 helper 级测试，验证默认买入初始化 payload 为 `+2000`
- 补 UI/path 级测试覆盖创建/加入/添加玩家路径调用默认事件写入 helper

**Step 2: Run test to verify it fails**
Run: `npm test -- src/utils/buyInHistory.test.js`
Expected: FAIL because helper/path not implemented for bootstrap flow.

**Step 3: Write minimal implementation**
- 增加 bootstrap buy-in event helper
- 在创建房间、加入房间、房主添加玩家路径中调用

**Step 4: Run test to verify it passes**
Run: `npm test -- src/utils/buyInHistory.test.js`
Expected: PASS

### Task 2: Tighten freshness guards

**Files:**
- Modify: `src/utils/firstLoadPolicy.js`
- Modify: `src/utils/firstLoadPolicy.test.js`
- Modify: `src/App.jsx`

**Step 1: Write the failing test**
- leaderboard 只在 settled count 变化时刷新
- history 只在 history signature 变化时刷新

**Step 2: Run test to verify it fails**
Run: `npm test -- src/utils/firstLoadPolicy.test.js`
Expected: FAIL because current guard is broader.

**Step 3: Write minimal implementation**
- 调整 freshness metadata 和 guard comparison
- App 中仅把必要的 freshness 字段传入 refresh planner

**Step 4: Run test to verify it passes**
Run: `npm test -- src/utils/firstLoadPolicy.test.js`
Expected: PASS

### Task 3: Full verification

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/utils/buyInHistory.js`
- Modify: `src/utils/buyInHistory.test.js`
- Modify: `src/utils/firstLoadPolicy.js`
- Modify: `src/utils/firstLoadPolicy.test.js`

**Step 1: Run targeted tests**
Run: `npm test -- src/utils/buyInHistory.test.js src/utils/firstLoadPolicy.test.js`
Expected: PASS

**Step 2: Run full test suite**
Run: `npm test`
Expected: PASS

**Step 3: Run production build**
Run: `npm run build`
Expected: PASS
