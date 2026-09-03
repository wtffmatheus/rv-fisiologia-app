import { lazy, Suspense, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import type { Profile } from './types'
import { RvLoadingState } from './components/PlatformState'

const AuthPage = lazy(() => import('./pages/AuthPage'))
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'))
const PendingPage = lazy(() => import('./pages/PendingPage'))
const StudentHome = lazy(() => import('./pages/StudentHome'))
const AdminHome = lazy(() => import('./pages/AdminHome'))

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [recoveryMode, setRecoveryMode] = useState(
    () => new URLSearchParams(window.location.search).get('recovery') === '1',
  )

  async function loadProfile(userId: string) {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
    setProfile((data as Profile) ?? null)
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session)
      if (data.session) await loadProfile(data.session.user.id)
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange(async (event, next) => {
      if (event === 'PASSWORD_RECOVERY') {
        setRecoveryMode(true)
      }

      setSession(next)
      if (next) await loadProfile(next.user.id)
      else setProfile(null)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <RvLoadingState
        fullScreen
        title="Abrindo o RV App"
        text="Validando sua sessão e preparando seu acesso."
      />
    )
  }

  let page

  if (recoveryMode && session) {
    page = (
      <ResetPasswordPage
        onDone={() => {
          window.history.replaceState({}, document.title, window.location.pathname)
          setRecoveryMode(false)
        }}
      />
    )
  } else if (!session) {
    page = <AuthPage />
  } else if (!profile) {
    return (
      <RvLoadingState
        fullScreen
        title="Preparando seu acesso"
        text="Carregando seu perfil e permissões."
      />
    )
  } else if (profile.status !== 'active') {
    page = <PendingPage profile={profile} />
  } else if (profile.role === 'admin') {
    page = <AdminHome profile={profile} />
  } else {
    page = <StudentHome profile={profile} />
  }

  return (
    <Suspense
      fallback={
        <RvLoadingState
          fullScreen
          title="Carregando área"
          text="Preparando os recursos desta tela."
        />
      }
    >
      {page}
    </Suspense>
  )
}
