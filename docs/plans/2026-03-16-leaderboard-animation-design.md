# Leaderboard Animation Design

## Goal
在不改变积分榜数据和排序稳定性的前提下，为积分榜增加轻量动画效果，并移除胜率 benchmark。

## Scope
- 移除积分榜顶部 `胜率` benchmark 按钮
- 移除积分榜展开详情中的胜率展示模块
- 保留底层 `winRate` 聚合字段，避免影响其他统计路径
- 给积分榜卡片增加轻量淡入上浮动画
- 给排序切换按钮保留平滑过渡，不引入位移动画和复杂重排

## Approach
1. 维持现有 `leaderboardRenderKey` 触发的重挂载机制
2. 在积分榜卡片上增加 CSS 级别的 `opacity + translateY` 进入动画
3. 不做列表位移动画，避免 iPhone Safari 的合成层残影问题
4. 展开详情里删除 `WinRateRing` 模块，减少渲染复杂度

## Risk Control
- 不改 `aggregateLeaderboardRows()` 的字段结构
- 不删除 `winRate` 数据字段，减少兼容性风险
- 动画仅作用于积分榜卡片 DOM 层
