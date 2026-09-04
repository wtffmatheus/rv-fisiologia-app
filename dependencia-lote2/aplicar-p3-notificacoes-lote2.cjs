const fs = require('fs')
const path = require('path')

const ROOT = process.cwd()
const ASSETS = path.join(__dirname, 'arquivos-p3-notificacoes')

function read(file) {
  const full = path.join(ROOT, file)
  if (!fs.existsSync(full)) {
    throw new Error(`Arquivo não encontrado: ${file}. Rode este script na raiz.`)
  }
  return fs.readFileSync(full, 'utf8')
}

function write(file, content) {
  const full = path.join(ROOT, file)
  fs.mkdirSync(path.dirname(full), { recursive: true })
  fs.writeFileSync(full, content, 'utf8')
  console.log(`OK: ${file}`)
}

function copy(source, target) {
  const from = path.join(ASSETS, source)
  const to = path.join(ROOT, target)

  if (!fs.existsSync(from)) {
    throw new Error(`Arquivo do pacote não encontrado: ${source}`)
  }

  fs.mkdirSync(path.dirname(to), { recursive: true })

  if (!fs.existsSync(to)) {
    fs.copyFileSync(from, to)
    console.log(`OK: ${target}`)
  } else {
    console.log(`OK: ${target} já existe`)
  }
}

function replaceOnce(content, from, to, label) {
  if (content.includes(to)) {
    console.log(`OK: ${label} já aplicado`)
    return content
  }

  if (!content.includes(from)) {
    throw new Error(`Não encontrei o trecho esperado para: ${label}`)
  }

  console.log(`OK: ${label}`)
  return content.replace(from, to)
}

const migrationName = '20260903230517_admin_notifications_realtime.sql'

copy(
  migrationName,
  `supabase/migrations/${migrationName}`,
)

let admin = read('src/pages/AdminHome.tsx')

admin = replaceOnce(
  admin,
  `  BarChart3,
  BookOpen,
  CalendarDays,
  Check,`,
  `  BarChart3,
  Bell,
  BookOpen,
  CalendarDays,
  Check,
  CheckCheck,`,
  'ícones do sino',
)

admin = replaceOnce(
  admin,
  `  ShieldX,
  UsersRound,
  X,`,
  `  ShieldX,
  Trophy,
  UserPlus,
  UsersRound,
  X,`,
  'ícones das notificações',
)

admin = replaceOnce(
  admin,
  `type StudentFilter = 'all' | 'pending' | 'active' | 'blocked'`,
  `type StudentFilter = 'all' | 'pending' | 'active' | 'blocked'

type AdminNotification = {
  id: number
  kind: 'new_student' | 'program_completed'
  title: string
  message: string
  student_id: string | null
  program_id: number | null
  metadata: Record<string, unknown>
  created_at: string
  read_at: string | null
}`,
  'tipo de notificação',
)

admin = replaceOnce(
  admin,
  `  const [savingStudentId, setSavingStudentId] = useState<string | null>(null)
  const [message, setMessage] = useState('')`,
  `  const [savingStudentId, setSavingStudentId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [notifications, setNotifications] = useState<AdminNotification[]>([])
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [notificationsLoading, setNotificationsLoading] = useState(true)`,
  'estado das notificações',
)

admin = replaceOnce(
  admin,
  `  async function loadData(showLoader = false) {`,
  `  async function loadNotifications() {
    setNotificationsLoading(true)

    const { data, error } = await supabase
      .from('admin_notifications')
      .select(
        'id,kind,title,message,student_id,program_id,metadata,created_at,read_at',
      )
      .order('created_at', { ascending: false })
      .limit(30)

    if (!error) {
      setNotifications((data as AdminNotification[]) ?? [])
    }

    setNotificationsLoading(false)
  }

  async function loadData(showLoader = false) {`,
  'carregamento de notificações',
)

