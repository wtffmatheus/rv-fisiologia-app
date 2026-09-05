import { BellRing, Check, Send, Smartphone } from 'lucide-react'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useI18n } from '../i18n'

const VAPID_PUBLIC_KEY =
  'BDZzL6QTYfHhzcpdUcZ3vDR3Yr3IvslCPJYepcRINntxy1uCbo5hUpSxCBpIpMerjodiwrTsJVxtOoPgiCFIqt4'

type PushState =
  | 'checking'
  | 'ready'
  | 'enabled'
  | 'denied'
  | 'unsupported'
  | 'needs_install'
  | 'busy'
  | 'error'

function isIos() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
}

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  )
}

function b64ToBytes(value: string) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4)
  const raw = atob(
    (value + padding).replace(/-/g, '+').replace(/_/g, '/'),
  )
  const out = new Uint8Array(raw.length)

  for (let i = 0; i < raw.length; i += 1) {
    out[i] = raw.charCodeAt(i)
  }

  return out
}

function sameBytes(
  a: ArrayBuffer | null | undefined,
  b: Uint8Array,
) {
  if (!a) return false
  const left = new Uint8Array(a)
  if (left.length !== b.length) return false

  for (let i = 0; i < left.length; i += 1) {
    if (left[i] !== b[i]) return false
  }

  return true
}

export default function AdminPushControl({
  adminId,
}: {
  adminId: string
}) {
  const { t } = useI18n()
  const [state, setState] = useState<PushState>('checking')
  const [message, setMessage] = useState('')
  const [testing, setTesting] = useState(false)

  const supported =
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window

  async function persist(subscription: PushSubscription) {
    const serialized = subscription.toJSON()
    const p256dh = serialized.keys?.p256dh
    const auth = serialized.keys?.auth

    if (!p256dh || !auth) throw new Error('subscription_keys_missing')

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
        { onConflict: 'endpoint' },
      )

    if (error) throw error
  }

  async function createFreshSubscription() {
    const registration = await navigator.serviceWorker.ready
    const current = await registration.pushManager.getSubscription()
    const expected = b64ToBytes(VAPID_PUBLIC_KEY)

    if (
      current &&
      sameBytes(
        current.options.applicationServerKey as ArrayBuffer | null,
        expected,
      )
    ) {
      await persist(current)
      return current
    }

    if (current) {
      await current.unsubscribe()
    }

    const fresh = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: expected as BufferSource,
    })

    await persist(fresh)
    return fresh
  }

  async function inspect() {
    if (!supported) {
      setState('unsupported')
      return
    }

    if (isIos() && !isStandalone()) {
      setState('needs_install')
      return
    }

    if (Notification.permission === 'denied') {
      setState('denied')
      return
    }

    try {
      const registration = await navigator.serviceWorker.ready
      const current = await registration.pushManager.getSubscription()

      if (!current) {
        setState('ready')
        return
      }

      const expected = b64ToBytes(VAPID_PUBLIC_KEY)

      if (
        !sameBytes(
          current.options.applicationServerKey as ArrayBuffer | null,
          expected,
        )
      ) {
        await current.unsubscribe()
        setState('ready')
        setMessage(
          'A configuração de notificações foi atualizada. Ative novamente neste dispositivo.',
        )
        return
      }

      await persist(current)
      setState('enabled')
    } catch (error) {
      console.error('Falha ao verificar push:', error)
      setState('error')
    }
  }

  useEffect(() => {
    void inspect()
  }, [])

  async function enable() {
    if (!supported) return

    setState('busy')
    setMessage('')

    try {
      const permission = await Notification.requestPermission()

      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'denied' : 'ready')
        return
      }

      await createFreshSubscription()
      setState('enabled')
      setMessage('Notificações ativadas neste dispositivo.')
    } catch (error) {
      console.error('Falha ao ativar push:', error)
      setState('error')
      setMessage('Não foi possível ativar as notificações.')
    }
  }

  async function disable() {
    setState('busy')
    setMessage('')

    try {
      const registration = await navigator.serviceWorker.ready
      const current = await registration.pushManager.getSubscription()

      if (current) {
        await supabase
          .from('admin_push_subscriptions')
          .delete()
          .eq('endpoint', current.endpoint)

        await current.unsubscribe()
      }

      setState('ready')
      setMessage('Notificações desativadas neste dispositivo.')
    } catch (error) {
      console.error('Falha ao desativar push:', error)
      setState('error')
      setMessage('Não foi possível desativar as notificações.')
    }
  }

  async function test() {
    setTesting(true)
    setMessage('')

    try {
      const { data, error } = await supabase.functions.invoke(
        'admin-web-push',
        { body: { action: 'test' } },
      )

      if (error) throw error

      if (data?.sent > 0) {
        setMessage('Teste enviado. A notificação deve aparecer em instantes.')
      } else if (data?.no_devices) {
        setMessage(
          'Nenhum dispositivo ativo foi encontrado. Ative as notificações novamente.',
        )
      } else if (Array.isArray(data?.errors) && data.errors.length) {
        setMessage(
          'O servidor tentou enviar, mas o provedor recusou a notificação.',
        )
      } else {
        setMessage('O teste não foi entregue.')
      }
    } catch (error) {
      console.error('Falha ao testar push:', error)
      setMessage('Não foi possível enviar o teste.')
    } finally {
      setTesting(false)
    }
  }

  const enabled = state === 'enabled'
  const busy = state === 'busy' || state === 'checking'
  const canToggle = ![
    'denied',
    'unsupported',
    'needs_install',
  ].includes(state)

  return (
    <div className="preferenceRow pushPreferenceRow">
      <div className="preferenceIcon">
        {enabled ? <BellRing size={19} /> : <Smartphone size={19} />}
      </div>

      <div className="preferenceCopy">
        <strong>{t('notifications')}</strong>
        <span>
          {enabled
            ? 'Ativas neste dispositivo'
            : state === 'needs_install'
              ? 'Instale o RV App na Tela de Início para ativar no iPhone.'
              : state === 'denied'
                ? 'Bloqueadas pelo navegador ou sistema.'
                : 'Receba novos cadastros e conclusões mesmo com o app fechado.'}
        </span>

        {message && <small>{message}</small>}

        {enabled && (
          <button
            type="button"
            className="preferenceTextAction"
            onClick={() => void test()}
            disabled={testing}
          >
            <Send size={14} />
            {testing ? 'Enviando...' : 'Enviar teste'}
          </button>
        )}
      </div>

      <button
        type="button"
        className={`rvSwitch ${enabled ? 'on' : ''}`}
        role="switch"
        aria-checked={enabled}
        onClick={() => (enabled ? void disable() : void enable())}
        disabled={busy || !canToggle}
      >
        <span>{enabled && <Check size={12} />}</span>
      </button>
    </div>
  )
}
