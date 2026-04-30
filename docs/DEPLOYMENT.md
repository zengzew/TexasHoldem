# 部署文档（Vercel + Supabase, v2.3.0）

## 1. 前置准备

- GitHub 仓库已存在
- Supabase 项目已创建并执行 `supabase_schema.sql`
- Vercel 项目已绑定仓库（或本地 CLI 直接部署）
- Node.js 推荐版本：`24.x`

## 2. 环境变量

在本地 `.env` 与 Vercel 环境中配置：

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

示例参考：
- [`.env.example`](/Users/zengze/Documents/New%20project/.env.example)

## 3. 本地发布前检查

```bash
npm test
npm run build
```

> 若生产库版本较旧，请先在 Supabase SQL Editor 执行最新 `supabase_schema.sql`，确保 `room_players` 的 `own_or_owner` 策略已生效。

## 4. 发布命令

```bash
npx vercel --prod --yes
```

发布成功后会输出：
- Inspect URL
- Production URL
- Alias（如 `texas-omega.vercel.app`）

## 5. GitHub 推送流程

```bash
git add .
git commit -m "feat: ... / docs: ..."
git push -u origin master
```

若 HTTPS push 报 `HTTP2 framing layer`，先切回 HTTP/1.1：

```bash
git config http.version HTTP/1.1
git push -u origin master
```

## 6. 回滚策略

- 前端：在 Vercel Deployments 页面回滚到上一个成功版本
- 数据库：结构变更尽量幂等；必要时通过 SQL 手动恢复字段或策略