admin = replaceOnce(
  admin,
  `  useEffect(() => {
    loadData(true)
  }, [])

  useEffect(() => {
    writeAdminTab(activeTab, 'replace')
  }, [activeTab])`,
  `  useEffect(() => {
    loadData(true)
  }, [])

  useEffect(() => {
    loadNotifications()

    const channel = supabase
      .channel('rv-admin-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'admin_notifications',
        },
        (payload) => {
          const incoming = payload.new as AdminNotification

          setNotifications((current) => [
            incoming,
            ...current.filter((item) => item.id !== incoming.id),
          ].slice(0, 30))

          if (incoming.kind === 'new_student') {
            loadData(false)
          }
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  useEffect(() => {
    writeAdminTab(activeTab, 'replace')
  }, [activeTab])`,
  'Realtime das notificações',
)

admin = replaceOnce(
  admin,
  `  const activeProgramCount = programs.filter((program) => program.is_active).length`,
  `  const activeProgramCount = programs.filter((program) => program.is_active).length
  const unreadNotificationCount = notifications.filter(
    (notification) => !notification.read_at,
  ).length`,
  'contador de não lidas',
)

admin = replaceOnce(
  admin,
  `  function getAssignment(studentId: string) {`,
  `  async function markNotificationRead(notificationId: number) {
    const notification = notifications.find(
      (item) => item.id === notificationId,
    )

    if (!notification || notification.read_at) return

    const readAt = new Date().toISOString()

    setNotifications((current) =>
      current.map((item) =>
        item.id === notificationId
          ? { ...item, read_at: readAt }
          : item,
      ),
    )

    const { error } = await supabase
      .from('admin_notifications')
      .update({ read_at: readAt })
      .eq('id', notificationId)
      .is('read_at', null)

    if (error) {
      loadNotifications()
    }
  }

  async function markAllNotificationsRead() {
    if (unreadNotificationCount === 0) return

    const readAt = new Date().toISOString()

    setNotifications((current) =>
      current.map((item) =>
        item.read_at ? item : { ...item, read_at: readAt },
      ),
    )

    const { error } = await supabase
      .from('admin_notifications')
      .update({ read_at: readAt })
      .is('read_at', null)

    if (error) {
      loadNotifications()
    }
  }

  function openNotification(notification: AdminNotification) {
    void markNotificationRead(notification.id)
    setNotificationsOpen(false)

    if (notification.kind === 'new_student') {
      setStudentFilter('pending')
      setSelectedStudentId(notification.student_id)
      setActiveTab('students')
    } else {
      setStudentFilter('active')
      setSelectedStudentId(notification.student_id)
      setActiveTab('students')
    }

    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function getAssignment(studentId: string) {`,
  'ações das notificações',
)

