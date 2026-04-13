import { describe, expect, it } from 'vitest';
import { buildForgotPasswordResult } from './forgotPassword';

describe('forgot password helper', () => {
  it('requires nickname', () => {
    expect(buildForgotPasswordResult({ nickname: '', password: '123' })).toEqual({
      ok: false,
      message: '请填写昵称',
      code: 'MISSING_NICKNAME',
    });
  });

  it('requires password', () => {
    expect(buildForgotPasswordResult({ nickname: 'zane', password: '' })).toEqual({
      ok: false,
      message: '请填写新密码',
      code: 'MISSING_PASSWORD',
    });
  });

  it('maps missing user to a friendly message', () => {
    expect(buildForgotPasswordResult({ nickname: 'zane', password: '123', errorCode: 'USER_NOT_FOUND' })).toEqual({
      ok: false,
      message: '该用户尚未注册',
      code: 'USER_NOT_FOUND',
    });
  });

  it('maps missing schema function to an upgrade message', () => {
    expect(buildForgotPasswordResult({ nickname: 'zane', password: '123', errorCode: 'SCHEMA_OUTDATED' })).toEqual({
      ok: false,
      message: '数据库密码重置函数未更新，请在 Supabase 执行最新 supabase_schema.sql',
      code: 'SCHEMA_OUTDATED',
    });
  });

  it('returns success payload preserving the nickname for login mode', () => {
    expect(buildForgotPasswordResult({ nickname: 'zane', password: '123', success: true })).toEqual({
      ok: true,
      message: '密码已重置，请使用新密码登录',
      nextMode: 'login',
      nickname: 'zane',
      clearPassword: true,
    });
  });
});
