import { FormEvent, useState } from 'react'
import { supabase } from '../lib/supabase'

type Mode = 'login' | 'register'

export default function AuthPage() {
  const [mode, setMode] = useState<Mode>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setMessage('')
    setLoading(true)

    if (mode === 'register') {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name },
        },
      })

      if (error) {
        setMessage(error.message)
      } else {
        setMessage('Cadastro enviado com sucesso. Agora é só aguardar a liberação do acesso pela equipe RV.')
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
        setMessage('E-mail ou senha inválidos.')
      }
    }

    setLoading(false)
  }

  return (
    <main className="auth-layout">
      <section className="brand-panel">
        <div className="brand-top">
          <img className="brand-logo" src="/logo-rv.png" alt="RV Fisiologia" />
        </div>

        <div className="brand-content">
          <p className="eyebrow">RV FISIOLOGIA</p>
          <h1>Ciência, estratégia e resultados.</h1>
          <p className="brand-copy">
            Treinos organizados, acompanhamento e evolução em um só lugar.
          </p>
        </div>

        <div className="brand-features">
          <div className="feature-item">
            <span className="feature-dot" />
            Aulas e treinos liberados por programa
          </div>
          <div className="feature-item">
            <span className="feature-dot" />
            Acompanhamento individual do aluno
          </div>
          <div className="feature-item">
            <span className="feature-dot" />
            Acesso pelo celular, tablet ou computador
          </div>
        </div>
      </section>

      <section className="auth-card-wrap">
        <div className="auth-card">
          <img className="card-logo" src="/logo-rv.png" alt="RV Fisiologia" />

          <p className="eyebrow">ÁREA DO ALUNO</p>
          <h2>{mode === 'login' ? 'Acesse sua conta' : 'Crie sua conta'}</h2>
          <p className="muted">
            {mode === 'login'
              ? 'Entre com seu e-mail e senha.'
              : 'Após o cadastro, a equipe RV irá analisar e liberar o seu acesso manualmente.'}
          </p>

          <form onSubmit={handleSubmit}>
            {mode === 'register' && (
              <label>
                Nome
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
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
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seuemail@exemplo.com"
                required
              />
            </label>

            <label>
              Senha
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Digite sua senha"
                minLength={6}
                required
              />
            </label>

            <button className="primary-btn" disabled={loading}>
              {loading ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Criar cadastro'}
            </button>
          </form>

          {message && <p className="form-message">{message}</p>}

          <button
            className="text-btn"
            type="button"
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login')
              setMessage('')
            }}
          >
            {mode === 'login'
              ? 'Ainda não tem conta? Cadastre-se'
              : 'Já possui cadastro? Entrar'}
          </button>
        </div>
      </section>
    </main>
  )
}