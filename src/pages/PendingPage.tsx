import { LogOut } from 'lucide-react'
import type { Profile } from '../types'
import { supabase } from '../lib/supabase'

export default function PendingPage({ profile }: { profile: Profile }) {
  const firstName = profile.name?.trim().split(' ')[0] || 'Aluno'

  return (
    <main className="pendingPage">
      <section className="statusCard">
        <img src="/logo-rv.png" className="statusLogo" alt="RV Fisiologia" />
        <div className="statusDivider" />
        <p className="eyebrow">CADASTRO RECEBIDO</p>
        <h1>Seu acesso está em análise.</h1>
        <p className="muted">
          {firstName}, seu cadastro foi concluído. Quando a equipe RV liberar o acesso,
          o seu programa aparecerá automaticamente nesta conta.
        </p>

        <div className="emailBox">{profile.email}</div>

        <button className="secondary statusLogout" onClick={() => supabase.auth.signOut()}>
          <LogOut size={17} />
          Sair
        </button>
      </section>
    </main>
  )
}
