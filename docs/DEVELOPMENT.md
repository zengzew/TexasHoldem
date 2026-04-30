# 开发文档（v2.3.1）

## 架构概览

- 前端单页应用：`src/App.jsx`
- 数据源：Supabase Postgres + Realtime 订阅
- 认证：Supabase Auth（昵称映射到 `u_xxx@holdem.local`）
- 核心实体：
  - `profiles`：用户昵称
  - `sessions`：房间与状态（`active/settled`）
  - `room_players`：当前房间实时玩家数据
  - `session_players`：结算后快照
  - `transfers`：转账建议结果

## 关键业务规则

1. 第一个进入房间的玩家为房主
2. 房主可修改任意玩家的买入/最终积分并结算
3. 房主可在未结算房间中添加/移除玩家（房主自身不可移除）
4. 玩家“确定”提交带 loading + 防重复写入
5. 刷新后自动恢复上次已加入房间（失效房间自动清理）
6. 场均指标按“场均盈利金额（RMB）”排序
7. 结算时必须满足总净输赢为 0
8. 已结算房间不可再次加入
9. 历史记录分页默认每页 5 条
10. 积分榜统计全量历史对局；个人看板与历史记录仅显示当前用户参与过的对局
11. 积分榜日期筛选默认为当年 1 月 1 日到当天

## 前端状态与模块

- 认证区：登录/注册、昵称修改、密码修改
- 当前房间：
  - 玩家视图切换（仅看我/全部玩家）
  - 房主玩家管理（添加/移除玩家）
  - 买入与最终积分录入
  - 提交确认（loading + 防重复）
  - 结算与转账建议
- 历史记录：
  - 列表分页
  - 对局详情展开（玩家结果 + 转账明细）
- 个人看板：
  - 仅聚合当前用户参与过的已结算对局
  - 展示总局数、盈利场次、总买入、净盈利、金额与场均指标
  - 展示近 10 局盈亏柱状趋势
- 积分榜：
  - 五种排序维度（净盈利 / 场均盈利 / 金额 / 场均金额 / 盈利场次）
  - 展开详情显示最大单局盈利、最大单局亏损
  - 弹出式日期范围筛选
  - Top 显示与展开更多

## 首屏加载原则

1. 用户登录后先恢复当前房间，再渲染房间内容
2. 非当前 Tab 数据不得阻塞首屏
3. 个人看板 / 积分榜 / 历史记录采用“首次访问加载，后续按需失效刷新”
4. 房主玩家搜索目录只在真正搜索时加载
5. Realtime 变更只刷新当前需要的数据集，避免全量连锁刷新

## 样式规范

- 玻璃拟态视觉：`glass-card / segmented-shell`
- 交互主按钮：渐变 `btn-primary`
- 次按钮：浅色玻璃 `btn-secondary`
- 输入交互：统一 16px 字号（移动端防自动放大）

## 数据库迁移与初始化

1. 执行 `supabase_schema.sql`
2. 打开 Realtime：`room_players / sessions / transfers`
3. 校验 RLS 与函数是否创建成功：
   - `nickname_exists`
   - `resolve_login_emails`
   - `is_room_member / is_room_owner / can_settle_room`

## 本地开发流程

```bash
npm install
cp .env.example .env
npm run dev
```

测试与构建：

```bash
npm test
npm run build
```

## 发布流程（Vercel）

```bash
npx vercel --prod --yes
```

上线前检查：

1. `.env` 与 Vercel env 一致
2. `npm test` 通过
3. `npm run build` 通过
4. Supabase schema 已为最新版本

## 常见问题

- 登录提示“该用户尚未注册”
  - 确认 `profiles` 中是否存在该昵称
- 登录提示“密码输入错误”
  - 检查密码是否更新成功（兼容历史短密码策略）
- 房间/历史不同步
  - 检查 Realtime 是否启用目标表
- owner_id / rmb_per_2000 字段错误
  - 重新执行最新 `supabase_schema.sql`
