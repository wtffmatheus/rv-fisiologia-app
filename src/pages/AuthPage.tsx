import { FormEvent, useState } from 'react'
import { supabase } from '../lib/supabase'

type Mode = 'login' | 'register' | 'forgot'
type MessageTone = 'success' | 'error'

export default function AuthPage() {
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
    setLoading(true)

    if (mode === 'forgot') {
      const normalizedEmail = email.trim().toLowerCase()

      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: `${window.location.origin}/?recovery=1`,
      })

      if (error) {
        setMessageTone('error')
        setMessage(error.message)
      } else {
        setMessageTone('success')
        setMessage(
          'Enviamos um link para o seu e-mail. Abra a mensagem da RV Fisiologia para criar uma nova senha.',
        )
      }

      setLoading(false)
      return
    }

    if (mode === 'register') {
      const normalizedEmail = email.trim().toLowerCase()

      const { error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: { name: name.trim() },
          emailRedirectTo: window.location.origin,
        },
      })

      if (error) {
        setMessageTone('error')
        setMessage(error.message)
      } else {
        setMessageTone('success')
        setMessage(
          'Cadastro enviado com sucesso. Agora é só aguardar a liberação do acesso pela equipe RV.',
        )
        setName('')
        setEmail('')
        setPassword('')
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        setMessageTone('error')
        setMessage('E-mail ou senha inválidos.')
      }
    }

    setLoading(false)
  }

  return (
    <main className="auth">
      <section className="brand">
        <div>
          <img className="brandLogo" src="/logo-rv-app.png" alt="RV Fisiologia" />
        </div>

        <div>
          <p className="eyebrow">RV FISIOLOGIA</p>
          <h1>Ciência, estratégia e resultados.</h1>
          <p>
            Treinos organizados, acompanhamento e evolução em um só lugar.
          </p>

          <div className="brandFeatures">
            <div>Aulas e treinos liberados por programa</div>
            <div>Acompanhamento individual do aluno</div>
            <div>Acesso pelo celular, tablet ou computador</div>
          </div>
        </div>
      </section>

      <section className="loginWrap">
        <div className="card">
          <img className="mobileLogo" src="/logo-rv-app.png" alt="RV Fisiologia" />

          <p className="eyebrow">ÁREA DO ALUNO</p>
          <h2>
            {mode === 'login'
              ? 'Acesse sua conta'
              : mode === 'register'
                ? 'Crie sua conta'
                : 'Recupere sua senha'}
          </h2>

          <p className="muted">
            {mode === 'login'
              ? 'Entre com seu e-mail e senha.'
              : mode === 'register'
                ? 'Após o cadastro, a equipe RV irá analisar e liberar o seu acesso.'
                : 'Informe o e-mail da sua conta para receber o link de recuperação.'}
          </p>

          <form onSubmit={handleSubmit}>
            {mode === 'register' && (
              <label>
                Nome
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Seu nome"
                  required
                />
              </label>
            )}

            <label>
              E-mail
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="seuemail@exemplo.com"
                required
              />
            </label>

            {mode !== 'forgot' && (
              <label>
                Senha
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Digite sua senha"
                  minLength={8}
                  required
                />
              </label>
            )}

            <button className="primary" disabled={loading}>
              {loading
                ? 'Aguarde...'
                : mode === 'login'
                  ? 'Entrar'
                  : mode === 'register'
                    ? 'Criar cadastro'
                    : 'Enviar link de recuperação'}
            </button>
          </form>

          {message && <p className={`message authMessage ${messageTone}`}>{message}</p>}

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
                Esqueci minha senha
              </button>
            </div>
          )}

          <button
            className="link"
            type="button"
            onClick={() => {
              setMode(mode === 'forgot' ? 'login' : mode === 'login' ? 'register' : 'login')
              setMessage('')
              setPassword('')
            }}
          >
            {mode === 'login'
              ? 'Ainda não tem conta? Cadastre-se'
              : mode === 'register'
                ? 'Já possui cadastro? Entrar'
                : 'Voltar para entrar'}
          </button>
        </div>
      </section>
    </main>
  )
}
