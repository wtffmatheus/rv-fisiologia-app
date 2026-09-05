import { FormEvent, useState } from 'react'
import { ChevronDown, Globe2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { authErrorMessage } from '../lib/authErrors'
import { AppLanguage, languages, useI18n } from '../i18n'

type Mode = 'login' | 'register' | 'forgot'
type MessageTone = 'success' | 'error'

type RegisterResponse = {
  ok?: boolean
  error?: string
  user_id?: string
  status?: string
  retry_after_seconds?: number
}

const registerMessages: Record<
  AppLanguage,
  Record<string, string>
> = {
  'pt-BR': {
    rate_limited:
      'Muitas tentativas de cadastro neste dispositivo. Aguarde um pouco e tente novamente.',
    account_exists:
      'Este e-mail já possui uma conta. Volte para entrar ou use a recuperação de senha.',
    invalid_name: 'Digite seu nome completo ou pelo menos 2 caracteres.',
    invalid_email: 'Digite um e-mail válido.',
    invalid_password: 'A senha precisa ter entre 8 e 72 caracteres.',
    registration_unavailable:
      'O cadastro está temporariamente indisponível. Tente novamente em alguns minutos.',
    registration_failed:
      'Não foi possível criar sua conta agora. Tente novamente.',
    profile_creation_failed:
      'Sua conta não pôde ser preparada corretamente. Tente novamente.',
    sign_in_failed:
      'A conta foi criada, mas não foi possível abrir a tela de aprovação. Volte para entrar com seu e-mail e senha.',
  },
  en: {
    rate_limited:
      'Too many registration attempts on this device. Wait a while and try again.',
    account_exists:
      'This email already has an account. Sign in or use password recovery.',
    invalid_name: 'Enter your name using at least 2 characters.',
    invalid_email: 'Enter a valid email address.',
    invalid_password: 'The password must be between 8 and 72 characters.',
    registration_unavailable:
      'Registration is temporarily unavailable. Try again in a few minutes.',
    registration_failed:
      'Could not create your account right now. Try again.',
    profile_creation_failed:
      'Your account could not be prepared correctly. Try again.',
    sign_in_failed:
      'The account was created, but the approval screen could not be opened. Sign in with your email and password.',
  },
  es: {
    rate_limited:
      'Demasiados intentos de registro en este dispositivo. Espera un poco e inténtalo de nuevo.',
    account_exists:
      'Este correo ya tiene una cuenta. Entra o usa la recuperación de contraseña.',
    invalid_name: 'Ingresa tu nombre con al menos 2 caracteres.',
    invalid_email: 'Ingresa un correo válido.',
    invalid_password: 'La contraseña debe tener entre 8 y 72 caracteres.',
    registration_unavailable:
      'El registro no está disponible temporalmente. Inténtalo de nuevo en unos minutos.',
    registration_failed:
      'No se pudo crear tu cuenta ahora. Inténtalo de nuevo.',
    profile_creation_failed:
      'Tu cuenta no pudo prepararse correctamente. Inténtalo de nuevo.',
    sign_in_failed:
      'La cuenta fue creada, pero no se pudo abrir la pantalla de aprobación. Entra con tu correo y contraseña.',
  },
  'zh-CN': {
    rate_limited: '此设备的注册尝试次数过多，请稍后再试。',
    account_exists: '此邮箱已有账户。请登录或使用密码找回。',
    invalid_name: '请输入至少 2 个字符的姓名。',
    invalid_email: '请输入有效的邮箱地址。',
    invalid_password: '密码长度必须为 8 到 72 个字符。',
    registration_unavailable: '注册暂时不可用，请几分钟后重试。',
    registration_failed: '暂时无法创建账户，请重试。',
    profile_creation_failed: '账户未能正确准备，请重试。',
    sign_in_failed: '账户已创建，但无法打开审核页面。请使用邮箱和密码登录。',
  },
  de: {
    rate_limited:
      'Zu viele Registrierungsversuche auf diesem Gerät. Warte kurz und versuche es erneut.',
    account_exists:
      'Für diese E-Mail gibt es bereits ein Konto. Melde dich an oder setze dein Passwort zurück.',
    invalid_name: 'Gib deinen Namen mit mindestens 2 Zeichen ein.',
    invalid_email: 'Gib eine gültige E-Mail-Adresse ein.',
    invalid_password: 'Das Passwort muss zwischen 8 und 72 Zeichen lang sein.',
    registration_unavailable:
      'Die Registrierung ist vorübergehend nicht verfügbar. Versuche es in einigen Minuten erneut.',
    registration_failed:
      'Dein Konto konnte gerade nicht erstellt werden. Versuche es erneut.',
    profile_creation_failed:
      'Dein Konto konnte nicht korrekt vorbereitet werden. Versuche es erneut.',
    sign_in_failed:
      'Das Konto wurde erstellt, aber die Freigabeseite konnte nicht geöffnet werden. Melde dich mit E-Mail und Passwort an.',
  },
}

async function edgeErrorCode(error: unknown) {
  const context = (
    error as {
      context?: Response
    }
  )?.context

  if (!context) return ''

  try {
    const payload = (await context.clone().json()) as RegisterResponse
    return String(payload?.error || '')
  } catch {
    return ''
  }
}

export default function AuthPage() {
  const { language, setLanguage, t } = useI18n()
  const [mode, setMode] = useState<Mode>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [messageTone, setMessageTone] =
    useState<MessageTone>('error')
  const [loading, setLoading] = useState(false)

  const currentLanguage =
    languages.find((item) => item.value === language) ??
    languages[0]

  function registrationMessage(code: string) {
    return (
      registerMessages[language][code] ||
      registerMessages[language].registration_failed
    )
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (loading) return

    setMessage('')
    const normalizedEmail = email.trim().toLowerCase()

    if (!normalizedEmail) {
      setMessageTone('error')
      setMessage(t('email'))
      return
    }

    if (mode === 'register' && name.trim().length < 2) {
      setMessageTone('error')
      setMessage(
        registerMessages[language].invalid_name,
      )
      return
    }

    if (mode !== 'forgot' && password.length < 8) {
      setMessageTone('error')
      setMessage(t('authMin8'))
      return
    }

    setLoading(true)

    try {
      if (mode === 'forgot') {
        const { error } =
          await supabase.auth.resetPasswordForEmail(
            normalizedEmail,
            {
              redirectTo: `${window.location.origin}/?recovery=1`,
            },
          )

        if (error) {
          setMessageTone('error')
          setMessage(
            authErrorMessage(
              error,
              t('authGenericError'),
              language,
            ),
          )
        } else {
          setMessageTone('success')
          setMessage(t('authRecoverySent'))
        }

        return
      }

      if (mode === 'register') {
        const { data, error } =
          await supabase.functions.invoke<RegisterResponse>(
            'student-register',
            {
              body: {
                name: name.trim(),
                email: normalizedEmail,
                password,
                language,
              },
            },
          )

        if (error || !data?.ok) {
          const code =
            data?.error ||
            (await edgeErrorCode(error)) ||
            'registration_failed'

          setMessageTone('error')
          setMessage(registrationMessage(code))
          return
        }

        const { error: signInError } =
          await supabase.auth.signInWithPassword({
            email: normalizedEmail,
            password,
          })

        if (signInError) {
          setMode('login')
          setMessageTone('error')
          setMessage(
            registerMessages[language].sign_in_failed,
          )
          return
        }

        // O listener global de sessão abre a PendingPage.
        return
      }

      const { error } =
        await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        })

      if (error) {
        setMessageTone('error')
        setMessage(
          authErrorMessage(
            error,
            t('authGenericError'),
            language,
          ),
        )
      }
    } catch (error) {
      setMessageTone('error')
      setMessage(
        authErrorMessage(
          error,
          t('authGenericError'),
          language,
        ),
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="auth">
      <section className="brand">
        <div>
          <img
            className="brandLogo"
            src="/logo-rv-app.png"
            alt="RV Fisiologia"
          />
        </div>

        <div>
          <p className="eyebrow">RV FISIOLOGIA</p>
          <h1>{t('brandTitle')}</h1>
          <p>{t('brandSubtitle')}</p>
        </div>
      </section>

      <section className="loginWrap">
        <div className="card">
          <div className="authCardTop">
            <img
              className="mobileLogo"
              src="/logo-rv-app.png"
              alt="RV Fisiologia"
            />

            <label
              className="authLanguagePicker"
              title={t('languageTitle')}
            >
              <Globe2
                size={17}
                className="authLanguageIcon"
              />

              <span className="authLanguageCurrent">
                {currentLanguage.name}
              </span>

              <ChevronDown
                size={15}
                className="authLanguageChevron"
              />

              <select
                value={language}
                onChange={(event) =>
                  setLanguage(
                    event.target.value as AppLanguage,
                  )
                }
                aria-label={t('languageTitle')}
              >
                {languages.map((item) => (
                  <option
                    key={item.value}
                    value={item.value}
                  >
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <p className="eyebrow">RV APP</p>

          <h2>
            {mode === 'login'
              ? t('loginTitle')
              : mode === 'register'
                ? t('registerTitle')
                : t('forgotTitle')}
          </h2>

          <p className="muted">
            {mode === 'login'
              ? t('loginHelp')
              : mode === 'register'
                ? t('registerHelp')
                : t('forgotHelp')}
          </p>

          <form onSubmit={handleSubmit}>
            {mode === 'register' && (
              <label>
                {t('name')}
                <input
                  value={name}
                  onChange={(event) =>
                    setName(event.target.value)
                  }
                  autoComplete="name"
                  maxLength={80}
                  required
                />
              </label>
            )}

            <label>
              {t('email')}
              <input
                type="email"
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                autoComplete="email"
                inputMode="email"
                maxLength={254}
                required
              />
            </label>

            {mode !== 'forgot' && (
              <label>
                {t('password')}
                <input
                  type="password"
                  value={password}
                  onChange={(event) =>
                    setPassword(event.target.value)
                  }
                  minLength={8}
                  maxLength={72}
                  autoComplete={
                    mode === 'login'
                      ? 'current-password'
                      : 'new-password'
                  }
                  required
                />
              </label>
            )}

            <button
              className="primary"
              disabled={loading}
            >
              {loading
                ? t('wait')
                : mode === 'login'
                  ? t('signIn')
                  : mode === 'register'
                    ? t('create')
                    : t('sendRecovery')}
            </button>
          </form>

          {message && (
            <p
              className={`message authMessage ${messageTone}`}
              role="status"
            >
              {message}
            </p>
          )}

          {mode === 'login' && (
            <div className="authForgotRow">
              <button
                className="link authForgotLink"
                type="button"
                onClick={() => {
                  setMode('forgot')
                  setMessage('')
                  setPassword('')
                }}
              >
                {t('forgot')}
              </button>
            </div>
          )}

          <button
            className="link"
            type="button"
            disabled={loading}
            onClick={() => {
              setMode(
                mode === 'forgot'
                  ? 'login'
                  : mode === 'login'
                    ? 'register'
                    : 'login',
              )
              setMessage('')
              setPassword('')
            }}
          >
            {mode === 'login'
              ? t('noAccount')
              : mode === 'register'
                ? t('hasAccount')
                : t('backLogin')}
          </button>
        </div>
      </section>
    </main>
  )
}
