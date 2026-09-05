import { FormEvent, useState } from 'react'
import { supabase } from '../lib/supabase'
import { authErrorMessage } from '../lib/authErrors'
import { useI18n } from '../i18n'

export default function ResetPasswordPage({
  onDone,
}: {
  onDone: () => void
}) {
  const { language, t } = useI18n()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setMessage('')

    if (password.length < 8) {
      setMessage(t('authMin8'))
      return
    }

    if (password !== confirmPassword) {
      setMessage(t('resetMismatch'))
      return
    }

    setLoading(true)

    try {
      const { error } = await supabase.auth.updateUser({ password })

      if (error) {
        setMessage(
          authErrorMessage(
            error,
            t('passwordChangeError'),
            language,
          ),
        )
        return
      }

      window.history.replaceState(
        {},
        document.title,
        window.location.pathname,
      )
      setSuccess(true)
    } catch (error) {
      setMessage(
        authErrorMessage(
          error,
          t('passwordChangeError'),
          language,
        ),
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="auth resetPasswordPage">
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
          <h1>{t('resetBrandTitle')}</h1>
          <p>{t('resetBrandText')}</p>
        </div>
      </section>

      <section className="loginWrap">
        <div className="card resetPasswordCard">
          <img
            className="mobileLogo"
            src="/logo-rv-app.png"
            alt="RV Fisiologia"
          />

          <p className="eyebrow">{t('resetSecurity')}</p>
          <h2>
            {success ? t('resetChanged') : t('resetCreate')}
          </h2>

          {success ? (
            <>
              <p className="message accountSuccessMessage success">
                {t('resetSuccess')}
              </p>

              <button
                className="primary"
                type="button"
                onClick={onDone}
              >
                {t('resetContinue')}
              </button>
            </>
          ) : (
            <>
              <p className="muted">{t('resetHelp')}</p>

              <form onSubmit={handleSubmit}>
                <label>
                  {t('newPassword')}
                  <input
                    type="password"
                    value={password}
                    onChange={(event) =>
                      setPassword(event.target.value)
                    }
                    placeholder={t('min8Placeholder')}
                    minLength={8}
                    autoComplete="new-password"
                    required
                  />
                </label>

                <label>
                  {t('confirmNewPassword')}
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(event) =>
                      setConfirmPassword(event.target.value)
                    }
                    placeholder={t('repeatPlaceholder')}
                    minLength={8}
                    autoComplete="new-password"
                    required
                  />
                </label>

                <button className="primary" disabled={loading}>
                  {loading
                    ? t('resetChanging')
                    : t('resetSave')}
                </button>
              </form>

              {message && (
                <p className="message error">{message}</p>
              )}
            </>
          )}
        </div>
      </section>
    </main>
  )
}
