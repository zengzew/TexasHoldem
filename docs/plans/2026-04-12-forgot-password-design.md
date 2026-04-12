# Forgot Password Design

## Goal
在登录页增加一个极简“忘记密码”流程。用户不需要邮箱或短信验证码，只需输入昵称和新密码，即可立即重置密码，并返回登录页使用新密码登录。

## Constraints
- 保持现有“昵称 + 密码”注册/登录链路不变。
- 不引入邮件、短信、验证码或额外第三方服务。
- 不改动已登录后的账户设置改密逻辑。
- 不改变现有错误提示风格和页面设计语言。
- 接受低安全性的产品约束：知道昵称即可重置密码。

## Approaches Considered

### 1. 登录页切换为 reset 模式
推荐。
- 在登录页增加“忘记密码？”入口。
- 点击后进入 `authMode = 'reset'`。
- 表单只保留：昵称、新密码。
- 成功后提示“密码已重置，请使用新密码登录”，并自动回到登录模式。

优点：改动最小、符合现有表单结构、不需要额外 popup 状态。
缺点：认证区会从两态变成三态，但复杂度仍可控。

### 2. 登录页内 popup 重置密码
- 点击“忘记密码？”弹出 glass popup，里面填写昵称和新密码。

优点：登录表单状态保持简单。
缺点：多一套弹层状态与交互，错误处理更复杂，收益不明显。

### 3. 独立重置密码页面
- 新建路由或独立页面专门处理重置。

优点：结构分离。
缺点：对于当前单页应用来说过重，完全没有必要。

## Selected Design
采用方案 1：登录页内三态切换。

## Frontend Design

### Auth Modes
现有：
- `login`
- `register`

新增：
- `reset`

### Login Form Behavior
- 登录模式：保留现有字段和按钮。
- 注册模式：保留现有字段和按钮。
- 重置模式：
  - 字段 1：昵称
  - 字段 2：新密码
  - 主按钮：`重置密码`
  - 次按钮：`返回登录`
  - 不展示“没有账号？去注册”那条文案，避免混乱。
  - 保持现有密码可见/隐藏交互。

### Success and Error Messages
成功：
- `密码已重置，请使用新密码登录`

错误：
- `请填写昵称`
- `请填写新密码`
- `该用户尚未注册`
- `数据库密码重置函数未更新，请在 Supabase 执行最新 supabase_schema.sql`
- `密码重置失败，请重试`

### UX Notes
- 成功后：
  - 清空当前密码输入
  - 切回登录模式
  - 保留昵称输入，减少重复输入成本
- 失败后：
  - 仍停留在 reset 模式
  - 显示顶部 notice，不自动切模式

## Backend Design

### New SQL Function
新增 RPC：`public.reset_password_by_nickname(target_nickname text, next_password text)`

职责：
- 通过 `public.profiles.nickname` 找到对应 `auth.users.id`
- 直接更新 `auth.users.encrypted_password`
- 使用与当前系统一致的密码标准化方式，由前端先做 `normalizePasswordLegacy()`，后端只接受要写入的最终密码

预期行为：
- 找不到昵称：抛出可识别错误
- 找到昵称：更新密码成功

### Security Model
- 函数授予 `anon, authenticated` 执行权限
- `security definer`
- 这是刻意宽松的产品策略，不增加额外校验

## Testing Plan

### Frontend
- reset 模式渲染正确
- 缺少昵称时报错
- 缺少新密码时报错
- RPC 找不到用户时显示“该用户尚未注册”
- 成功后切回登录模式并保留昵称

### SQL / Integration Assumptions
- schema 更新后，RPC 可被前端匿名调用
- 旧登录和注册流程不受影响
- 已登录修改密码流程不受影响

## Risks
- 这是低安全策略，任何知道昵称的人都能重置密码。
- 若线上数据库未执行最新版 `supabase_schema.sql`，重置功能会明确失败并提示更新 schema。

## Rollback Scope
若需要回退，仅需撤销：
- 登录页 `reset` 模式分支
- `signIn` 旁的“忘记密码”入口
- SQL 中新增的 `reset_password_by_nickname` 函数与 grant
