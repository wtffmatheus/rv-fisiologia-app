import { BellRing, BellOff, Check, Smartphone } from 'lucide-react'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const VAPID_PUBLIC_KEY =
  'BKUlP2Eac3-YgIYaqtOOIQRnF4zBBHHY0gqpAyE23OXHVXFtk73LlmCZYS8iFTWaTX-etR2l-cN0w-hDrRdxdhc'

type PushState =
  | 'checking'
  | 'ready'
  | 'enabled'
  | 'denied'
  | 'unsupported'
  | 'needs_install'
  | 'busy'
  | 'error'

function isIosDevice() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
}

function isStandaloneMode() {
  const iosStandalone = Boolean(
    (navigator as Navigator & { standalone?: boolean }).standalone,
  )

  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    iosStandalone
  )
}

function base64UrlToUint8Array(value: string) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4)
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  const output = new Uint8Array(raw.length)

  for (let index = 0; index < raw.length; index += 1) {
    output[index] = raw.charCodeAt(index)
  }

  return output
}

function supported() {
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

export default function AdminPushControl({
  adminId,
}: {
  adminId: string
}) {
  const [state, setState] = useState<PushState>('checking')
  const [message, setMessage] = useState('')

  async function inspectCurrentState() {
    if (!supported()) {
      setState('unsupported')
      return
    }

    if (isIosDevice() && !isStandaloneMode()) {
      setState('needs_install')
      return
    }

    if (Notification.permission === 'denied') {
      setState('denied')
      return
    }

    try {
      const registration = await navigator.serviceWorker.ready
      const subscription =
        await registration.pushManager.getSubscription()

      setState(subscription ? 'enabled' : 'ready')
    } catch {
      setState('error')
    }
  }

  useEffect(() => {
    void inspectCurrentState()
  }, [])

  async function enablePush() {
    if (!supported()) return

    setMessage('')
    setState('busy')

    try {
      const permission = await Notification.requestPermission()

      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'denied' : 'ready')
        return
      }

      const registration = await navigator.serviceWorker.ready
      let subscription =
        await registration.pushManager.getSubscription()

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey:
            base64UrlToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
        })
      }

      const serialized = subscription.toJSON()
      const p256dh = serialized.keys?.p256dh
      const auth = serialized.keys?.auth

      if (!p256dh || !auth) {
        throw new Error('subscription_keys_missing')
      }

      const { error } = await supabase
        .from('admin_push_subscriptions')
        .upsert(
          {
            admin_id: adminId,
            endpoint: subscription.endpoint,
            p256dh,
            auth,
            user_agent: navigator.userAgent,
            active: true,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'endpoint',
          },
        )

      if (error) throw error

      setState('enabled')
      setMessage('Este dispositivo receberá avisos do RV App.')
    } catch {
      setState('error')
      setMessage('Não foi possível ativar as notificações neste dispositivo.')
    }
  }

  async function disablePush() {
    setMessage('')
    setState('busy')

    try {
      const registration = await navigator.serviceWorker.ready
      const subscription =
        await registration.pushManager.getSubscription()

      if (subscription) {
        await supabase
          .from('admin_push_subscriptions')
          .delete()
          .eq('endpoint', subscription.endpoint)

        await subscription.unsubscribe()
      }

      setState('ready')
      setMessage('Notificações deste dispositivo desativadas.')
    } catch {
      setState('error')
      setMessage('Não foi possível desativar as notificações.')
    }
  }

  const enabled = state === 'enabled'
  const busy = state === 'busy' || state === 'checking'

  return (
    <section className="adminPushSettings">
      <div className="adminPushSettingsIcon">
        {enabled ? <BellRing size={20} /> : <Smartphone size={20} />}
      </div>

      <div className="adminPushSettingsCopy">
        <span>NOTIFICAÇÕES NO DISPOSITIVO</span>
        <strong>
          {enabled
            ? 'Push ativado'
            : state === 'denied'
              ? 'Permissão bloqueada'
              : state === 'needs_install'
                ? 'Instale o RV App primeiro'
                : state === 'unsupported'
                  ? 'Não disponível neste navegador'
                  : 'Receba avisos mesmo com o painel fechado'}
        </strong>

        <p>
          {enabled
            ? 'Novos cadastros e conclusões de metodologia podem chegar como notificação do sistema.'
            : state === 'needs_install'
              ? 'No iPhone/iPad, adicione o RV App à Tela de Início e abra pelo ícone para ativar push.'
              : state === 'denied'
                ? 'As notificações foram bloqueadas nas configurações do navegador ou do sistema.'
                : 'A ativação é por dispositivo e só ocorre depois da sua autorização.'}
        </p>

        {message && <small>{message}</small>}
      </div>

      <div className="adminPushSettingsAction">
        {enabled ? (
          <button
            type="button"
            className="adminPushDisable"
            onClick={() => void disablePush()}
            disabled={busy}
          >
            <BellOff size={15} />
            Desativar
          </button>
        ) : (
          <button
            type="button"
            className="adminPushEnable"
            onClick={() => void enablePush()}
            disabled={
              busy ||
              state === 'denied' ||
              state === 'unsupported' ||
              state === 'needs_install'
            }
          >
            {state === 'checking' || state === 'busy' ? (
              'Verificando...'
            ) : (
              <>
                <Check size={15} />
                Ativar notificações
              </>
            )}
          </button>
        )}
      </div>
    </section>
  )
}
