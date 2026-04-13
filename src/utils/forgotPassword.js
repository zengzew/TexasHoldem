export function buildForgotPasswordResult({ nickname, password, errorCode, success = false }) {
  const trimmedNickname = String(nickname || '').trim();
  const trimmedPassword = String(password || '').trim();

  if (!trimmedNickname) {
    return { ok: false, message: '请填写昵称', code: 'MISSING_NICKNAME' };
  }

  if (!trimmedPassword) {
    return { ok: false, message: '请填写新密码', code: 'MISSING_PASSWORD' };
  }

  if (success) {
    return {
      ok: true,
      message: '密码已重置，请使用新密码登录',
      nextMode: 'login',
      nickname: trimmedNickname,
      clearPassword: true,
    };
  }

  if (errorCode === 'USER_NOT_FOUND') {
    return { ok: false, message: '该用户尚未注册', code: 'USER_NOT_FOUND' };
  }

  if (errorCode === 'SCHEMA_OUTDATED') {
    return {
      ok: false,
      message: '数据库密码重置函数未更新，请在 Supabase 执行最新 supabase_schema.sql',
      code: 'SCHEMA_OUTDATED',
    };
  }

  return { ok: false, message: '密码重置失败，请重试', code: errorCode || 'RESET_FAILED' };
}
