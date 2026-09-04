import { FormEvent, useState } from 'react'
import { supabase } from '../lib/supabase'
import { authErrorMessage } from '../lib/authErrors'

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

    const normalizedEmail = email.trim().toLowerCase()

    if (!normalizedEmail) {
      setMessageTone('error')
      setMessage('Digite seu e-mail.')
      return
    }

    if (mode === 'register' && name.trim().length < 2) {
      setMessageTone('error')
      setMessage('Digite seu nome.')
      return
    }

    if (mode !== 'forgot' && password.length < 8) {
      setMessageTone('error')
      setMessage('A senha precisa ter pelo menos 8 caracteres.')
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
          setMessage(
            authErrorMessage(
              error,
              'Não foi possível enviar o e-mail de recuperação agora.',
            ),
          )
        } else {
          setMessageTone('success')
          setMessage(
            'Se este e-mail estiver cadastrado, você receberá uma mensagem da RV Fisiologia para criar uma nova senha.',
          )
        }

        return
      }

      if (mode === 'register') {
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
          setMessage(
            authErrorMessage(
              error,
              'Não foi possível criar o cadastro agora.',
            ),
          )
        } else {
          setMessageTone('success')
          setMessage(
            'Cadastro enviado com sucesso. Agora é só aguardar a liberação do acesso pela equipe RV.',
          )
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
        setMessage(authErrorMessage(error, 'E-mail ou senha inválidos.'))
      }
    } catch (error) {
      setMessageTone('error')
      setMessage(authErrorMessage(error))
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
          <img
            className="mobileLogo"
            src="/logo-rv-app.png"
            alt="RV Fisiologia"
          />

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
                  autoComplete="name"
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
                autoComplete="email"
                inputMode="email"
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
                  autoComplete={
                    mode === 'login' ? 'current-password' : 'new-password'
                  }
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
                Esqueci minha senha
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
