type ErrorLike = {
  message?: string
  code?: string
  status?: number
}

type Language = 'pt-BR' | 'en' | 'es' | 'zh-CN' | 'de'

function readError(error: unknown) {
  if (!error || typeof error !== 'object') return ''
  const value = error as ErrorLike
  return `${value.code ?? ''} ${value.message ?? ''}`.trim().toLowerCase()
}

const messages = {
  'pt-BR': {
    invalid: 'E-mail ou senha inválidos.',
    confirm: 'Confirme seu e-mail antes de entrar.',
    exists: 'Este e-mail já possui cadastro. Tente entrar ou recuperar a senha.',
    signup: 'Novos cadastros estão temporariamente indisponíveis.',
    weak: 'Use uma senha mais forte, com pelo menos 8 caracteres.',
    same: 'A nova senha precisa ser diferente da senha atual.',
    rate: 'Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.',
    email: 'Digite um endereço de e-mail válido.',
    network: 'Não foi possível conectar ao servidor. Verifique sua internet e tente novamente.',
    session: 'Sua sessão ou permissão mudou. Entre novamente e tente outra vez.',
  },
  en: {
    invalid: 'Invalid email or password.',
    confirm: 'Confirm your email before signing in.',
    exists: 'This email is already registered. Sign in or recover your password.',
    signup: 'New registrations are temporarily unavailable.',
    weak: 'Use a stronger password with at least 8 characters.',
    same: 'The new password must be different from the current one.',
    rate: 'Too many attempts. Wait a few minutes and try again.',
    email: 'Enter a valid email address.',
    network: 'Could not connect to the server. Check your internet connection and try again.',
    session: 'Your session or permission changed. Sign in again and retry.',
  },
  es: {
    invalid: 'Correo o contraseña incorrectos.',
    confirm: 'Confirma tu correo antes de entrar.',
    exists: 'Este correo ya está registrado. Entra o recupera tu contraseña.',
    signup: 'Los nuevos registros no están disponibles temporalmente.',
    weak: 'Usa una contraseña más segura, con al menos 8 caracteres.',
    same: 'La nueva contraseña debe ser diferente de la actual.',
    rate: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.',
    email: 'Ingresa un correo válido.',
    network: 'No se pudo conectar al servidor. Revisa tu conexión e inténtalo de nuevo.',
    session: 'Tu sesión o permiso cambió. Vuelve a entrar e inténtalo de nuevo.',
  },
  'zh-CN': {
    invalid: '邮箱或密码不正确。',
    confirm: '请先确认邮箱再登录。',
    exists: '此邮箱已注册。请登录或找回密码。',
    signup: '暂时无法创建新账户。',
    weak: '请使用更强的密码，至少 8 个字符。',
    same: '新密码必须与当前密码不同。',
    rate: '尝试次数过多，请稍后再试。',
    email: '请输入有效的邮箱地址。',
    network: '无法连接服务器，请检查网络后重试。',
    session: '你的会话或权限已变化，请重新登录后再试。',
  },
  de: {
    invalid: 'E-Mail oder Passwort ist falsch.',
    confirm: 'Bestätige deine E-Mail, bevor du dich anmeldest.',
    exists: 'Diese E-Mail ist bereits registriert. Melde dich an oder setze dein Passwort zurück.',
    signup: 'Neue Registrierungen sind vorübergehend nicht verfügbar.',
    weak: 'Verwende ein stärkeres Passwort mit mindestens 8 Zeichen.',
    same: 'Das neue Passwort muss sich vom aktuellen unterscheiden.',
    rate: 'Zu viele Versuche. Warte einige Minuten und versuche es erneut.',
    email: 'Gib eine gültige E-Mail-Adresse ein.',
    network: 'Verbindung zum Server fehlgeschlagen. Prüfe deine Internetverbindung und versuche es erneut.',
    session: 'Deine Sitzung oder Berechtigung hat sich geändert. Melde dich erneut an.',
  },
} as const

function lang(value?: string): Language {
  return value === 'en' || value === 'es' || value === 'zh-CN' || value === 'de'
    ? value
    : 'pt-BR'
}

export function authErrorMessage(
  error: unknown,
  fallback = 'Não foi possível concluir esta ação. Tente novamente.',
  language?: string,
) {
  const raw = readError(error)
  const t = messages[lang(language)]

  if (!raw) return fallback
  if (raw.includes('invalid login credentials') || raw.includes('invalid_credentials')) return t.invalid
  if (raw.includes('email not confirmed') || raw.includes('email_not_confirmed')) return t.confirm
  if (raw.includes('user already registered') || raw.includes('user_already_exists') || raw.includes('already been registered')) return t.exists
  if (raw.includes('signup is disabled') || raw.includes('signup_disabled')) return t.signup
  if (raw.includes('password should be at least') || raw.includes('weak_password') || raw.includes('password is too weak')) return t.weak
  if (raw.includes('same password') || raw.includes('new password should be different')) return t.same
  if (raw.includes('email rate limit') || raw.includes('over_email_send_rate_limit') || raw.includes('rate limit')) return t.rate
  if (raw.includes('invalid email') || (raw.includes('email address') && raw.includes('invalid'))) return t.email
  if (raw.includes('network') || raw.includes('fetch') || raw.includes('timeout')) return t.network

  return fallback
}

export function dataErrorMessage(
  error: unknown,
  fallback = 'Não foi possível atualizar os dados agora. Tente novamente.',
  language?: string,
) {
  const raw = readError(error)
  const t = messages[lang(language)]

  if (
    raw.includes('jwt') ||
    raw.includes('token') ||
    raw.includes('not authorized') ||
    raw.includes('permission')
  ) {
    return t.session
  }

  if (raw.includes('network') || raw.includes('fetch') || raw.includes('timeout')) {
    return t.network
  }

  return fallback
}
