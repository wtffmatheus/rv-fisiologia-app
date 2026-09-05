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

const copy = {
  'pt-BR': {
    title: 'Notificações no telefone',
    enabled: 'Ativas neste dispositivo',
    ready: 'Receba liberações, avisos e lembretes mesmo com o RV App fechado.',
    install: 'No iPhone, instale o RV App na Tela de Início para ativar notificações.',
    denied: 'As notificações foram bloqueadas pelo navegador ou sistema.',
    unsupported: 'Este navegador não oferece suporte a notificações push.',
    activated: 'Notificações ativadas. Enviamos um teste para confirmar.',
    activationError: 'Não foi possível ativar as notificações neste aparelho.',
    disabled: 'Notificações desativadas neste aparelho.',
    disableError: 'Não foi possível desativar as notificações agora.',
    testSent: 'Teste enviado. Confira a notificação do sistema.',
    testError: 'O teste não foi entregue. Tente novamente.',
    test: 'Enviar teste',
    testing: 'Enviando...',
  },
  en: {
    title: 'Phone notifications',
    enabled: 'Enabled on this device',
    ready: 'Receive approvals, alerts and reminders even when RV App is closed.',
    install: 'On iPhone, add RV App to the Home Screen to enable notifications.',
    denied: 'Notifications were blocked by the browser or system.',
    unsupported: 'This browser does not support push notifications.',
    activated: 'Notifications enabled. We sent a test to confirm.',
    activationError: 'Could not enable notifications on this device.',
    disabled: 'Notifications disabled on this device.',
    disableError: 'Could not disable notifications right now.',
    testSent: 'Test sent. Check your system notification.',
    testError: 'The test was not delivered. Try again.',
    test: 'Send test',
    testing: 'Sending...',
  },
  es: {
    title: 'Notificaciones en el teléfono',
    enabled: 'Activas en este dispositivo',
    ready: 'Recibe liberaciones, avisos y recordatorios incluso con RV App cerrado.',
    install: 'En iPhone, agrega RV App a la pantalla de inicio para activar notificaciones.',
    denied: 'Las notificaciones fueron bloqueadas por el navegador o sistema.',
    unsupported: 'Este navegador no admite notificaciones push.',
    activated: 'Notificaciones activadas. Enviamos una prueba para confirmar.',
    activationError: 'No se pudieron activar las notificaciones en este dispositivo.',
    disabled: 'Notificaciones desactivadas en este dispositivo.',
    disableError: 'No se pudieron desactivar las notificaciones ahora.',
    testSent: 'Prueba enviada. Revisa la notificación del sistema.',
    testError: 'La prueba no fue entregada. Inténtalo de nuevo.',
    test: 'Enviar prueba',
    testing: 'Enviando...',
  },
  'zh-CN': {
    title: '手机通知',
    enabled: '此设备已开启',
    ready: '即使关闭 RV App，也可接收审核、提醒和通知。',
    install: '在 iPhone 上，请先将 RV App 添加到主屏幕以开启通知。',
    denied: '通知已被浏览器或系统阻止。',
    unsupported: '此浏览器不支持推送通知。',
    activated: '通知已开启。我们已发送测试通知进行确认。',
    activationError: '无法在此设备上开启通知。',
    disabled: '此设备的通知已关闭。',
    disableError: '暂时无法关闭通知。',
    testSent: '测试已发送，请查看系统通知。',
    testError: '测试未送达，请重试。',
    test: '发送测试',
    testing: '发送中...',
  },
  de: {
    title: 'Benachrichtigungen auf dem Handy',
    enabled: 'Auf diesem Gerät aktiv',
    ready: 'Erhalte Freigaben, Hinweise und Erinnerungen auch bei geschlossenem RV App.',
    install: 'Auf dem iPhone muss RV App zum Home-Bildschirm hinzugefügt werden.',
    denied: 'Benachrichtigungen wurden vom Browser oder System blockiert.',
    unsupported: 'Dieser Browser unterstützt keine Push-Benachrichtigungen.',
    activated: 'Benachrichtigungen aktiviert. Zur Bestätigung wurde ein Test gesendet.',
    activationError: 'Benachrichtigungen konnten auf diesem Gerät nicht aktiviert werden.',
    disabled: 'Benachrichtigungen auf diesem Gerät deaktiviert.',
    disableError: 'Benachrichtigungen konnten gerade nicht deaktiviert werden.',
    testSent: 'Test gesendet. Prüfe die Systembenachrichtigung.',
    testError: 'Der Test wurde nicht zugestellt. Versuche es erneut.',
    test: 'Test senden',
    testing: 'Wird gesendet...',
  },
} as const

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

