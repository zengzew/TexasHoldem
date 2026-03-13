# First-Load Performance Design

**Date:** 2026-03-13
**Scope:** 首屏加载性能优化，仅聚焦“页面壳 + 当前房间优先渲染”，不改变现有业务规则。

## Goal

让用户在登录恢复后优先看到页面壳和当前房间内容，积分榜、历史记录和玩家搜索目录延后加载，从而明显改善首屏体感速度，尤其是手机端。

## Current Problems

1. `src/App.jsx` 在 `onUserReady()` 中串行/重复触发过多数据请求：
   - `ensureProfile()`
   - `loadProfileDirectory()`
   - `loadOpenRooms()`
   - `joinExistingRoom()`（内部又会继续请求）
   - `loadLeaderboard()`
   - `loadHistorySessions()`
   - `loadGlobalStats()`
2. 当前房间并不是唯一首屏关键内容，但积分榜和历史记录的数据与聚合计算也在首屏阶段执行。
3. `joinExistingRoom()`、`createRoom()`、`settleSession()` 等路径存在重复的全局刷新，增加首屏和交互时的额外开销。
4. 玩家搜索目录 `profiles` 在首屏提前加载，但只有房主在“全部玩家”视图下才会使用。

## Performance Strategy

### Option A: Data Lazy Load First (Recommended)

仅保留当前房间相关能力作为首屏阻塞项：
- 恢复认证状态
- 恢复持久房间 ID
- 加载当前房间玩家、换算、转账建议
- 如果没有持久房间，则只加载未结算房间列表

以下模块延后到首次需要时加载：
- 历史积分榜数据
- 历史记录数据
- 玩家搜索目录
- 非必要统计信息

**Why this is recommended:**
- 改动集中在加载时机，不需要重写业务逻辑
- 收益最大，风险最小
- 与当前 Tab 结构天然匹配

### Option B: Keep Full Initial Load, Only Remove Duplicates

保留首屏完整加载，但把请求并发化并去重。

**Trade-off:**
- 改动小
- 体感收益有限，因为非当前 Tab 数据仍然占用首屏预算

### Option C: Lazy Data + Lazy Components

在 Option A 的基础上，再把积分榜/历史记录区域拆成组件级懒加载。

**Trade-off:**
- JS 体积和首屏执行量会继续下降
- 需要更细的 loading/skeleton 处理
- 可作为第二阶段，不应与第一阶段耦合在一起上线

## Approved Architecture

采用 **Option A**，并预留 Option C 的演进空间。

### Bootstrap Flow

1. `bootstrap()` 只负责恢复 auth session，不做业务数据请求。
2. `onUserReady()` 只负责首屏关键链路：
   - `ensureProfile(user)`
   - 恢复持久房间状态
   - 如果有持久房间：进入房间并加载房间数据
   - 如果没有持久房间：只加载开放房间列表
3. 历史积分榜、历史记录、玩家搜索目录不再在 `onUserReady()` 中直接拉取。

### Lazy Data Triggers

- 首次进入 `积分榜` Tab 时：触发 `loadLeaderboard()`
- 首次进入 `历史记录` Tab 时：触发 `loadHistorySessions()`
- 首次满足“房主 + 全部玩家”条件并聚焦搜索输入时：触发 `loadProfileDirectory()`

### Optional Background Prefetch

当首屏关键内容完成后，可以在空闲时段做低优先级预取：
- `requestIdleCallback(loadLeaderboard)`
- `requestIdleCallback(loadHistorySessions)`

该能力必须是“可取消/可重复安全”的，不得影响首屏渲染。

## State Model Changes

新增按需加载状态：
- `leaderboardLoaded`
- `leaderboardLoading`
- `historyLoaded`
- `historyLoading`
- `profileDirectoryLoaded`
- `profileDirectoryLoading`

约束：
- 已加载过的数据在同一 session 内不重复加载，除非显式刷新或相关写操作要求失效。
- Room/settlement/add-player/remove-player 等会影响关联数据的操作，需要精确失效对应模块，而不是全量刷新所有模块。

## UI / UX Requirements

1. 首屏优先看到完整 header、当前房间面板和未结算房间入口。
2. 首次切到积分榜/历史记录时显示局部 loading，不阻塞其他区域。
3. 不改变默认 Tab、默认日期范围、现有排序规则和现有业务提示文案。
4. 不引入新的闪烁或骨架屏抖动。

## Data Invalidation Rules

- `joinExistingRoom()` / `createRoom()`：
  - 必须刷新当前房间和开放房间列表
  - 不立即刷新积分榜和历史记录，除非用户已在对应 Tab 且可见
- `settleSession()`：
  - 当前房间、历史记录、积分榜都失效
  - 若对应 Tab 已访问过，则后台刷新；否则保留未加载状态
- `addPlayerToRoom()` / `removePlayerFromRoom()`：
  - 当前房间失效
  - 开放房间人数失效
  - 搜索目录无需重新全量拉取

## Testing Strategy

### Unit-Level

新增纯函数/状态守卫测试，覆盖：
- 首屏仅触发关键数据加载
- 首次切换到 `leaderboard` / `history` 才触发对应加载函数
- 重复切换 Tab 不重复发起相同加载
- 相关业务操作后只失效需要的数据块

### Manual Verification

1. 登录后直接进入页面：优先显示 header + 当前房间面板
2. 未点击积分榜/历史记录前，不应发起对应请求
3. 首次点击积分榜/历史记录时，才出现对应请求与局部 loading
4. 刷新页面后，持久房间状态保留
5. 房主进入“全部玩家”之前，不应提前请求搜索目录

## Non-Goals

本轮不做：
- 大规模组件拆分
- Server-side rendering
- Virtual list
- Realtime 策略重构
- 数据库 schema 变更

## Rollout

Phase 1:
- 实现数据懒加载与请求去重
- 保持现有 UI 基本不变

Phase 2 (optional):
- 对积分榜/历史记录做组件级懒加载
- 进一步降低 bundle 和初始执行成本