admin = replaceOnce(
  admin,
  `          <div className="adminStats">
            <span><strong>{pendingCount}</strong> aguardando</span>
            <span><strong>{activeCount}</strong> ativos</span>
          </div>`,
  `          <div className="adminTopbarActions">
            <div className="adminNotificationWrap">
              <button
                type="button"
                className={
                  unreadNotificationCount > 0
                    ? 'adminNotificationButton hasUnread'
                    : 'adminNotificationButton'
                }
                onClick={() => setNotificationsOpen((current) => !current)}
                aria-label="Notificações"
                aria-expanded={notificationsOpen}
              >
                <Bell size={18} />
                {unreadNotificationCount > 0 && (
                  <span className="adminNotificationBadge">
                    {unreadNotificationCount > 99
                      ? '99+'
                      : unreadNotificationCount}
                  </span>
                )}
              </button>

              {notificationsOpen && (
                <section
                  className="adminNotificationPanel"
                  aria-label="Central de notificações"
                >
                  <header className="adminNotificationHeader">
                    <div>
                      <span>NOTIFICAÇÕES</span>
                      <strong>
                        {unreadNotificationCount
                          ? unreadNotificationCount + ' não lida(s)'
                          : 'Tudo em dia'}
                      </strong>
                    </div>

                    <button
                      type="button"
                      className="adminNotificationReadAll"
                      onClick={() => void markAllNotificationsRead()}
                      disabled={unreadNotificationCount === 0}
                    >
                      <CheckCheck size={15} />
                      Marcar como lidas
                    </button>
                  </header>

                  <div className="adminNotificationList">
                    {notificationsLoading ? (
                      <RvLoadingState
                        compact
                        title="Carregando notificações"
                        text="Buscando os eventos mais recentes."
                      />
                    ) : notifications.length === 0 ? (
                      <RvEmptyState
                        compact
                        kind="search"
                        title="Nenhuma notificação"
                        text="Novos cadastros e conclusões aparecerão aqui."
                      />
                    ) : (
                      notifications.map((notification) => (
                        <button
                          type="button"
                          key={notification.id}
                          className={
                            notification.read_at
                              ? 'adminNotificationItem'
                              : 'adminNotificationItem unread'
                          }
                          onClick={() => openNotification(notification)}
                        >
                          <span className="adminNotificationIcon">
                            {notification.kind === 'new_student' ? (
                              <UserPlus size={17} />
                            ) : (
                              <Trophy size={17} />
                            )}
                          </span>

                          <span className="adminNotificationCopy">
                            <strong>{notification.title}</strong>
                            <span>{notification.message}</span>
                            <time>
                              {formatDateTime(notification.created_at)}
                            </time>
                          </span>

                          {!notification.read_at && (
                            <i className="adminNotificationUnreadDot" />
                          )}
                        </button>
                      ))
                    )}
                  </div>
                </section>
              )}
            </div>

            <div className="adminStats">
              <span><strong>{pendingCount}</strong> aguardando</span>
              <span><strong>{activeCount}</strong> ativos</span>
            </div>
          </div>`,
  'sino e central de notificações',
)

admin = replaceOnce(
  admin,
  `<span>Próximas integrações</span>
              <strong>Notificação de novo cadastro</strong>
              <strong>Pagamento e liberação automática</strong>`,
  `<span>Integrações</span>
              <strong>Notificações em tempo real ativas</strong>
              <strong>Pagamento e liberação automática</strong>`,
  'status das integrações',
)

write('src/pages/AdminHome.tsx', admin)

let css = read('src/feature.css')
const marker = '/* RV_P3_ADMIN_NOTIFICATIONS_LOTE2 */'

