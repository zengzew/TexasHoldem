export function getAuthModePrimaryLabel(mode) {
  switch (mode) {
    case 'register':
      return '注册';
    case 'reset':
      return '重置密码';
    case 'login':
    default:
      return '登录';
  }
}

export function getAuthModeSecondaryLabel(mode) {
  switch (mode) {
    case 'register':
      return '已有账号？去登录';
    case 'reset':
      return '返回登录';
    case 'login':
    default:
      return '没有账号？去注册';
  }
}

export function shouldShowForgotPasswordLink(mode) {
  return mode === 'login';
}
