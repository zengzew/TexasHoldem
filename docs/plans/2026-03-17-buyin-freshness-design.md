# Buy-In Event Bootstrap And Freshness Guard Design

## Goal
让默认 2000 积分买入成为真实事件记录，并把积分榜/历史记录刷新进一步收紧到真正必要的条件。

## Scope
- 创建房间、加入房间、房主添加玩家时，默认 `+2000` 买入写入 `buy_in_events`
- 积分榜仅在“已结算总局数”变化时刷新
- 历史记录仅在“历史签名”变化时刷新
- 不对旧数据做 migration

## Approach
1. 继续保留 `room_players.buy_in = 2000` 作为当前房间即时状态
2. 同步插入一条 `buy_in_events` 记录，确保买入记录弹窗与累计买入一致
3. 新增更明确的 freshness 元信息：
   - leaderboard freshness: settled session count
   - history freshness: participated session count + settled participated count + latest participant-facing update marker
4. 收紧 `refreshLazyDatasets()` 中各数据集的 guard 条件，避免普通房间交互触发历史/积分榜无意义请求

## Risk Control
- 默认买入事件只在创建/加入/添加玩家的初始化路径写入一次
- 失败时不阻断主流程，但保留 notice，避免影响房间加入成功率
- 不改变旧数据展示协议，旧房间历史记录里不会自动补初始 2000 事件