if (!css.includes(marker)) {
  css += `

${marker}

.adminTopbarActions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 11px;
}

.adminNotificationWrap {
  position: relative;
  flex: 0 0 auto;
}

.adminNotificationButton {
  position: relative;
  width: 42px;
  height: 42px;
  border: 1px solid var(--border);
  border-radius: 11px;
  background: rgba(6, 24, 55, .76);
  color: #b7c8dc;
  display: grid;
  place-items: center;
}

.adminNotificationButton:hover,
.adminNotificationButton.hasUnread {
  border-color: rgba(35, 200, 191, .34);
  background: rgba(35, 200, 191, .075);
  color: var(--accent);
}

.adminNotificationBadge {
  position: absolute;
  top: -6px;
  right: -7px;
  min-width: 20px;
  height: 20px;
  padding: 0 5px;
  border: 2px solid #061735;
  border-radius: 999px;
  background: var(--accent);
  color: #03252a;
  display: grid;
  place-items: center;
  font-size: 8px;
  font-weight: 900;
  line-height: 1;
}

.adminNotificationPanel {
  position: absolute;
  z-index: 80;
  top: calc(100% + 10px);
  right: 0;
  width: min(400px, calc(100vw - 32px));
  overflow: hidden;
  border: 1px solid var(--border-strong);
  border-radius: 15px;
  background: #051731;
  box-shadow: 0 24px 70px rgba(0, 8, 24, .48);
}

.adminNotificationHeader {
  padding: 15px 16px;
  border-bottom: 1px solid var(--border);
  background:
    radial-gradient(circle at 88% 0%, rgba(35, 200, 191, .07), transparent 34%),
    #071c3c;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.adminNotificationHeader > div {
  min-width: 0;
  display: grid;
  gap: 3px;
}

.adminNotificationHeader > div > span {
  color: var(--accent);
  font-size: 8px;
  font-weight: 850;
  letter-spacing: 1.2px;
}

.adminNotificationHeader > div > strong {
  color: #eef5fc;
  font-size: 12px;
}

.adminNotificationReadAll {
  min-height: 32px;
  padding: 0 9px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: transparent;
  color: #a9bdd4;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 8.5px;
  font-weight: 750;
  white-space: nowrap;
}

.adminNotificationReadAll:hover:not(:disabled) {
  border-color: rgba(35, 200, 191, .3);
  color: var(--accent);
}

.adminNotificationReadAll:disabled {
  opacity: .42;
  cursor: default;
}

.adminNotificationList {
  max-height: 430px;
  overflow-y: auto;
}

.adminNotificationItem {
  position: relative;
  width: 100%;
  min-width: 0;
  padding: 13px 15px;
  border: 0;
  border-bottom: 1px solid rgba(159, 187, 225, .09);
  background: #051731;
  color: inherit;
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr) 8px;
  align-items: flex-start;
  gap: 10px;
  text-align: left;
}

.adminNotificationItem:last-child {
  border-bottom: 0;
}

.adminNotificationItem:hover {
  background: #081f42;
}

.adminNotificationItem.unread {
  background:
    linear-gradient(90deg, rgba(35, 200, 191, .055), transparent 58%),
    #061a39;
}

.adminNotificationItem.unread:hover {
  background:
    linear-gradient(90deg, rgba(35, 200, 191, .085), transparent 62%),
    #082149;
}

.adminNotificationIcon {
  width: 38px;
  height: 38px;
  border: 1px solid rgba(35, 200, 191, .17);
  border-radius: 10px;
  background: rgba(35, 200, 191, .065);
  color: var(--accent);
  display: grid;
  place-items: center;
}

.adminNotificationCopy {
  min-width: 0;
  display: grid;
  gap: 4px;
}

.adminNotificationCopy strong {
  color: #edf5fd;
  font-size: 10.5px;
  line-height: 1.3;
}

.adminNotificationCopy > span {
  color: #879db9;
  font-size: 9px;
  line-height: 1.42;
}

.adminNotificationCopy time {
  margin-top: 2px;
  color: #607999;
  font-size: 8px;
}

.adminNotificationUnreadDot {
  width: 7px;
  height: 7px;
  margin-top: 5px;
  border-radius: 999px;
  background: var(--accent);
  box-shadow: 0 0 0 4px rgba(35, 200, 191, .08);
}

@media (max-width: 900px) {
  .adminTopbarActions {
    width: 100%;
    justify-content: space-between;
  }
}

@media (max-width: 720px) {
  .adminNotificationPanel {
    position: fixed;
    top: calc(72px + env(safe-area-inset-top, 0px));
    left: 12px;
    right: 12px;
    width: auto;
    max-height: calc(100dvh - 92px);
  }

  .adminNotificationList {
    max-height: calc(100dvh - 165px);
  }

  .adminNotificationHeader {
    align-items: flex-start;
    flex-direction: column;
  }

  .adminNotificationReadAll {
    width: 100%;
    justify-content: center;
  }
}
`
  write('src/feature.css', css)
} else {
  console.log('OK: estilos das notificações já aplicados')
}

console.log('')
console.log('P3 lote 2 aplicado.')
console.log('Banco já aplicado: NÃO rode a migration manualmente.')
console.log('Agora rode: npm run build')
