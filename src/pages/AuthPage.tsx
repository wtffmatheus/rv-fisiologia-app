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
        setMessage('E-mail ou senha inválidos.')
      }
    }

    setLoading(false)
  }

  return (
    <main className="auth">
      <section className="brand">
        <div>
          <img className="brandLogo" src="/logo-rv.png" alt="RV Fisiologia" />
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
          <img className="mobileLogo" src="/logo-rv.png" alt="RV Fisiologia" />

          <p className="eyebrow">ÁREA DO ALUNO</p>
          <h2>{mode === 'login' ? 'Acesse sua conta' : 'Crie sua conta'}</h2>

          <p className="muted">
            {mode === 'login'
              ? 'Entre com seu e-mail e senha.'
              : 'Após o cadastro, a equipe RV irá analisar e liberar o seu acesso.'}
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

            <label>
              Senha
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Digite sua senha"
                minLength={6}
                required
              />
            </label>

            <button className="primary" disabled={loading}>
              {loading ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Criar cadastro'}
            </button>
          </form>

          {message && <p className="message">{message}</p>}

          <button
            className="link"
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
