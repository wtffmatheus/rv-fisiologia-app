import {
  Activity,
  BellRing,
  Bluetooth,
  CheckCircle2,
  CircleAlert,
  HeartPulse,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  TimerReset,
  Watch,
  Wifi,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useI18n } from '../i18n'

type WatchConnectionState =
  | 'idle'
  | 'checking'
  | 'limited'
  | 'bridge'
  | 'error'

type WatchCheck = {
  label: string
  detail: string
  ok: boolean
}

type NavigatorWithWatchSupport = Navigator & {
  standalone?: boolean
  bluetooth?: {
    getAvailability?: () => Promise<boolean>
  }
}

type WindowWithWatchBridge = Window & {
  webkit?: {
    messageHandlers?: {
      rvWatch?: {
        postMessage: (payload: unknown) => void
      }
    }
  }
}

type StudentWatchHubProps = {
  studentName: string
  programTitle: string
  progress: number
  completedLessons: number
  totalLessons: number
  nextLesson: {
    number: number
    title: string
    exercises: number
  } | null
}

const wait = (ms: number) =>
  new Promise((resolve) => window.setTimeout(resolve, ms))

export default function StudentWatchHub({
  studentName,
  programTitle,
  progress,
  completedLessons,
  totalLessons,
  nextLesson,
}: StudentWatchHubProps) {
  const { language, locale } = useI18n()
  const [connectionState, setConnectionState] =
    useState<WatchConnectionState>('idle')
  const [checks, setChecks] = useState<WatchCheck[]>([])
  const [attemptedAt, setAttemptedAt] = useState<Date | null>(null)

  const labels = {
    'pt-BR': {
      eyebrow: 'APPLE WATCH',
      title: 'Seu treino, direto no pulso.',
      description:
        'Esta é a central do Apple Watch do RV App. A tela já prepara o fluxo de treino, timers, progresso e sincronização com o iPhone.',
      statusIdle: 'Não conectado',
      statusChecking: 'Procurando conexão',
      statusLimited: 'Ponte nativa necessária',
      statusBridge: 'Ponte iOS detectada',
      statusError: 'Não foi possível verificar',
      tryConnection: 'Tentar conexão',
      retryConnection: 'Tentar novamente',
      checking: 'Verificando iPhone e Watch...',
      connectionTitle: 'Conexão',
      connectionHelp:
        'O RV App web consegue diagnosticar o ambiente, mas o Apple Watch não pode ser pareado diretamente pelo Safari. A conexão completa será feita pela ponte nativa iPhone + watchOS.',
      lastAttempt: 'Última tentativa',
      diagnostics: 'Diagnóstico da conexão',
      secure: 'Conexão segura',
      secureYes: 'HTTPS ativo e pronto para recursos seguros.',
      secureNo: 'Abra o RV App pela URL HTTPS oficial.',
      ios: 'Dispositivo Apple',
      iosYes: 'iPhone/iPad detectado.',
      iosNo: 'Este dispositivo não parece ser iPhone/iPad.',
      pwa: 'RV App instalado',
      pwaYes: 'Executando como app instalado.',
      pwaNo: 'Executando no navegador. A instalação como PWA é recomendada.',
      bluetooth: 'Bluetooth no navegador',
      bluetoothYes: 'API Bluetooth disponível neste navegador.',
      bluetoothNo: 'Safari/iOS não oferece a ponte Bluetooth necessária para o Apple Watch.',
      bridge: 'Ponte iPhone ↔ Watch',
      bridgeYes: 'Ponte nativa detectada. Ping enviado para o app iOS.',
      bridgeNo: 'Ainda não instalada. Esta será a próxima camada nativa do projeto.',
      previewTitle: 'Prévia do Watch',
      previewSubtitle: 'Dados reais do seu programa',
      program: 'Programa',
      progress: 'Progresso',
      next: 'Próxima aula',
      noNext: 'Programa concluído',
      exercises: 'exercícios',
      lessons: 'aulas',
      watchReady: 'Estrutura pronta para sincronizar',
      featuresTitle: 'O que esta área vai controlar',
      featuresText:
        'A interface já está organizada para receber as funções nativas sem mudar a experiência do aluno.',
      workoutTitle: 'Treino no pulso',
      workoutText: 'Aula atual, exercícios, séries e repetições.',
      timerTitle: 'Timer e descanso',
      timerText: 'Cronômetro de série e descanso com feedback no pulso.',
      progressTitle: 'Progresso',
      progressText: 'Concluir série/aula e sincronizar com o RV App.',
      healthTitle: 'Frequência cardíaca',
      healthText: 'Leitura via HealthKit quando o companion nativo estiver ativo.',
      notificationsTitle: 'Notificações',
      notificationsText: 'Avisos da RV e lembretes importantes no Watch.',
      syncTitle: 'Sincronização',
      syncText: 'iPhone e Watch mantendo o mesmo estado do treino.',
      architectureTitle: 'Estado do projeto',
      webReady: 'Interface web/PWA',
      webReadyText: 'Pronta',
      bridgePending: 'Companion iOS/watchOS',
      bridgePendingText: 'Próxima etapa',
      healthPending: 'HealthKit + WatchConnectivity',
      healthPendingText: 'Planejado',
      note:
        'A tentativa acima é real: ela verifica o ambiente e procura a ponte nativa. Não simulamos um Apple Watch conectado quando o navegador não oferece essa conexão.',
    },
    en: {
      eyebrow: 'APPLE WATCH',
      title: 'Your workout, right on your wrist.',
      description:
        'This is the RV App Apple Watch hub. It prepares workout flow, timers, progress and iPhone sync.',
      statusIdle: 'Not connected',
      statusChecking: 'Looking for connection',
      statusLimited: 'Native bridge required',
      statusBridge: 'iOS bridge detected',
      statusError: 'Unable to verify',
      tryConnection: 'Try connection',
      retryConnection: 'Try again',
      checking: 'Checking iPhone and Watch...',
      connectionTitle: 'Connection',
      connectionHelp:
        'The RV web app can diagnose the environment, but Safari cannot pair directly with Apple Watch. Full connection will use a native iPhone + watchOS bridge.',
      lastAttempt: 'Last attempt',
      diagnostics: 'Connection diagnostics',
      secure: 'Secure connection',
      secureYes: 'HTTPS is active.',
      secureNo: 'Open the official RV App HTTPS URL.',
      ios: 'Apple device',
      iosYes: 'iPhone/iPad detected.',
      iosNo: 'This device does not look like an iPhone/iPad.',
      pwa: 'RV App installed',
      pwaYes: 'Running as an installed app.',
      pwaNo: 'Running in browser. PWA installation is recommended.',
      bluetooth: 'Browser Bluetooth',
      bluetoothYes: 'Bluetooth API is available in this browser.',
      bluetoothNo: 'Safari/iOS does not expose the Bluetooth bridge required by Apple Watch.',
      bridge: 'iPhone ↔ Watch bridge',
      bridgeYes: 'Native bridge detected. Ping sent to the iOS app.',
      bridgeNo: 'Not installed yet. This is the next native layer.',
      previewTitle: 'Watch preview',
      previewSubtitle: 'Real data from your program',
      program: 'Program',
      progress: 'Progress',
      next: 'Next lesson',
      noNext: 'Program completed',
      exercises: 'exercises',
      lessons: 'lessons',
      watchReady: 'Structure ready to sync',
      featuresTitle: 'What this area will control',
      featuresText: 'The interface is ready for native features without changing the student experience.',
      workoutTitle: 'Workout on wrist',
      workoutText: 'Current lesson, exercises, sets and reps.',
      timerTitle: 'Timer and rest',
      timerText: 'Set/rest timer with wrist feedback.',
      progressTitle: 'Progress',
      progressText: 'Complete sets/lessons and sync to RV App.',
      healthTitle: 'Heart rate',
      healthText: 'HealthKit data when the native companion is active.',
      notificationsTitle: 'Notifications',
      notificationsText: 'RV alerts and important reminders on Watch.',
      syncTitle: 'Sync',
      syncText: 'iPhone and Watch keeping the same workout state.',
      architectureTitle: 'Project status',
      webReady: 'Web/PWA interface',
      webReadyText: 'Ready',
      bridgePending: 'iOS/watchOS companion',
      bridgePendingText: 'Next step',
      healthPending: 'HealthKit + WatchConnectivity',
      healthPendingText: 'Planned',
      note:
        'The attempt above is real: it checks the environment and looks for the native bridge. We do not fake a connected Apple Watch.',
    },
    es: {
      eyebrow: 'APPLE WATCH',
      title: 'Tu entrenamiento, directo en la muñeca.',
      description:
        'Esta es la central Apple Watch de RV App. Prepara entrenamiento, temporizadores, progreso y sincronización con iPhone.',
      statusIdle: 'Sin conexión',
      statusChecking: 'Buscando conexión',
      statusLimited: 'Se requiere puente nativo',
      statusBridge: 'Puente iOS detectado',
      statusError: 'No se pudo verificar',
      tryConnection: 'Intentar conexión',
      retryConnection: 'Intentar de nuevo',
      checking: 'Verificando iPhone y Watch...',
      connectionTitle: 'Conexión',
      connectionHelp:
        'RV App web puede diagnosticar el entorno, pero Safari no puede emparejar directamente con Apple Watch. La conexión completa usará un puente nativo iPhone + watchOS.',
      lastAttempt: 'Último intento',
      diagnostics: 'Diagnóstico de conexión',
      secure: 'Conexión segura',
      secureYes: 'HTTPS activo.',
      secureNo: 'Abre la URL HTTPS oficial de RV App.',
      ios: 'Dispositivo Apple',
      iosYes: 'iPhone/iPad detectado.',
      iosNo: 'Este dispositivo no parece iPhone/iPad.',
      pwa: 'RV App instalado',
      pwaYes: 'Ejecutándose como app instalada.',
      pwaNo: 'Ejecutándose en navegador. Se recomienda instalar la PWA.',
      bluetooth: 'Bluetooth del navegador',
      bluetoothYes: 'API Bluetooth disponible.',
      bluetoothNo: 'Safari/iOS no ofrece el puente Bluetooth necesario para Apple Watch.',
      bridge: 'Puente iPhone ↔ Watch',
      bridgeYes: 'Puente nativo detectado. Ping enviado a iOS.',
      bridgeNo: 'Aún no instalado. Es la siguiente capa nativa.',
      previewTitle: 'Vista previa del Watch',
      previewSubtitle: 'Datos reales de tu programa',
      program: 'Programa',
      progress: 'Progreso',
      next: 'Próxima clase',
      noNext: 'Programa completado',
      exercises: 'ejercicios',
      lessons: 'clases',
      watchReady: 'Estructura lista para sincronizar',
      featuresTitle: 'Qué controlará esta área',
      featuresText: 'La interfaz está preparada para recibir funciones nativas.',
      workoutTitle: 'Entrenamiento en la muñeca',
      workoutText: 'Clase actual, ejercicios, series y repeticiones.',
      timerTitle: 'Temporizador y descanso',
      timerText: 'Cronómetro con respuesta en la muñeca.',
      progressTitle: 'Progreso',
      progressText: 'Completar series/clases y sincronizar.',
      healthTitle: 'Frecuencia cardíaca',
      healthText: 'HealthKit cuando el companion nativo esté activo.',
      notificationsTitle: 'Notificaciones',
      notificationsText: 'Avisos RV y recordatorios en el Watch.',
      syncTitle: 'Sincronización',
      syncText: 'iPhone y Watch con el mismo estado.',
      architectureTitle: 'Estado del proyecto',
      webReady: 'Interfaz web/PWA',
      webReadyText: 'Lista',
      bridgePending: 'Companion iOS/watchOS',
      bridgePendingText: 'Siguiente etapa',
      healthPending: 'HealthKit + WatchConnectivity',
      healthPendingText: 'Planificado',
      note: 'El intento es real: verifica el entorno y busca el puente nativo. No simulamos un Watch conectado.',
    },
    'zh-CN': {
      eyebrow: 'APPLE WATCH',
      title: '让训练直接出现在手腕上。',
      description: '这是 RV App 的 Apple Watch 中心，用于训练、计时、进度与 iPhone 同步。',
      statusIdle: '未连接',
      statusChecking: '正在查找连接',
      statusLimited: '需要原生桥接',
      statusBridge: '检测到 iOS 桥接',
      statusError: '无法检查',
      tryConnection: '尝试连接',
      retryConnection: '重试',
      checking: '正在检查 iPhone 和 Watch...',
      connectionTitle: '连接',
      connectionHelp: 'Web 版可检查环境，但 Safari 无法直接与 Apple Watch 配对。完整连接需要 iPhone + watchOS 原生桥接。',
      lastAttempt: '上次尝试',
      diagnostics: '连接诊断',
      secure: '安全连接',
      secureYes: 'HTTPS 已启用。',
      secureNo: '请使用 RV App 官方 HTTPS 地址。',
      ios: 'Apple 设备',
      iosYes: '检测到 iPhone/iPad。',
      iosNo: '当前设备似乎不是 iPhone/iPad。',
      pwa: 'RV App 已安装',
      pwaYes: '正在以已安装应用运行。',
      pwaNo: '正在浏览器中运行，建议安装 PWA。',
      bluetooth: '浏览器蓝牙',
      bluetoothYes: '浏览器支持蓝牙 API。',
      bluetoothNo: 'Safari/iOS 不提供 Apple Watch 所需的蓝牙桥接。',
      bridge: 'iPhone ↔ Watch 桥接',
      bridgeYes: '检测到原生桥接，已向 iOS 发送 ping。',
      bridgeNo: '尚未安装，将作为下一阶段原生功能。',
      previewTitle: 'Watch 预览',
      previewSubtitle: '来自当前计划的真实数据',
      program: '计划',
      progress: '进度',
      next: '下一课',
      noNext: '计划已完成',
      exercises: '个练习',
      lessons: '节课',
      watchReady: '同步结构已准备',
      featuresTitle: '此区域将控制的功能',
      featuresText: '界面已经为原生功能做好准备。',
      workoutTitle: '腕上训练',
      workoutText: '当前课程、练习、组数和次数。',
      timerTitle: '计时与休息',
      timerText: '组间与休息计时，并提供腕部反馈。',
      progressTitle: '训练进度',
      progressText: '完成组/课程并同步到 RV App。',
      healthTitle: '心率',
      healthText: '原生 companion 启用后通过 HealthKit 读取。',
      notificationsTitle: '通知',
      notificationsText: '在 Watch 上接收 RV 提醒。',
      syncTitle: '同步',
      syncText: 'iPhone 与 Watch 保持相同训练状态。',
      architectureTitle: '项目状态',
      webReady: 'Web/PWA 界面',
      webReadyText: '已就绪',
      bridgePending: 'iOS/watchOS companion',
      bridgePendingText: '下一步',
      healthPending: 'HealthKit + WatchConnectivity',
      healthPendingText: '已规划',
      note: '上方尝试是真实检查：它会检测环境并寻找原生桥接，不会伪造已连接的 Apple Watch。',
    },
    de: {
      eyebrow: 'APPLE WATCH',
      title: 'Dein Training direkt am Handgelenk.',
      description:
        'Das ist die Apple-Watch-Zentrale der RV App für Training, Timer, Fortschritt und iPhone-Synchronisierung.',
      statusIdle: 'Nicht verbunden',
      statusChecking: 'Verbindung wird gesucht',
      statusLimited: 'Native Bridge erforderlich',
      statusBridge: 'iOS-Bridge erkannt',
      statusError: 'Prüfung nicht möglich',
      tryConnection: 'Verbindung testen',
      retryConnection: 'Erneut versuchen',
      checking: 'iPhone und Watch werden geprüft...',
      connectionTitle: 'Verbindung',
      connectionHelp:
        'Die RV Web-App kann die Umgebung prüfen, Safari kann aber nicht direkt mit der Apple Watch koppeln. Die vollständige Verbindung benötigt eine native iPhone + watchOS Bridge.',
      lastAttempt: 'Letzter Versuch',
      diagnostics: 'Verbindungsdiagnose',
      secure: 'Sichere Verbindung',
      secureYes: 'HTTPS ist aktiv.',
      secureNo: 'Öffne die offizielle HTTPS-URL der RV App.',
      ios: 'Apple-Gerät',
      iosYes: 'iPhone/iPad erkannt.',
      iosNo: 'Dieses Gerät scheint kein iPhone/iPad zu sein.',
      pwa: 'RV App installiert',
      pwaYes: 'Läuft als installierte App.',
      pwaNo: 'Läuft im Browser. PWA-Installation empfohlen.',
      bluetooth: 'Browser-Bluetooth',
      bluetoothYes: 'Bluetooth-API ist verfügbar.',
      bluetoothNo: 'Safari/iOS stellt die benötigte Apple-Watch-Bluetooth-Bridge nicht bereit.',
      bridge: 'iPhone ↔ Watch Bridge',
      bridgeYes: 'Native Bridge erkannt. Ping an iOS gesendet.',
      bridgeNo: 'Noch nicht installiert. Das ist die nächste native Ebene.',
      previewTitle: 'Watch-Vorschau',
      previewSubtitle: 'Echte Daten aus deinem Programm',
      program: 'Programm',
      progress: 'Fortschritt',
      next: 'Nächste Einheit',
      noNext: 'Programm abgeschlossen',
      exercises: 'Übungen',
      lessons: 'Einheiten',
      watchReady: 'Struktur bereit zur Synchronisierung',
      featuresTitle: 'Was dieser Bereich steuern wird',
      featuresText: 'Die Oberfläche ist für native Funktionen vorbereitet.',
      workoutTitle: 'Training am Handgelenk',
      workoutText: 'Aktuelle Einheit, Übungen, Sätze und Wiederholungen.',
      timerTitle: 'Timer und Pause',
      timerText: 'Satz-/Pausentimer mit Feedback am Handgelenk.',
      progressTitle: 'Fortschritt',
      progressText: 'Sätze/Einheiten abschließen und synchronisieren.',
      healthTitle: 'Herzfrequenz',
      healthText: 'HealthKit-Daten sobald der native Companion aktiv ist.',
      notificationsTitle: 'Benachrichtigungen',
      notificationsText: 'RV-Hinweise und Erinnerungen auf der Watch.',
      syncTitle: 'Synchronisierung',
      syncText: 'iPhone und Watch mit demselben Trainingsstatus.',
      architectureTitle: 'Projektstatus',
      webReady: 'Web/PWA-Oberfläche',
      webReadyText: 'Bereit',
      bridgePending: 'iOS/watchOS Companion',
      bridgePendingText: 'Nächster Schritt',
      healthPending: 'HealthKit + WatchConnectivity',
      healthPendingText: 'Geplant',
      note: 'Der Versuch oben ist real: Umgebung und native Bridge werden geprüft. Eine verbundene Watch wird nicht simuliert.',
    },
  } as const

  const text = labels[language]

  const statusLabel = useMemo(() => {
    if (connectionState === 'checking') return text.statusChecking
    if (connectionState === 'limited') return text.statusLimited
    if (connectionState === 'bridge') return text.statusBridge
    if (connectionState === 'error') return text.statusError
    return text.statusIdle
  }, [connectionState, text])

  async function attemptConnection() {
    setConnectionState('checking')
    setChecks([])

    try {
      await wait(650)

      const nav = navigator as NavigatorWithWatchSupport
      const secure = window.isSecureContext
      const ios =
        /iPhone|iPad|iPod/i.test(nav.userAgent) ||
        (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1)

      const standalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        nav.standalone === true

      let bluetoothAvailable = Boolean(nav.bluetooth)

      if (nav.bluetooth?.getAvailability) {
        try {
          bluetoothAvailable = await nav.bluetooth.getAvailability()
        } catch {
          bluetoothAvailable = false
        }
      }

      const bridge =
        (window as WindowWithWatchBridge).webkit?.messageHandlers?.rvWatch

      if (bridge) {
        bridge.postMessage({
          type: 'rv-watch-ping',
          source: 'rv-web-app',
          requestedAt: new Date().toISOString(),
        })
      }

      setChecks([
        {
          label: text.secure,
          detail: secure ? text.secureYes : text.secureNo,
          ok: secure,
        },
        {
          label: text.ios,
          detail: ios ? text.iosYes : text.iosNo,
          ok: ios,
        },
        {
          label: text.pwa,
          detail: standalone ? text.pwaYes : text.pwaNo,
          ok: standalone,
        },
        {
          label: text.bluetooth,
          detail: bluetoothAvailable
            ? text.bluetoothYes
            : text.bluetoothNo,
          ok: bluetoothAvailable,
        },
        {
          label: text.bridge,
          detail: bridge ? text.bridgeYes : text.bridgeNo,
          ok: Boolean(bridge),
        },
      ])

      setAttemptedAt(new Date())
      setConnectionState(bridge ? 'bridge' : 'limited')
    } catch (error) {
      console.error('Falha no diagnóstico Apple Watch:', error)
      setAttemptedAt(new Date())
      setConnectionState('error')
    }
  }

  const features = [
    {
      icon: <Activity size={19} />,
      title: text.workoutTitle,
      detail: text.workoutText,
    },
    {
      icon: <TimerReset size={19} />,
      title: text.timerTitle,
      detail: text.timerText,
    },
    {
      icon: <CheckCircle2 size={19} />,
      title: text.progressTitle,
      detail: text.progressText,
    },
    {
      icon: <HeartPulse size={19} />,
      title: text.healthTitle,
      detail: text.healthText,
    },
    {
      icon: <BellRing size={19} />,
      title: text.notificationsTitle,
      detail: text.notificationsText,
    },
    {
      icon: <RefreshCw size={19} />,
      title: text.syncTitle,
      detail: text.syncText,
    },
  ]

  return (
    <section className="rvWatchPage" data-rv-watch-hub="v15">
      <section className="rvWatchHero">
        <div className="rvWatchHeroCopy">
          <span className="rvWatchEyebrow">
            <Watch size={15} />
            {text.eyebrow}
          </span>

          <h1>{text.title}</h1>
          <p>{text.description}</p>

          <div className={`rvWatchConnectionState state-${connectionState}`}>
            <span className="rvWatchConnectionDot" />
            <strong>{statusLabel}</strong>
          </div>

          <button
            type="button"
            className="rvWatchConnectButton"
            onClick={() => void attemptConnection()}
            disabled={connectionState === 'checking'}
          >
            {connectionState === 'checking' ? (
              <RefreshCw className="rvWatchSpin" size={17} />
            ) : (
              <Wifi size={17} />
            )}
            {connectionState === 'checking'
              ? text.checking
              : attemptedAt
                ? text.retryConnection
                : text.tryConnection}
          </button>

          {attemptedAt && (
            <small className="rvWatchAttemptTime">
              {text.lastAttempt}:{' '}
              {new Intl.DateTimeFormat(locale, {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              }).format(attemptedAt)}
            </small>
          )}
        </div>

        <div className="rvWatchPreviewWrap">
          <div className="rvWatchDevice">
            <div className="rvWatchDeviceCrown" />
            <div className="rvWatchDeviceScreen">
              <div className="rvWatchDeviceTop">
                <span>RV</span>
                <Watch size={15} />
              </div>

              <small>{studentName}</small>
              <strong>{nextLesson?.title || text.noNext}</strong>

              <div className="rvWatchDeviceProgress">
                <span style={{ width: `${progress}%` }} />
              </div>

              <div className="rvWatchDeviceMetrics">
                <span>{progress}%</span>
                <span>
                  {completedLessons}/{totalLessons}
                </span>
              </div>

              <div className="rvWatchDeviceAction">
                <Activity size={14} />
                {nextLesson
                  ? `${String(nextLesson.number).padStart(2, '0')} · ${nextLesson.exercises} ${text.exercises}`
                  : text.watchReady}
              </div>
            </div>
          </div>

          <div className="rvWatchPreviewCopy">
            <span>{text.previewSubtitle}</span>
            <strong>{text.previewTitle}</strong>
          </div>
        </div>
      </section>

      <section className="rvWatchDataGrid">
        <article>
          <span>{text.program}</span>
          <strong>{programTitle}</strong>
        </article>

        <article>
          <span>{text.progress}</span>
          <strong>{progress}%</strong>
        </article>

        <article>
          <span>{text.next}</span>
          <strong>
            {nextLesson
              ? `${String(nextLesson.number).padStart(2, '0')} · ${nextLesson.title}`
              : text.noNext}
          </strong>
        </article>

        <article>
          <span>{text.lessons}</span>
          <strong>
            {completedLessons}/{totalLessons}
          </strong>
        </article>
      </section>

      <section className="rvWatchConnectionCard">
        <div className="rvWatchSectionHead">
          <div>
            <span>{text.connectionTitle}</span>
            <h2>{text.diagnostics}</h2>
          </div>
          <ShieldCheck size={22} />
        </div>

        <p className="rvWatchConnectionHelp">
          {text.connectionHelp}
        </p>

        {checks.length > 0 ? (
          <div className="rvWatchChecks">
            {checks.map((check) => (
              <div
                key={check.label}
                className={check.ok ? 'is-ok' : 'is-pending'}
              >
                <span className="rvWatchCheckIcon">
                  {check.ok ? (
                    <CheckCircle2 size={17} />
                  ) : (
                    <CircleAlert size={17} />
                  )}
                </span>
                <span>
                  <strong>{check.label}</strong>
                  <small>{check.detail}</small>
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="rvWatchChecksPlaceholder">
            <Bluetooth size={20} />
            <span>{text.connectionHelp}</span>
          </div>
        )}
      </section>

      <section className="rvWatchFeaturesSection">
        <div className="rvWatchSectionHead">
          <div>
            <span>RV WATCH</span>
            <h2>{text.featuresTitle}</h2>
          </div>
          <Smartphone size={22} />
        </div>

        <p>{text.featuresText}</p>

        <div className="rvWatchFeatureGrid">
          {features.map((feature) => (
            <article key={feature.title}>
              <span className="rvWatchFeatureIcon">
                {feature.icon}
              </span>
              <strong>{feature.title}</strong>
              <p>{feature.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rvWatchArchitecture">
        <div className="rvWatchSectionHead">
          <div>
            <span>ROADMAP</span>
            <h2>{text.architectureTitle}</h2>
          </div>
        </div>

        <div className="rvWatchRoadmapList">
          <div className="done">
            <span />
            <strong>{text.webReady}</strong>
            <small>{text.webReadyText}</small>
          </div>
          <div>
            <span />
            <strong>{text.bridgePending}</strong>
            <small>{text.bridgePendingText}</small>
          </div>
          <div>
            <span />
            <strong>{text.healthPending}</strong>
            <small>{text.healthPendingText}</small>
          </div>
        </div>

        <p className="rvWatchTruthNote">
          <ShieldCheck size={16} />
          {text.note}
        </p>
      </section>
    </section>
  )
}
