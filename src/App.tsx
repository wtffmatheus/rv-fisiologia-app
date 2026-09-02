import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import type { Profile } from './types'
import AuthPage from './pages/AuthPage'
import PendingPage from './pages/PendingPage'
import StudentHome from './pages/StudentHome'
import AdminHome from './pages/AdminHome'

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

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

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, next) => {
      setSession(next)
      if (next) await loadProfile(next.user.id)
      else setProfile(null)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  if (loading) return <div className="center">Carregando...</div>
  if (!session) return <AuthPage />
  if (!profile) return <div className="center">Preparando seu acesso...</div>
  if (profile.status !== 'active') return <PendingPage profile={profile} />
  if (profile.role === 'admin') return <AdminHome profile={profile} />
  return <StudentHome profile={profile} />
}