export default function StudentPushControl({
  studentId: _studentId,
  compact = false,
}: {
  studentId: string
  compact?: boolean
}) {
  const { language } = useI18n()
  const text = copy[language]
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

    if (!p256dh || !auth) {
      throw new Error('subscription_keys_missing')
    }

    const { error } = await supabase.rpc(
      'register_student_push_subscription',
      {
        p_endpoint: subscription.endpoint,
        p_p256dh: p256dh,
        p_auth: auth,
        p_user_agent: navigator.userAgent,
        p_language: language,
      },
    )

    if (error) throw error
  }

  async function sendTest(silent = false) {
    setTesting(true)
    if (!silent) setMessage('')

    try {
      const { data, error } = await supabase.functions.invoke(
        'student-web-push',
        { body: { action: 'test' } },
      )

      if (error) throw error

      if (data?.sent > 0) {
        setMessage(silent ? text.activated : text.testSent)
      } else {
        setMessage(text.testError)
      }
    } catch (error) {
      console.error('Falha ao testar push do aluno:', error)
      setMessage(text.testError)
    } finally {
      setTesting(false)
    }
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
        return
      }

      await persist(current)
      setState('enabled')
    } catch (error) {
      console.error('Falha ao verificar push do aluno:', error)
      setState('error')
    }
  }

  useEffect(() => {
    void inspect()
  }, [language])

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
      await sendTest(true)
    } catch (error) {
      console.error('Falha ao ativar push do aluno:', error)
      setState('error')
      setMessage(text.activationError)
    }
  }

  async function disable() {
    setState('busy')
    setMessage('')

    try {
      const registration = await navigator.serviceWorker.ready
      const current = await registration.pushManager.getSubscription()

      if (current) {
        const { error } = await supabase.rpc(
          'disable_own_student_push_subscription',
          { p_endpoint: current.endpoint },
        )

        if (error) throw error
        await current.unsubscribe()
      }

      setState('ready')
      setMessage(text.disabled)
    } catch (error) {
      console.error('Falha ao desativar push do aluno:', error)
      setState('error')
      setMessage(text.disableError)
    }
  }

  const enabled = state === 'enabled'
  const busy =
    state === 'busy' ||
    state === 'checking' ||
    testing

  const description =
    enabled
      ? text.enabled
      : state === 'needs_install'
        ? text.install
        : state === 'denied'
          ? text.denied
          : state === 'unsupported'
            ? text.unsupported
            : text.ready

  const canToggle = ![
    'denied',
    'unsupported',
    'needs_install',
  ].includes(state)

  return (
    <div
      className={
        compact
          ? 'studentPushControl compact'
          : 'studentPushControl'
      }
    >
      <div className="studentPushIcon">
        {enabled ? <BellRing size={19} /> : <Smartphone size={19} />}
      </div>

      <div className="studentPushCopy">
        <strong>{text.title}</strong>
        <span>{description}</span>

        {message && <small>{message}</small>}

        {enabled && (
          <button
            type="button"
            className="studentPushTest"
            onClick={() => void sendTest()}
            disabled={testing}
          >
            <Send size={14} />
            {testing ? text.testing : text.test}
          </button>
        )}
      </div>

      <button
        type="button"
        className={`rvSwitch ${enabled ? 'on' : ''}`}
        role="switch"
        aria-checked={enabled}
        onClick={() =>
          enabled ? void disable() : void enable()
        }
        disabled={busy || !canToggle}
        aria-label={text.title}
      >
        <span>{enabled && <Check size={12} />}</span>
      </button>
    </div>
  )
}
