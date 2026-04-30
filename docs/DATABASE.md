# 数据库文档（Supabase, v2.3.1）

## 1. 初始化

在 Supabase SQL Editor 执行：

- [`supabase_schema.sql`](/Users/zengze/Documents/New%20project/supabase_schema.sql)

如历史版本较旧，建议整份脚本重新执行一次（脚本为幂等）。

## 2. 表说明

1. `profiles`
- `id uuid` -> 关联 `auth.users.id`
- `nickname text` -> 昵称（大小写不敏感唯一）
- `total_games int` -> 累计总场次（触发器维护）
- `winning_games int` -> 盈利场次（`net_result > 0`，触发器维护）

2. `sessions`
- `id text` -> 房间号
- `status text` -> `active` / `settled`
- `owner_id uuid` -> 房主
- `rmb_per_2000 numeric(12,2)` -> 2000 积分对应人民币

3. `room_players`
- 当前房间实时玩家状态
- 主键：`(room_id, player_id)`
- 字段：`buy_in`, `final_chips`, `updated_at`

4. `session_players`
- 结算后的快照数据
- 字段：`buy_in`, `final_chips`, `net_result`

5. `transfers`
- 结算后转账建议明细
- 字段：`from_player_id`, `to_player_id`, `amount`

6. `buy_in_events`
- 玩家每次点击“确认”后的买入事件日志
- 字段：`room_id`, `player_id`, `created_by`, `amount`, `created_at`
- 用途：在玩家卡片中展示“累计总买入”的历史明细

## 3. 索引

- `idx_room_players_room_id`
- `idx_session_players_player_id`
- `idx_transfers_session_id`
- `idx_sessions_owner_id`
- `idx_profiles_nickname_ci_unique`
- `idx_buy_in_events_room_player_created_at`

## 4. RLS 与函数

已启用 RLS 的表：
- `profiles`
- `sessions`
- `room_players`
- `session_players`
- `transfers`
- `buy_in_events`

关键函数：
- `nickname_exists(text)`
- `resolve_login_emails(text)`
- `is_room_member(text)`
- `is_room_owner(text)`
- `can_settle_room(text)`
- `buy_in_events` 只允许房间成员读取，只允许本人或房主插入

`v2.1.7` 说明：

- 新增 `buy_in_events` 表，用于记录每次确认后的买入积分变动
- 用于“累计总买入”右侧信息弹窗展示按时间顺序的买入记录

`v2.1.5` 关键策略调整：
- `room_players` 写策略已升级为 `own_or_owner`
  - 玩家可写自己
  - 房主可写房间内所有玩家（用于添加/移除/修正）

## 5. Realtime 开关

在 Supabase Realtime 页面启用：
- `room_players`
- `sessions`
- `transfers`

## 6. 清理数据（生产前重置）

执行：
- [`clear_all_data.sql`](/Users/zengze/Documents/New%20project/clear_all_data.sql)

注意：该脚本会清空业务数据，仅保留结构与策略。

## 7. 常见数据库错误

1. `owner_id does not exist`
- 原因：schema 不是最新版
- 处理：重新执行 `supabase_schema.sql`

2. `rmb_per_2000 does not exist`
- 原因：schema 未升级
- 处理：重新执行 `supabase_schema.sql`

3. `duplicate key ... idx_profiles_nickname_ci_unique`
- 原因：昵称重复（忽略大小写）
- 处理：更换昵称，或清理重复数据后重试

4. 房主添加玩家时报 RLS 拒绝
- 原因：未应用 v2.1.5 `room_players insert own_or_owner` 策略
- 处理：重新执行 `supabase_schema.sql`（推荐）或执行最小热修复 SQL：

```sql
drop policy if exists "room players insert own" on public.room_players;
drop policy if exists "room players insert own_or_owner" on public.room_players;
create policy "room players insert own_or_owner" on public.room_players
on public.room_players
for insert
to authenticated
with check (auth.uid() = player_id or public.is_room_owner(room_id));
```
