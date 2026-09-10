import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import type { Profile } from './types'
import { RvEmptyState, RvLoadingState } from './components/PlatformState'
import { useI18n } from './i18n'

const AuthPage = lazy(() => import('./pages/AuthPage'))
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'))
const PendingPage = lazy(() => import('./pages/PendingPage'))
const StudentHome = lazy(() => import('./pages/StudentHome'))
const AdminHome = lazy(() => import('./pages/AdminHome'))

const PROFILE_TIMEOUT_MS = 12_000

async function withTimeout<T>(
  promise: PromiseLike<T>,
  timeoutMs = PROFILE_TIMEOUT_MS,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined

  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(
      () => reject(new Error('request_timeout')),
      timeoutMs,
    )
  })

  try {
    return await Promise.race([Promise.resolve(promise), timeout])
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}

export default function App() {
  const { setLanguage } = useI18n()
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileError, setProfileError] = useState('')
  const profileRequest = useRef(0)
  const [recoveryMode, setRecoveryMode] = useState(
    () => new URLSearchParams(window.location.search).get('recovery') === '1',
  )

  async function loadProfile(userId: string) {
    const request = ++profileRequest.current
    setProfileLoading(true)
    setProfileError('')

    try {
      const { data, error } = await withTimeout(
        supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle(),
      )

      if (request !== profileRequest.current) return false
      if (error) throw error

      if (!data) {
        setProfile(null)
        setProfileError(
          'Seu login foi encontrado, mas o perfil do RV App ainda não está disponível.',
        )
        return false
      }

      setProfile(data as Profile)
      return true
    } catch (error) {
      if (request !== profileRequest.current) return false
      console.error('Falha ao carregar perfil:', error)
      setProfile(null)
      setProfileError(
        'Não foi possível carregar seu perfil agora. Verifique a conexão e tente novamente.',
      )
      return false
    } finally {
      if (request === profileRequest.current) setProfileLoading(false)
    }
  }

  useEffect(() => {
    let active = true

    async function initialize() {
      try {
        const { data, error } = await withTimeout(supabase.auth.getSession())

        if (!active) return

        if (error) throw error

        setSession(data.session)

        if (data.session) {
          await loadProfile(data.session.user.id)
        } else {
          setProfile(null)
          setProfileError('')
        }
      } catch (error) {
        console.error('Falha ao validar sessão:', error)

        if (active) {
          setSession(null)
          setProfile(null)
          setProfileError('')
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    void initialize()

    const { data: listener } = supabase.auth.onAuthStateChange(
      (event, next) => {
        if (!active) return
        const authChange = ++profileRequest.current
        if (event === 'PASSWORD_RECOVERY') {
          setRecoveryMode(true)
        }

        setSession(next)

        if (next) {
          setProfile(current => current?.id === next.user.id ? current : null)
          window.setTimeout(() => {
            if (active && authChange === profileRequest.current) void loadProfile(next.user.id)
          }, 0)
        } else {
          profileRequest.current += 1
          setProfile(null)
          setProfileError('')
          setProfileLoading(false)
        }
      },
    )

    return () => {
      active = false
      profileRequest.current += 1
      listener.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => { if (profile?.language) setLanguage(profile.language) }, [profile?.language, setLanguage])

  if (loading || (session && profileLoading)) {
    return (
      <RvLoadingState
        fullScreen
        title={loading ? 'Abrindo o RV App' : 'Preparando seu acesso'}
        text={
          loading
            ? 'Validando sua sessão e preparando seu acesso.'
            : 'Carregando seu perfil e permissões.'
        }
      />
    )
  }

  if (session && !profile && profileError) {
    return (
      <main className="rvProfileFailurePage">
        <img
          src="/logo-rv-app.png"
          className="rvProfileFailureLogo"
          alt="RV App"
        />

        <RvEmptyState
          kind="error"
          title="Não foi possível abrir sua conta"
          text={profileError}
          actionLabel="Tentar novamente"
          onAction={() => void loadProfile(session.user.id)}
        />

        <button
          type="button"
          className="rvProfileFailureLogout"
          onClick={() => void supabase.auth.signOut()}
        >
          Voltar para o login
        </button>
      </main>
    )
  }

  let page

  if (recoveryMode && session) {
    page = (
      <ResetPasswordPage
        onDone={() => {
          window.history.replaceState(
            {},
            document.title,
            window.location.pathname,
          )
          setRecoveryMode(false)
        }}
      />
    )
  } else if (!session) {
    page = <AuthPage />
  } else if (!profile) {
    page = (
      <RvLoadingState
        fullScreen
        title="Preparando seu acesso"
        text="Carregando seu perfil e permissões."
      />
    )
  } else if (profile.status !== 'active') {
    page = (
      <PendingPage
        profile={profile}
        onProfileChange={setProfile}
      />
    )
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
