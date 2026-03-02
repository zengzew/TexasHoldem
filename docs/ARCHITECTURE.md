# 系统架构（v2.1.1）

## 1. 总体架构

- 前端：React SPA（`src/App.jsx`）
- 数据层：Supabase Postgres
- 实时层：Supabase Realtime（房间玩家与对局变更）
- 认证层：Supabase Auth（昵称映射本地邮箱）
- 部署：Vercel（静态构建 + CDN）

## 2. 核心模块

1. 认证模块
- 注册：昵称 + 密码
- 登录：昵称映射邮箱后调用 `signInWithPassword`
- 账号设置：昵称/密码修改（右上角账户 Popover）

2. 房间模块
- 创建房间、加入房间、切换房间、解散房间
- 第一个进入房间者为房主（`sessions.owner_id`）
- 房主可修改所有玩家买入/最终积分和积分换算并结算

3. 结算模块
- 录入买入与最终积分
- 支持负数买入冲正（用于误确认纠错）
- 累计总买入下限为 0（不会出现负值）
- 结算前校验：总净输赢为 0
- 产出转账建议并写入 `transfers`

4. 历史模块
- 历史记录分页 + 对局详情展开
- 历史积分榜（净盈利 / ROI / 场均盈利 / 金额 / 胜率）
- 积分榜支持弹出式日期范围筛选（默认当年 1 月 1 日到今天）

## 3. 数据流（简）

1. 登录成功后加载：
- `profiles`（当前用户昵称）
- `sessions` / `room_players`（房间与成员）
- `session_players` / `transfers`（历史与榜单）
- 加载策略：
  - 历史积分榜：读取全量 `session_players`
  - 历史记录：仅读取当前用户参与过的对局

2. 进入房间后订阅：
- `room_players` 变化 -> 刷新当前房间
- `sessions` 变化 -> 刷新房间状态/历史/榜单
- `transfers` 变化 -> 刷新转账建议

3. 结算流程：
- 前端校验与计算
- 写入 `session_players` + `transfers`
- 更新 `sessions.status = settled`
- Realtime 通知所有在线成员刷新

## 4. 权限模型

- 业务权限：房主逻辑（前端提示 + 后端函数/RLS兜底）
- 数据权限：RLS 策略控制读写范围
- 函数辅助：
  - `is_room_member`
  - `is_room_owner`
  - `can_settle_room`
  - `nickname_exists`
  - `resolve_login_emails`

## 5. 兼容性策略

- 输入控件统一 16px，避免 iOS Safari 自动放大
- 使用 `svh/vh` 组合与 `box-sizing` 统一，缓解 Safari/Edge 高度差异
- 分页器改为 panel 内布局，避免 fixed 遮挡详情内容
