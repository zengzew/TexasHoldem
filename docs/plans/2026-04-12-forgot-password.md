# Forgot Password Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在登录页增加“忘记密码”模式，用户输入昵称和新密码即可立即重置密码，并用新密码重新登录。

**Architecture:** 前端在现有认证表单中新增 `reset` 模式和一条 `resetPassword()` 逻辑，后端在 `supabase_schema.sql` 中新增一个安全定义函数 `reset_password_by_nickname` 用于按昵称直接重置 `auth.users` 的密码哈希。现有登录、注册、已登录修改密码链路保持不变。

**Tech Stack:** React, Vite, Supabase Auth, Supabase SQL RPC, Vitest

---

### Task 1: Add failing auth-mode tests for forgot password UI

**Files:**
- Modify: `src/utils/authMode.test.js`
- Read: `src/App.jsx`

**Step 1: Write the failing test**

Add tests covering:
- reset 模式时按钮显示 `重置密码`
- reset 模式时次按钮显示 `返回登录`
- login 模式时显示 `忘记密码？`

**Step 2: Run test to verify it fails**

Run:
```bash
/Users/zengze/.nvm/versions/node/v24.13.0/bin/npm test -- src/utils/authMode.test.js
```
Expected: FAIL because reset mode behavior does not exist.

**Step 3: Write minimal implementation**

Implement only the auth-mode branching helpers or component logic needed to make the new UI assertions possible.

**Step 4: Run test to verify it passes**

Run the same command.
Expected: PASS.

**Step 5: Commit**

```bash
git add src/utils/authMode.test.js src/App.jsx
git commit -m "test: add forgot password auth mode coverage"
```

### Task 2: Add failing tests for reset-password flow logic

**Files:**
- Create: `src/utils/forgotPassword.test.js`
- Create: `src/utils/forgotPassword.js`
- Modify: `src/App.jsx`

**Step 1: Write the failing test**

Add tests for a helper that:
- validates nickname presence
- validates next password presence
- maps missing RPC/function/user conditions to existing notice messages
- returns success metadata that tells UI to switch back to login while preserving nickname

**Step 2: Run test to verify it fails**

Run:
```bash
/Users/zengze/.nvm/versions/node/v24.13.0/bin/npm test -- src/utils/forgotPassword.test.js
```
Expected: FAIL because helper does not exist.

**Step 3: Write minimal implementation**

Implement the helper with the minimum logic needed to support:
- input validation
- user-not-found mapping
- schema-outdated mapping
- success payload

**Step 4: Run test to verify it passes**

Run the same command.
Expected: PASS.

**Step 5: Commit**

```bash
git add src/utils/forgotPassword.js src/utils/forgotPassword.test.js src/App.jsx
git commit -m "test: cover forgot password flow logic"
```

### Task 3: Add failing SQL regression check for reset-password RPC

**Files:**
- Modify: `supabase_schema.sql`
- Modify: `docs/DATABASE.md`
- Modify: `README.md`

**Step 1: Write the failing test**

Since SQL functions are not covered by unit tests here, create a file-level regression assertion by adding a Vitest snapshot/string test that verifies schema text contains:
- `reset_password_by_nickname`
- `grant execute ... to anon, authenticated`

Suggested file:
- Create: `src/utils/schemaContract.test.js`

**Step 2: Run test to verify it fails**

Run:
```bash
/Users/zengze/.nvm/versions/node/v24.13.0/bin/npm test -- src/utils/schemaContract.test.js
```
Expected: FAIL because schema has no reset RPC yet.

**Step 3: Write minimal implementation**

Add the SQL function and grant to `supabase_schema.sql`.
Function behavior:
- look up `profiles.nickname`
- join to `auth.users`
- update `encrypted_password`
- raise exception when nickname not found

**Step 4: Run test to verify it passes**

Run the same command.
Expected: PASS.

**Step 5: Commit**

```bash
git add supabase_schema.sql src/utils/schemaContract.test.js README.md docs/DATABASE.md
git commit -m "feat: add forgot password reset rpc"
```

### Task 4: Implement the UI flow in App.jsx

**Files:**
- Modify: `src/App.jsx`
- Read: `src/utils/forgotPassword.js`

**Step 1: Write the failing test**

Extend auth-mode tests or add a focused UI test that verifies:
- clicking `忘记密码？` enters reset mode
- successful reset returns to login mode
- nickname input remains populated

**Step 2: Run test to verify it fails**

Run:
```bash
/Users/zengze/.nvm/versions/node/v24.13.0/bin/npm test -- src/utils/authMode.test.js src/utils/forgotPassword.test.js
```
Expected: FAIL because App does not wire reset mode yet.

**Step 3: Write minimal implementation**

In `src/App.jsx`:
- add `authMode === 'reset'`
- add `resetPassword()` using the helper and RPC
- add login-page mode switching buttons and labels
- keep existing login/register behavior untouched

**Step 4: Run test to verify it passes**

Run the same command.
Expected: PASS.

**Step 5: Commit**

```bash
git add src/App.jsx src/utils/authMode.test.js src/utils/forgotPassword.js src/utils/forgotPassword.test.js
git commit -m "feat: add forgot password mode"
```

### Task 5: Full verification and docs pass

**Files:**
- Modify: `README.md`
- Modify: `docs/CHANGELOG.md`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/DEVELOPMENT.md`
- Modify: `docs/OPERATIONS.md`

**Step 1: Update docs**

Document:
- login/reset flow
- need to rerun latest `supabase_schema.sql`
- accepted security tradeoff

**Step 2: Run full verification**

Run:
```bash
PATH="/Users/zengze/.nvm/versions/node/v24.13.0/bin:$PATH" npm test
PATH="/Users/zengze/.nvm/versions/node/v24.13.0/bin:$PATH" npm run build
```
Expected: all tests pass and build succeeds.

**Step 3: Commit**

```bash
git add README.md docs/CHANGELOG.md docs/ARCHITECTURE.md docs/DEVELOPMENT.md docs/OPERATIONS.md
git commit -m "docs: document forgot password flow"
```
