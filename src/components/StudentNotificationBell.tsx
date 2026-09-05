import {
  Bell,
  CheckCheck,
  CircleCheckBig,
  Megaphone,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { RvEmptyState, RvLoadingState } from './PlatformState'
import { useI18n } from '../i18n'

type StudentNotification = {
  id: number
  student_id: string
  kind: 'access_approved' | 'custom'
  title: string
  message: string
  created_at: string
  read_at: string | null
}

export default function StudentNotificationBell({
  studentId,
}: {
  studentId: string
}) {
  const { locale, language } = useI18n()
  const [notifications, setNotifications] = useState<StudentNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [toast, setToast] = useState<StudentNotification | null>(null)

  const labels = {
    'pt-BR': {
      aria: 'Notificações',
      title: 'Notificações',
      allRead: 'Tudo em dia',
      unread: 'não lida(s)',
      markAll: 'Marcar como lidas',
      empty: 'Nenhuma notificação',
      emptyText: 'Avisos e mensagens da RV aparecerão aqui.',
      loading: 'Carregando notificações',
      loadingText: 'Buscando seus avisos mais recentes.',
    },
    en: {
      aria: 'Notifications',
      title: 'Notifications',
      allRead: 'All caught up',
      unread: 'unread',
      markAll: 'Mark all as read',
      empty: 'No notifications',
      emptyText: 'RV alerts and messages will appear here.',
      loading: 'Loading notifications',
      loadingText: 'Fetching your latest alerts.',
    },
    es: {
      aria: 'Notificaciones',
      title: 'Notificaciones',
      allRead: 'Todo al día',
      unread: 'sin leer',
      markAll: 'Marcar como leídas',
      empty: 'Sin notificaciones',
      emptyText: 'Los avisos y mensajes de RV aparecerán aquí.',
      loading: 'Cargando notificaciones',
      loadingText: 'Buscando tus avisos más recientes.',
    },
    'zh-CN': {
      aria: '通知',
      title: '通知',
      allRead: '全部已读',
      unread: '条未读',
      markAll: '全部标为已读',
      empty: '暂无通知',
      emptyText: 'RV 的提醒和消息会显示在这里。',
      loading: '正在加载通知',
      loadingText: '正在获取最新提醒。',
    },
    de: {
      aria: 'Benachrichtigungen',
      title: 'Benachrichtigungen',
      allRead: 'Alles gelesen',
      unread: 'ungelesen',
      markAll: 'Alle als gelesen markieren',
      empty: 'Keine Benachrichtigungen',
      emptyText: 'RV-Hinweise und Nachrichten erscheinen hier.',
      loading: 'Benachrichtigungen werden geladen',
      loadingText: 'Aktuelle Hinweise werden geladen.',
    },
  } as const

  const text = labels[language]

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.read_at).length,
    [notifications],
  )

  async function load() {
    setLoading(true)

    const { data, error } = await supabase
      .from('student_notifications')
      .select('id,student_id,kind,title,message,created_at,read_at')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false })
      .limit(30)

    if (!error) {
      const rows = (data as StudentNotification[]) ?? []
      setNotifications(rows)

      const recentApproval = rows.find(
        (item) =>
          item.kind === 'access_approved' &&
          !item.read_at &&
          Date.now() - new Date(item.created_at).getTime() < 10 * 60 * 1000,
      )

      if (recentApproval) {
        setToast(recentApproval)
      }
    }

    setLoading(false)
  }

  useEffect(() => {
    void load()

    const channel = supabase
      .channel(`rv-student-notifications-${studentId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'student_notifications',
          filter: `student_id=eq.${studentId}`,
        },
        (payload) => {
          const incoming = payload.new as StudentNotification

          setNotifications((current) => [
            incoming,
            ...current.filter((item) => item.id !== incoming.id),
          ].slice(0, 30))

          if (incoming.kind === 'access_approved') {
            setToast(incoming)
          }
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [studentId])

  useEffect(() => {
    if (!toast) return

    const timeout = window.setTimeout(() => {
      setToast(null)
    }, 9000)

    return () => window.clearTimeout(timeout)
  }, [toast?.id])

  useEffect(() => {
    if (!open) return

    function keydown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }

    window.addEventListener('keydown', keydown)
    return () => window.removeEventListener('keydown', keydown)
  }, [open])

  async function markRead(id: number) {
    const now = new Date().toISOString()

    setNotifications((current) =>
      current.map((item) =>
        item.id === id ? { ...item, read_at: item.read_at || now } : item,
      ),
    )

    await supabase.rpc('mark_own_student_notification_read', {
      p_notification_id: id,
    })
  }

  async function markAll() {
    const now = new Date().toISOString()

    setNotifications((current) =>
      current.map((item) => ({
        ...item,
        read_at: item.read_at || now,
      })),
    )

    await supabase.rpc('mark_all_own_student_notifications_read')
  }

  function formatDate(value: string) {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(value))
  }

  return (
    <>
      <div className="studentNotificationWrap">
        <button
          type="button"
          className={
            unreadCount
              ? 'studentNotificationButton hasUnread'
              : 'studentNotificationButton'
          }
          onClick={() => setOpen((current) => !current)}
          aria-label={text.aria}
          aria-expanded={open}
        >
          <Bell size={18} />

          {unreadCount > 0 && (
            <span className="studentNotificationBadge">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        {open && (
          <section
            className="studentNotificationPanel"
            aria-label={text.title}
          >
            <header className="studentNotificationHeader">
              <div>
                <span>{text.title.toUpperCase()}</span>
                <strong>
                  {unreadCount
                    ? `${unreadCount} ${text.unread}`
                    : text.allRead}
                </strong>
              </div>

              <button
                type="button"
                className="studentNotificationReadAll"
                onClick={() => void markAll()}
                disabled={!unreadCount}
              >
                <CheckCheck size={14} />
                {text.markAll}
              </button>

              <button
                type="button"
                className="studentNotificationClose"
                onClick={() => setOpen(false)}
                aria-label="Fechar"
              >
                <X size={15} />
              </button>
            </header>

            <div className="studentNotificationList">
              {loading ? (
                <RvLoadingState
                  compact
                  title={text.loading}
                  text={text.loadingText}
                />
              ) : notifications.length === 0 ? (
                <RvEmptyState
                  compact
                  kind="search"
                  title={text.empty}
                  text={text.emptyText}
                />
              ) : (
                notifications.map((notification) => (
                  <button
                    key={notification.id}
                    type="button"
                    className={
                      notification.read_at
                        ? 'studentNotificationItem'
                        : 'studentNotificationItem unread'
                    }
                    onClick={() => {
                      void markRead(notification.id)
                    }}
                  >
                    <span className="studentNotificationIcon">
                      {notification.kind === 'access_approved' ? (
                        <CircleCheckBig size={17} />
                      ) : (
                        <Megaphone size={17} />
                      )}
                    </span>

                    <span className="studentNotificationCopy">
                      <strong>{notification.title}</strong>
                      <span>{notification.message}</span>
                      <time>{formatDate(notification.created_at)}</time>
                    </span>

                    {!notification.read_at && (
                      <i className="studentNotificationUnreadDot" />
                    )}
                  </button>
                ))
              )}
            </div>
          </section>
        )}
      </div>

      {toast && (
        <div className="studentApprovalToast" role="status">
          <CircleCheckBig size={20} />

          <div>
            <strong>{toast.title}</strong>
            <span>{toast.message}</span>
          </div>

          <button
            type="button"
            onClick={() => {
              void markRead(toast.id)
              setToast(null)
            }}
            aria-label="Fechar"
          >
            <X size={15} />
          </button>
        </div>
      )}
    </>
  )
}
