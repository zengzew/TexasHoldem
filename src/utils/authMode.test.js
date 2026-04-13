import { describe, expect, it } from 'vitest';
import { getAuthModePrimaryLabel, getAuthModeSecondaryLabel, shouldShowForgotPasswordLink } from './authMode';

describe('auth mode helpers', () => {
  it('returns the correct primary button labels', () => {
    expect(getAuthModePrimaryLabel('login')).toBe('登录');
    expect(getAuthModePrimaryLabel('register')).toBe('注册');
    expect(getAuthModePrimaryLabel('reset')).toBe('重置密码');
  });

  it('returns the correct secondary button labels', () => {
    expect(getAuthModeSecondaryLabel('login')).toBe('没有账号？去注册');
    expect(getAuthModeSecondaryLabel('register')).toBe('已有账号？去登录');
    expect(getAuthModeSecondaryLabel('reset')).toBe('返回登录');
  });

  it('shows forgot password entry only in login mode', () => {
    expect(shouldShowForgotPasswordLink('login')).toBe(true);
    expect(shouldShowForgotPasswordLink('register')).toBe(false);
    expect(shouldShowForgotPasswordLink('reset')).toBe(false);
  });
});
