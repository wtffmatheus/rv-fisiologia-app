import { FormEvent, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function ResetPasswordPage({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setMessage('')

    if (password.length < 8) {
      setMessage('A senha precisa ter pelo menos 8 caracteres.')
      return
    }

    if (password !== confirmPassword) {
      setMessage('As senhas não são iguais.')
      return
    }

    setLoading(true)

    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setMessage(error.message)
      setLoading(false)
      return
    }

    window.history.replaceState({}, document.title, window.location.pathname)
    setSuccess(true)
    setLoading(false)
  }

  return (
    <main className="auth resetPasswordPage">
      <section className="brand">
        <div>
          <img className="brandLogo" src="/logo-rv-app.png" alt="RV Fisiologia" />
        </div>

        <div>
          <p className="eyebrow">RV FISIOLOGIA</p>
          <h1>Proteja sua conta.</h1>
          <p>Crie uma nova senha para voltar ao seu acompanhamento.</p>
        </div>
      </section>

      <section className="loginWrap">
        <div className="card resetPasswordCard">
          <img className="mobileLogo" src="/logo-rv-app.png" alt="RV Fisiologia" />

          <p className="eyebrow">SEGURANÇA DA CONTA</p>
          <h2>{success ? 'Senha alterada' : 'Crie uma nova senha'}</h2>

          {success ? (
            <>
              <p className="message accountSuccessMessage success">
                Sua senha foi atualizada com sucesso.
              </p>
              <button className="primary" type="button" onClick={onDone}>
                Continuar para o aplicativo
              </button>
            </>
          ) : (
            <>
              <p className="muted">
                Use uma senha que você não utiliza em outros serviços.
              </p>

              <form onSubmit={handleSubmit}>
                <label>
                  Nova senha
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Digite a nova senha"
                    minLength={8}
                    autoComplete="new-password"
                    required
                  />
                </label>

                <label>
                  Confirmar nova senha
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="Digite novamente"
                    minLength={8}
                    autoComplete="new-password"
                    required
                  />
                </label>

                <button className="primary" disabled={loading}>
                  {loading ? 'Alterando...' : 'Salvar nova senha'}
                </button>
              </form>

              {message && <p className="message error">{message}</p>}
            </>
          )}
        </div>
      </section>
    </main>
  )
}
