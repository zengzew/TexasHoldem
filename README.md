# TEXAS HOLD'EM SCORE v2.1.0

React + Supabase 的德州扑克聚会积分系统（Web）。

## 1. 功能总览

- 昵称 + 密码注册/登录（不依赖真实邮箱）
- 房间创建/加入/切换/解散（房主权限）
- 房间实时同步（Supabase Realtime）
- 买入与最终积分录入，结算与转账建议
- 买入支持负数冲正（用于误确认纠错），累计总买入下限为 0
- 历史记录（分页、可展开详情）
- 历史积分榜（净盈利 / ROI / 场均盈利 / 金额 / 胜率）
- 日期范围筛选（积分榜弹出式 Date Picker，默认当年 1 月 1 日到今天）
- 积分换算（2000 积分 = X RMB）
- 移动端优化与玻璃拟态 UI
- 品牌副标题常量化：`欢迎来到 永和阳光苑`
- 历史积分榜统计全量历史对局；历史记录仅显示当前用户参与过的对局

## 2. 技术栈

- `React 18`
- `Vite 4`
- `Tailwind CSS 3` + 自定义组件样式
- `Supabase (Auth + Postgres + Realtime + RLS)`
- `Vitest`

## 3. 环境要求

- `Node.js v24.13.0`（推荐与你当前环境一致）
- `npm >= 10`

## 4. 本地启动

```bash
npm install
cp .env.example .env
# 填写 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
npm run dev
```

访问：`http://localhost:5173`

## 5. Supabase 初始化

1. 创建 Supabase Project
2. 在 SQL Editor 执行：
   - [`supabase_schema.sql`](/Users/zengze/Documents/New%20project/supabase_schema.sql)
3. Authentication 中启用 Email/Password
   - 建议关闭 `Confirm email`，便于昵称映射邮箱登录
4. Realtime 中启用表：
   - `room_players`
   - `sessions`
   - `transfers`
5. 在 `.env` 配置项目 URL 和匿名 Key

## 6. NPM 脚本

- `npm run dev`：本地开发
- `npm run build`：生产构建
- `npm run preview`：本地预览生产包
- `npm test`：运行测试
- `npm run test:watch`：测试监听

## 7. 数据与清理

- 全量清理 SQL（仅用于重置环境）：
  - [`clear_all_data.sql`](/Users/zengze/Documents/New%20project/clear_all_data.sql)

## 8. 目录结构

- [`src/App.jsx`](/Users/zengze/Documents/New%20project/src/App.jsx)：核心页面与业务逻辑
- [`src/index.css`](/Users/zengze/Documents/New%20project/src/index.css)：全局样式与组件风格
- [`src/supabase.js`](/Users/zengze/Documents/New%20project/src/supabase.js)：Supabase 初始化
- [`src/utils/game.js`](/Users/zengze/Documents/New%20project/src/utils/game.js)：结算算法与校验
- [`supabase_schema.sql`](/Users/zengze/Documents/New%20project/supabase_schema.sql)：数据库结构、函数、RLS

## 9. 文档导航

- [`docs/DEVELOPMENT.md`](/Users/zengze/Documents/New%20project/docs/DEVELOPMENT.md)：开发流程与模块说明
- [`docs/ARCHITECTURE.md`](/Users/zengze/Documents/New%20project/docs/ARCHITECTURE.md)：系统架构与数据流
- [`docs/DATABASE.md`](/Users/zengze/Documents/New%20project/docs/DATABASE.md)：表结构、RLS、函数与排错
- [`docs/DEPLOYMENT.md`](/Users/zengze/Documents/New%20project/docs/DEPLOYMENT.md)：Vercel 与 Supabase 部署
- [`docs/OPERATIONS.md`](/Users/zengze/Documents/New%20project/docs/OPERATIONS.md)：日常运维检查清单
- [`docs/CHANGELOG.md`](/Users/zengze/Documents/New%20project/docs/CHANGELOG.md)：版本变更记录

## 10. 生产部署（Vercel）

```bash
npx vercel --prod --yes
```

确保 Vercel 项目环境变量已配置：

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## 11. v2.1.0 备注

- 当前版本已移除 `admin` 相关功能与 SQL
- 权限以房主机制 + RLS 为主
- 历史积分榜：全量对局统计；历史记录：按当前用户参与过滤
- 兼容移动端 Safari/Chrome/Edge，支持 PWA 浏览器场景
