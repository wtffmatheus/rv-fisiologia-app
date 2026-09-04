type ErrorLike = {
  message?: string
  code?: string
  status?: number
}

function readError(error: unknown) {
  if (!error || typeof error !== 'object') return ''

  const value = error as ErrorLike
  return `${value.code ?? ''} ${value.message ?? ''}`.trim().toLowerCase()
}

export function authErrorMessage(
  error: unknown,
  fallback = 'Não foi possível concluir esta ação. Tente novamente.',
) {
  const raw = readError(error)

  if (!raw) return fallback

  if (
    raw.includes('invalid login credentials') ||
    raw.includes('invalid_credentials')
  ) {
    return 'E-mail ou senha inválidos.'
  }

  if (
    raw.includes('email not confirmed') ||
    raw.includes('email_not_confirmed')
  ) {
    return 'Confirme seu e-mail antes de entrar.'
  }

  if (
    raw.includes('user already registered') ||
    raw.includes('user_already_exists') ||
    raw.includes('already been registered')
  ) {
    return 'Este e-mail já possui cadastro. Tente entrar ou recuperar a senha.'
  }

  if (
    raw.includes('signup is disabled') ||
    raw.includes('signup_disabled')
  ) {
    return 'Novos cadastros estão temporariamente indisponíveis.'
  }

  if (
    raw.includes('password should be at least') ||
    raw.includes('weak_password') ||
    raw.includes('password is too weak')
  ) {
    return 'Use uma senha mais forte, com pelo menos 8 caracteres.'
  }

  if (
    raw.includes('same password') ||
    raw.includes('new password should be different')
  ) {
    return 'A nova senha precisa ser diferente da senha atual.'
  }

  if (
    raw.includes('email rate limit') ||
    raw.includes('over_email_send_rate_limit') ||
    raw.includes('rate limit')
  ) {
    return 'Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.'
  }

  if (
    raw.includes('invalid email') ||
    raw.includes('email address') && raw.includes('invalid')
  ) {
    return 'Digite um endereço de e-mail válido.'
  }

  if (
    raw.includes('network') ||
    raw.includes('fetch') ||
    raw.includes('timeout')
  ) {
    return 'Não foi possível conectar ao servidor. Verifique sua internet e tente novamente.'
  }

  return fallback
}

export function dataErrorMessage(
  error: unknown,
  fallback = 'Não foi possível atualizar os dados agora. Tente novamente.',
) {
  const raw = readError(error)

  if (
    raw.includes('jwt') ||
    raw.includes('token') ||
    raw.includes('not authorized') ||
    raw.includes('permission')
  ) {
    return 'Sua sessão ou permissão mudou. Entre novamente e tente outra vez.'
  }

  if (
    raw.includes('network') ||
    raw.includes('fetch') ||
    raw.includes('timeout')
  ) {
    return 'Falha de conexão. Verifique sua internet e tente novamente.'
  }

  return fallback
}
