# 数据库文档（Supabase）

## 1. 初始化

在 Supabase SQL Editor 执行：

- [`supabase_schema.sql`](/Users/zengze/Documents/New%20project/supabase_schema.sql)

如历史版本较旧，建议整份脚本重新执行一次（脚本为幂等）。

## 2. 表说明

1. `profiles`
- `id uuid` -> 关联 `auth.users.id`
- `nickname text` -> 昵称（大小写不敏感唯一）

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

## 3. 索引

- `idx_room_players_room_id`
- `idx_session_players_player_id`
- `idx_transfers_session_id`
- `idx_sessions_owner_id`
- `idx_profiles_nickname_ci_unique`

## 4. RLS 与函数

已启用 RLS 的表：
- `profiles`
- `sessions`
- `room_players`
- `session_players`
- `transfers`

关键函数：
- `nickname_exists(text)`
- `resolve_login_emails(text)`
- `is_room_member(text)`
- `is_room_owner(text)`
- `can_settle_room(text)`

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
