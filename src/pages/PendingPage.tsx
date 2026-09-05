import { RefreshCw, LogOut } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Profile } from '../types'
import { supabase } from '../lib/supabase'
import { useI18n } from '../i18n'
import StudentPushControl from '../components/StudentPushControl'

const liveCopy = {
  'pt-BR': {
    auto: 'Esta tela atualiza automaticamente quando seu acesso for liberado.',
    check: 'Verificar agora',
    checking: 'Verificando...',
  },
  en: {
    auto: 'This screen updates automatically when your access is approved.',
    check: 'Check now',
    checking: 'Checking...',
  },
  es: {
    auto: 'Esta pantalla se actualiza automáticamente cuando aprueben tu acceso.',
    check: 'Verificar ahora',
    checking: 'Verificando...',
  },
  'zh-CN': {
    auto: '访问获批后，此页面会自动更新。',
    check: '立即检查',
    checking: '检查中...',
  },
  de: {
    auto: 'Diese Seite aktualisiert sich automatisch, sobald dein Zugang freigegeben wird.',
    check: 'Jetzt prüfen',
    checking: 'Wird geprüft...',
  },
} as const

export default function PendingPage({
  profile,
  onProfileChange,
}: {
  profile: Profile
  onProfileChange: (profile: Profile) => void
}) {
  const { t, language } = useI18n()
  const firstName =
    profile.name?.trim().split(' ')[0] || 'RV'
  const blocked = profile.status === 'blocked'
  const [checking, setChecking] = useState(false)
  const copy = liveCopy[language]

  async function refreshProfile() {
    if (checking) return
    setChecking(true)

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', profile.id)
        .single()

      if (!error && data) {
        onProfileChange(data as Profile)
      }
    } finally {
      setChecking(false)
    }
  }

  useEffect(() => {
    const channel = supabase
      .channel(`rv-profile-status-${profile.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${profile.id}`,
        },
        (payload) => {
          onProfileChange(payload.new as Profile)
        },
      )
      .subscribe()

    const interval = window.setInterval(
      () => void refreshProfile(),
      12_000,
    )

    function handleFocus() {
      void refreshProfile()
    }

    function handleVisibility() {
      if (document.visibilityState === 'visible') {
        void refreshProfile()
      }
    }

    window.addEventListener('focus', handleFocus)
    document.addEventListener(
      'visibilitychange',
      handleVisibility,
    )

    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener(
        'visibilitychange',
        handleVisibility,
      )
      void supabase.removeChannel(channel)
    }
  }, [profile.id])

  return (
    <main className="pendingPage">
      <section className="statusCard">
        <img
          src="/logo-rv-app.png"
          className="statusLogo"
          alt="RV Fisiologia"
        />

        <div className="statusDivider" />

        <p className="eyebrow">
          {blocked
            ? t('accessPaused')
            : t('registrationReceived')}
        </p>

        <h1>
          {blocked ? t('blocked') : t('pending')}
        </h1>

        <p className="muted">
          {blocked
            ? t('pendingBlockedHelp', {
                name: firstName,
              })
            : t('pendingApprovalHelp', {
                name: firstName,
              })}
        </p>

        <div className="emailBox">
          {profile.email}
        </div>

        {!blocked && (
          <div className="pendingLiveStatus">
            <div className="pendingLiveIndicator">
              <span />
              <p>{copy.auto}</p>
            </div>

            <button
              type="button"
              className="pendingRefreshButton"
              onClick={() => void refreshProfile()}
              disabled={checking}
            >
              <RefreshCw
                size={15}
                className={
                  checking ? 'rvUiSpin' : ''
                }
              />
              {checking
                ? copy.checking
                : copy.check}
            </button>
          </div>
        )}

        {!blocked && (
          <StudentPushControl
            studentId={profile.id}
            compact
          />
        )}

        <button
          className="secondary statusLogout"
          onClick={() =>
            supabase.auth.signOut()
          }
        >
          <LogOut size={17} />
          {t('logout')}
        </button>
      </section>
    </main>
  )
}
