import { LogOut } from 'lucide-react'
import type { Profile } from '../types'
import { supabase } from '../lib/supabase'
import { useI18n } from '../i18n'

export default function PendingPage({ profile }: { profile: Profile }) {
  const { t } = useI18n()
  const firstName = profile.name?.trim().split(' ')[0] || 'RV'
  const blocked = profile.status === 'blocked'
  return <main className="pendingPage"><section className="statusCard">
    <img src="/logo-rv-app.png" className="statusLogo" alt="RV Fisiologia" /><div className="statusDivider" />
    <p className="eyebrow">{blocked ? t('accessPaused') : t('registrationReceived')}</p>
    <h1>{blocked ? t('blocked') : t('pending')}</h1>
    <p className="muted">{blocked ? `${firstName}, entre em contato com a equipe RV para verificar sua conta.` : `${firstName}, quando a equipe RV liberar o acesso, seu programa aparecerá automaticamente.`}</p>
    <div className="emailBox">{profile.email}</div>
    <button className="secondary statusLogout" onClick={() => supabase.auth.signOut()}><LogOut size={17} />{t('logout')}</button>
  </section></main>
}
