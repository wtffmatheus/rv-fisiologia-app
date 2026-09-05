import { FormEvent, useState } from 'react'
import { supabase } from '../lib/supabase'
import { authErrorMessage } from '../lib/authErrors'
import { AppLanguage, languages, useI18n } from '../i18n'

type Mode = 'login' | 'register' | 'forgot'
type MessageTone = 'success' | 'error'

export default function AuthPage() {
  const { language, setLanguage, t } = useI18n()
  const [mode, setMode] = useState<Mode>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [messageTone, setMessageTone] = useState<MessageTone>('error')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setMessage('')

    const normalizedEmail = email.trim().toLowerCase()

    if (!normalizedEmail) {
      setMessageTone('error')
      setMessage(t('email'))
      return
    }

    if (mode === 'register' && name.trim().length < 2) {
      setMessageTone('error')
      setMessage(t('name'))
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
        const { error } = await supabase.auth.resetPasswordForEmail(
          normalizedEmail,
          {
            redirectTo: `${window.location.origin}/?recovery=1`,
          },
        )

        if (error) {
          setMessageTone('error')
          setMessage(authErrorMessage(error, t('authGenericError'), language))
        } else {
          setMessageTone('success')
          setMessage(t('authRecoverySent'))
        }

        return
      }

      if (mode === 'register') {
        const { error } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            data: { name: name.trim(), language },
            emailRedirectTo: window.location.origin,
          },
        })

        if (error) {
          setMessageTone('error')
          setMessage(authErrorMessage(error, t('authGenericError'), language))
        } else {
          setMessageTone('success')
          setMessage(t('authRegistrationSent'))
          setName('')
          setEmail('')
          setPassword('')
        }

        return
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      })

      if (error) {
        setMessageTone('error')
        setMessage(authErrorMessage(error, t('authGenericError'), language))
      }
    } catch (error) {
      setMessageTone('error')
      setMessage(authErrorMessage(error, t('authGenericError'), language))
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
            <select
              className="authLanguageSelect"
              value={language}
              onChange={(event) =>
                setLanguage(event.target.value as AppLanguage)
              }
              aria-label={t('languageTitle')}
            >
              {languages.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.name}
                </option>
              ))}
            </select>
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
                  onChange={(event) => setName(event.target.value)}
                  autoComplete="name"
                  required
                />
              </label>
            )}

            {mode === 'register' && (
              <label>
                {t('languageTitle')}
                <select
                  value={language}
                  onChange={(event) =>
                    setLanguage(event.target.value as AppLanguage)
                  }
                >
                  {languages.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label>
              {t('email')}
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                inputMode="email"
                required
              />
            </label>

            {mode !== 'forgot' && (
              <label>
                {t('password')}
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  minLength={8}
                  autoComplete={
                    mode === 'login'
                      ? 'current-password'
                      : 'new-password'
                  }
                  required
                />
              </label>
            )}

            <button className="primary" disabled={loading}>
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
            <p className={`message authMessage ${messageTone}`}>
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
