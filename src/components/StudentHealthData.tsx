import {
  Activity,
  Check,
  Clock3,
  Copy,
  Flame,
  Footprints,
  HeartPulse,
  KeyRound,
  RefreshCw,
  Route,
  ShieldCheck,
  TimerReset,
  Watch,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useI18n } from '../i18n'

type WorkoutSession = {
  id: string
  student_id: string
  source: string
  workout_type: string
  planned_duration_minutes: number | null
  started_at: string
  ended_at: string | null
  status: 'active' | 'completed' | 'cancelled'
  last_synced_at: string | null
  created_at: string
  updated_at: string
}

type Sample = {
  id: string
  student_id: string
  workout_session_id: string | null
  source: string
  metric: string
  value: number
  unit: string
  measured_at: string
  received_at: string
}

type IngestStatus = {
  configured: boolean
  last_used_at?: string | null
}

type Stats = {
  count: number
  min: number
  max: number
  avg: number
  sum: number
  unit: string
}

const OFFICIAL_SHORTCUT =
  'https://www.icloud.com/shortcuts/7f89138a88834de78d0a256ba0418c5b'

const SHORTCUT_SYNC =
  'shortcuts://run-shortcut?name=RV%20-%20Sincronizar%20Sa%C3%BAde&input=text&text=sync'

const ENDPOINT =
  'https://ilnlnkcxajkarwviynbm.supabase.co/functions/v1/health-ingest'

function statsFor(samples: Sample[], metric: string): Stats | null {
  const rows = samples.filter((item) => item.metric === metric)
  if (!rows.length) return null

  const values = rows.map((item) => Number(item.value)).filter(Number.isFinite)
  if (!values.length) return null

  const sum = values.reduce((total, value) => total + value, 0)

  return {
    count: values.length,
    min: Math.min(...values),
    max: Math.max(...values),
    avg: sum / values.length,
    sum,
    unit: rows[0]?.unit || '',
  }
}

function Sparkline({
  samples,
  empty,
}: {
  samples: Sample[]
  empty: string
}) {
  const values = samples
    .filter((item) => item.metric === 'heart_rate')
    .sort(
      (a, b) =>
        new Date(a.measured_at).getTime() - new Date(b.measured_at).getTime(),
    )

  if (values.length < 2) {
    return <div className="rvWorkoutChartEmpty">{empty}</div>
  }

  const width = 640
  const height = 180
  const padding = 14
  const numbers = values.map((item) => Number(item.value))
  const min = Math.min(...numbers)
  const max = Math.max(...numbers)
  const span = Math.max(1, max - min)

  const points = values
    .map((item, index) => {
      const x =
        padding +
        (index / Math.max(1, values.length - 1)) * (width - padding * 2)
      const y =
        height -
        padding -
        ((Number(item.value) - min) / span) * (height - padding * 2)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  return (
    <div className="rvWorkoutChart">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Heart rate chart"
        preserveAspectRatio="none"
      >
        <polyline points={points} fill="none" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="rvWorkoutChartScale">
        <span>{Math.round(max)} bpm</span>
        <span>{Math.round(min)} bpm</span>
      </div>
    </div>
  )
}

export default function StudentHealthData({
  studentId,
}: {
  studentId: string
}) {
  const { language, locale } = useI18n()
  const [sessions, setSessions] = useState<WorkoutSession[]>([])
  const [samples, setSamples] = useState<Sample[]>([])
  const [status, setStatus] = useState<IngestStatus>({ configured: false })
  const [token, setToken] = useState('')
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [, setTick] = useState(0)

  const text = {
    'pt-BR': {
      eyebrow: 'MONITORAMENTO DE TREINO',
      title: 'Sessões do Apple Watch',
      subtitle:
        'O Watch mede continuamente. O RV organiza as leituras por treino, calcula variação, médias e mantém o histórico.',
      active: 'Treino em andamento',
      noneActive: 'Nenhum treino em andamento',
      noneActiveText:
        'Quando um exercício começar no Apple Watch, a automação do iPhone poderá abrir a sessão no RV.',
      started: 'Iniciado',
      planned: 'Previsto',
      elapsed: 'Decorrido',
      lastUpdate: 'Última atualização',
      waiting: 'Aguardando dados',
      update: 'Atualizar dados agora',
      liveHint:
        'Durante o treino, novas remessas aparecem aqui automaticamente. No fim, o atalho faz uma conferência completa da sessão.',
      bpmRange: 'Variação de BPM',
      average: 'Média',
      minimum: 'Mínima',
      maximum: 'Máxima',
      calories: 'Calorias ativas',
      steps: 'Passos',
      distance: 'Distância',
      hrv: 'VFC',
      respiratory: 'Respiração',
      oxygen: 'Oxigenação',
      recovery: 'Recuperação',
      recoveryText: 'queda após o fim',
      history: 'Histórico de treinos',
      historyText:
        'Cada treino fica separado por data e horário, com todas as medições daquele período.',
      noHistory: 'Ainda não há sessões de treino registradas.',
      open: 'Ver treino',
      duration: 'Duração',
      samples: 'leituras',
      detail: 'Resumo da sessão',
      chart: 'Frequência cardíaca durante o treino',
      chartEmpty: 'O gráfico aparece após receber pelo menos duas leituras de BPM.',
      noMetric: 'Sem dados',
      setup: 'Conectar Apple Saúde',
      setupText:
        'A conexão é feita pelo Apple Saúde + Atalhos. Não existe pareamento direto do RV com o Apple Watch.',
      configured: 'Integração verificada',
      configuredPending: 'Código criado · aguardando primeiro envio',
      notConfigured: 'Integração ainda não configurada',
      create: 'Criar e copiar código',
      newCode: 'Criar novo código',
      copied: 'Código copiado',
      install: 'Instalar Atalho RV',
      syncTest: 'Testar envio',
      disconnect: 'Desconectar',
      key: 'Código de conexão',
      advanced: 'Avançado',
      flow: 'Fluxo automático recomendado',
      flow1: 'Início do exercício',
      flow1Text: 'O iPhone pergunta quanto tempo o treino deve durar e abre uma sessão.',
      flow2: 'Durante o treino',
      flow2Text: 'O Watch continua medindo e o atalho tenta enviar novos dados em blocos.',
      flow3: 'Fim do exercício',
      flow3Text: 'O atalho confere todo o período, inclui recuperação e fecha a sessão.',
      flow4: 'Histórico RV',
      flow4Text: 'O RV calcula mínimo, média, máximo e demais métricas por sessão.',
      activeBadge: 'AO VIVO',
      completed: 'Concluído',
      cancelled: 'Cancelado',
      minutes: 'min',
      integrationNote:
        'A automação de início/fim será configurada no mesmo Atalho RV. O banco e a tela já estão preparados para receber as sessões.',
    },
    en: {
      eyebrow: 'WORKOUT MONITORING',
      title: 'Apple Watch sessions',
      subtitle:
        'Watch measures continuously. RV groups readings by workout, calculates ranges, averages and keeps the history.',
      active: 'Workout in progress',
      noneActive: 'No workout in progress',
      noneActiveText: 'When a Watch workout starts, iPhone automation can open a session in RV.',
      started: 'Started',
      planned: 'Planned',
      elapsed: 'Elapsed',
      lastUpdate: 'Last update',
      waiting: 'Waiting for data',
      update: 'Update data now',
      liveHint: 'New batches appear automatically. At the end, the shortcut performs a full session check.',
      bpmRange: 'BPM range',
      average: 'Average',
      minimum: 'Minimum',
      maximum: 'Maximum',
      calories: 'Active calories',
      steps: 'Steps',
      distance: 'Distance',
      hrv: 'HRV',
      respiratory: 'Respiration',
      oxygen: 'Oxygen',
      recovery: 'Recovery',
      recoveryText: 'drop after ending',
      history: 'Workout history',
      historyText: 'Each workout is stored separately with all measurements from that period.',
      noHistory: 'No workout sessions recorded yet.',
      open: 'View workout',
      duration: 'Duration',
      samples: 'readings',
      detail: 'Session summary',
      chart: 'Heart rate during workout',
      chartEmpty: 'The chart appears after at least two BPM readings.',
      noMetric: 'No data',
      setup: 'Connect Apple Health',
      setupText: 'Connection uses Apple Health + Shortcuts. RV does not directly pair with Apple Watch.',
      configured: 'Integration verified',
      configuredPending: 'Code created · waiting for first upload',
      notConfigured: 'Integration not configured',
      create: 'Create and copy code',
      newCode: 'Create new code',
      copied: 'Code copied',
      install: 'Install RV Shortcut',
      syncTest: 'Test upload',
      disconnect: 'Disconnect',
      key: 'Connection code',
      advanced: 'Advanced',
      flow: 'Recommended automatic flow',
      flow1: 'Workout starts',
      flow1Text: 'iPhone asks the planned duration and opens an RV session.',
      flow2: 'During workout',
      flow2Text: 'Watch keeps measuring and Shortcut attempts batch uploads.',
      flow3: 'Workout ends',
      flow3Text: 'Shortcut checks the full period, includes recovery and closes the session.',
      flow4: 'RV history',
      flow4Text: 'RV calculates minimum, average, maximum and other metrics per session.',
      activeBadge: 'LIVE',
      completed: 'Completed',
      cancelled: 'Cancelled',
      minutes: 'min',
      integrationNote: 'Start/end automation will use the same RV Shortcut. Database and UI are ready.',
    },
    es: {
      eyebrow: 'MONITOREO DE ENTRENAMIENTO',
      title: 'Sesiones del Apple Watch',
      subtitle: 'Watch mide continuamente. RV agrupa las lecturas por entrenamiento y mantiene el historial.',
      active: 'Entrenamiento en curso',
      noneActive: 'Ningún entrenamiento en curso',
      noneActiveText: 'Cuando comience un ejercicio en Apple Watch, la automatización puede abrir una sesión en RV.',
      started: 'Inicio',
      planned: 'Previsto',
      elapsed: 'Transcurrido',
      lastUpdate: 'Última actualización',
      waiting: 'Esperando datos',
      update: 'Actualizar datos ahora',
      liveHint: 'Nuevos lotes aparecen automáticamente y al final se revisa toda la sesión.',
      bpmRange: 'Variación de BPM',
      average: 'Media',
      minimum: 'Mínima',
      maximum: 'Máxima',
      calories: 'Calorías activas',
      steps: 'Pasos',
      distance: 'Distancia',
      hrv: 'VFC',
      respiratory: 'Respiración',
      oxygen: 'Oxigenación',
      recovery: 'Recuperación',
      recoveryText: 'caída después del final',
      history: 'Historial de entrenamientos',
      historyText: 'Cada entrenamiento queda separado por fecha y hora.',
      noHistory: 'Todavía no hay sesiones registradas.',
      open: 'Ver entrenamiento',
      duration: 'Duración',
      samples: 'lecturas',
      detail: 'Resumen de sesión',
      chart: 'Frecuencia cardíaca durante el entrenamiento',
      chartEmpty: 'El gráfico aparece con al menos dos lecturas de BPM.',
      noMetric: 'Sin datos',
      setup: 'Conectar Apple Salud',
      setupText: 'La conexión usa Apple Salud + Atajos. RV no empareja directamente con Apple Watch.',
      configured: 'Integración verificada',
      configuredPending: 'Código creado · esperando primer envío',
      notConfigured: 'Integración no configurada',
      create: 'Crear y copiar código',
      newCode: 'Crear nuevo código',
      copied: 'Código copiado',
      install: 'Instalar Atajo RV',
      syncTest: 'Probar envío',
      disconnect: 'Desconectar',
      key: 'Código de conexión',
      advanced: 'Avanzado',
      flow: 'Flujo automático recomendado',
      flow1: 'Inicio del ejercicio',
      flow1Text: 'El iPhone pregunta la duración prevista y abre una sesión.',
      flow2: 'Durante el entrenamiento',
      flow2Text: 'Watch sigue midiendo y el atajo intenta enviar nuevos datos.',
      flow3: 'Fin del ejercicio',
      flow3Text: 'El atajo revisa todo el período, incluye recuperación y cierra la sesión.',
      flow4: 'Historial RV',
      flow4Text: 'RV calcula mínimo, media, máximo y otras métricas.',
      activeBadge: 'EN VIVO',
      completed: 'Completado',
      cancelled: 'Cancelado',
      minutes: 'min',
      integrationNote: 'La automatización de inicio/fin usará el mismo Atajo RV. La base y la interfaz ya están listas.',
    },
    'zh-CN': {
      eyebrow: '训练监测',
      title: 'Apple Watch 训练记录',
      subtitle: 'Watch 持续测量，RV 按训练分组并计算范围、平均值与历史记录。',
      active: '训练进行中',
      noneActive: '当前没有训练',
      noneActiveText: 'Apple Watch 开始训练时，iPhone 自动化可以在 RV 中创建训练会话。',
      started: '开始',
      planned: '计划',
      elapsed: '已用',
      lastUpdate: '最近更新',
      waiting: '等待数据',
      update: '立即更新数据',
      liveHint: '训练中会显示新的批次，结束时快捷指令会再次核对完整会话。',
      bpmRange: '心率范围',
      average: '平均',
      minimum: '最低',
      maximum: '最高',
      calories: '活动卡路里',
      steps: '步数',
      distance: '距离',
      hrv: 'HRV',
      respiratory: '呼吸',
      oxygen: '血氧',
      recovery: '恢复',
      recoveryText: '结束后的下降',
      history: '训练历史',
      historyText: '每次训练按日期和时间单独保存。',
      noHistory: '暂无训练会话。',
      open: '查看训练',
      duration: '时长',
      samples: '条读数',
      detail: '会话摘要',
      chart: '训练期间心率',
      chartEmpty: '至少收到两条心率读数后显示图表。',
      noMetric: '无数据',
      setup: '连接 Apple 健康',
      setupText: '连接通过 Apple 健康 + 快捷指令完成，RV 不直接配对 Apple Watch。',
      configured: '集成已验证',
      configuredPending: '已创建代码 · 等待首次上传',
      notConfigured: '尚未配置集成',
      create: '创建并复制代码',
      newCode: '创建新代码',
      copied: '代码已复制',
      install: '安装 RV 快捷指令',
      syncTest: '测试上传',
      disconnect: '断开连接',
      key: '连接代码',
      advanced: '高级',
      flow: '推荐自动流程',
      flow1: '训练开始',
      flow1Text: 'iPhone 询问计划时长并创建 RV 会话。',
      flow2: '训练期间',
      flow2Text: 'Watch 持续测量，快捷指令尝试分批发送。',
      flow3: '训练结束',
      flow3Text: '快捷指令核对完整时段、包含恢复数据并关闭会话。',
      flow4: 'RV 历史',
      flow4Text: 'RV 按会话计算最低、平均、最高及其他指标。',
      activeBadge: '实时',
      completed: '已完成',
      cancelled: '已取消',
      minutes: '分钟',
      integrationNote: '开始/结束自动化将使用同一个 RV 快捷指令。数据库与界面已就绪。',
    },
    de: {
      eyebrow: 'TRAININGSÜBERWACHUNG',
      title: 'Apple-Watch-Trainings',
      subtitle: 'Die Watch misst kontinuierlich. RV gruppiert Messwerte pro Training und berechnet Verlauf und Mittelwerte.',
      active: 'Training läuft',
      noneActive: 'Kein Training aktiv',
      noneActiveText: 'Wenn ein Watch-Training startet, kann die iPhone-Automation eine RV-Sitzung öffnen.',
      started: 'Gestartet',
      planned: 'Geplant',
      elapsed: 'Vergangen',
      lastUpdate: 'Letztes Update',
      waiting: 'Warte auf Daten',
      update: 'Daten jetzt aktualisieren',
      liveHint: 'Neue Datenblöcke erscheinen automatisch; am Ende wird die Sitzung vollständig geprüft.',
      bpmRange: 'BPM-Bereich',
      average: 'Mittel',
      minimum: 'Minimum',
      maximum: 'Maximum',
      calories: 'Aktive Kalorien',
      steps: 'Schritte',
      distance: 'Distanz',
      hrv: 'HRV',
      respiratory: 'Atmung',
      oxygen: 'Sauerstoff',
      recovery: 'Erholung',
      recoveryText: 'Abfall nach Ende',
      history: 'Trainingsverlauf',
      historyText: 'Jedes Training wird nach Datum und Uhrzeit getrennt gespeichert.',
      noHistory: 'Noch keine Trainingssitzungen.',
      open: 'Training ansehen',
      duration: 'Dauer',
      samples: 'Messwerte',
      detail: 'Sitzungsübersicht',
      chart: 'Herzfrequenz während des Trainings',
      chartEmpty: 'Das Diagramm erscheint ab zwei BPM-Messungen.',
      noMetric: 'Keine Daten',
      setup: 'Apple Health verbinden',
      setupText: 'Die Verbindung nutzt Apple Health + Kurzbefehle. RV koppelt die Watch nicht direkt.',
      configured: 'Integration geprüft',
      configuredPending: 'Code erstellt · wartet auf ersten Upload',
      notConfigured: 'Integration nicht eingerichtet',
      create: 'Code erstellen und kopieren',
      newCode: 'Neuen Code erstellen',
      copied: 'Code kopiert',
      install: 'RV-Kurzbefehl installieren',
      syncTest: 'Upload testen',
      disconnect: 'Trennen',
      key: 'Verbindungscode',
      advanced: 'Erweitert',
      flow: 'Empfohlener automatischer Ablauf',
      flow1: 'Training startet',
      flow1Text: 'Das iPhone fragt die geplante Dauer und öffnet eine Sitzung.',
      flow2: 'Während des Trainings',
      flow2Text: 'Die Watch misst weiter und der Kurzbefehl versucht Block-Uploads.',
      flow3: 'Training endet',
      flow3Text: 'Der Kurzbefehl prüft den gesamten Zeitraum, Erholung inklusive, und schließt die Sitzung.',
      flow4: 'RV-Verlauf',
      flow4Text: 'RV berechnet Minimum, Mittelwert, Maximum und weitere Metriken pro Sitzung.',
      activeBadge: 'LIVE',
      completed: 'Abgeschlossen',
      cancelled: 'Abgebrochen',
      minutes: 'Min',
      integrationNote: 'Start-/End-Automation nutzt denselben RV-Kurzbefehl. Datenbank und UI sind bereit.',
    },
  } as const

  const t = text[language]
  const storageKey = `rv_health_setup_token_${studentId}`

  async function load() {
    const [sessionsResult, samplesResult, statusResult] = await Promise.all([
      supabase
        .from('workout_sessions')
        .select(
          'id,student_id,source,workout_type,planned_duration_minutes,started_at,ended_at,status,last_synced_at,created_at,updated_at',
        )
        .eq('student_id', studentId)
        .order('started_at', { ascending: false })
        .limit(24),
      supabase
        .from('health_samples')
        .select(
          'id,student_id,workout_session_id,source,metric,value,unit,measured_at,received_at',
        )
        .eq('student_id', studentId)
        .not('workout_session_id', 'is', null)
        .order('measured_at', { ascending: false })
        .limit(3500),
      supabase.rpc('get_own_health_ingest_status'),
    ])

    if (!sessionsResult.error) {
      setSessions((sessionsResult.data as WorkoutSession[]) ?? [])
    }
    if (!samplesResult.error) {
      setSamples((samplesResult.data as Sample[]) ?? [])
    }
    if (!statusResult.error && statusResult.data) {
      const next = statusResult.data as IngestStatus
      setStatus(next)
      if (next.last_used_at) {
        setToken('')
        try {
          window.localStorage.removeItem(storageKey)
        } catch {
          // Storage pode estar indisponível.
        }
      }
    }

    setLoading(false)
  }

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey)
      if (saved) setToken(saved)
    } catch {
      // Mantém o fluxo sem armazenamento local.
    }

    void load()

    const channel = supabase
      .channel(`rv-workout-sessions-${studentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'workout_sessions',
          filter: `student_id=eq.${studentId}`,
        },
        (payload) => {
          const next = payload.new as WorkoutSession
          if (!next?.id) return
          setSessions((current) => {
            const merged = [next, ...current.filter((item) => item.id !== next.id)]
            return merged
              .sort(
                (a, b) =>
                  new Date(b.started_at).getTime() -
                  new Date(a.started_at).getTime(),
              )
              .slice(0, 24)
          })
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'health_samples',
          filter: `student_id=eq.${studentId}`,
        },
        (payload) => {
          const next = payload.new as Sample
          if (!next?.id || !next.workout_session_id) return
          setSamples((current) =>
            [next, ...current.filter((item) => item.id !== next.id)].slice(
              0,
              3500,
            ),
          )
        },
      )
      .subscribe()

    const visible = () => {
      if (document.visibilityState === 'visible') void load()
    }

    document.addEventListener('visibilitychange', visible)
    window.addEventListener('pageshow', visible)

    return () => {
      document.removeEventListener('visibilitychange', visible)
      window.removeEventListener('pageshow', visible)
      void supabase.removeChannel(channel)
    }
  }, [studentId])

  useEffect(() => {
    const timer = window.setInterval(() => setTick((value) => value + 1), 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (selectedId && sessions.some((item) => item.id === selectedId)) return
    const preferred =
      sessions.find((item) => item.status === 'active') ??
      sessions.find((item) => item.status === 'completed') ??
      sessions[0]
    setSelectedId(preferred?.id ?? null)
  }, [sessions, selectedId])

  const activeSession =
    sessions.find((item) => item.status === 'active') ?? null

  const selectedSession =
    sessions.find((item) => item.id === selectedId) ?? null

  const samplesBySession = useMemo(() => {
    const map = new Map<string, Sample[]>()
    for (const sample of samples) {
      if (!sample.workout_session_id) continue
      const list = map.get(sample.workout_session_id) ?? []
      list.push(sample)
      map.set(sample.workout_session_id, list)
    }
    return map
  }, [samples])

  function sessionSamples(session: WorkoutSession | null) {
    if (!session) return []
    return samplesBySession.get(session.id) ?? []
  }

  function workoutHeartSamples(session: WorkoutSession | null) {
    const rows = sessionSamples(session).filter(
      (item) => item.metric === 'heart_rate',
    )
    if (!session?.ended_at) return rows

    const end = new Date(session.ended_at).getTime()
    return rows.filter((item) => new Date(item.measured_at).getTime() <= end)
  }

  function recoverySamples(session: WorkoutSession | null) {
    if (!session?.ended_at) return []
    const end = new Date(session.ended_at).getTime()
    return sessionSamples(session)
      .filter(
        (item) =>
          item.metric === 'heart_rate' &&
          new Date(item.measured_at).getTime() > end &&
          new Date(item.measured_at).getTime() <= end + 3 * 60 * 1000,
      )
      .sort(
        (a, b) =>
          new Date(a.measured_at).getTime() -
          new Date(b.measured_at).getTime(),
      )
  }

  function fmtDate(value: string) {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(value))
  }

  function sessionTitle(session: WorkoutSession) {
    const date = new Intl.DateTimeFormat(locale, {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(session.started_at))

    return `${t.detail} · ${date}`
  }

  function workoutName(value: string) {
    return value
      .replaceAll('_', ' ')
      .replace(/\b\w/g, (letter) => letter.toUpperCase())
  }

  function duration(session: WorkoutSession, live = false) {
    const start = new Date(session.started_at).getTime()
    const end = session.ended_at
      ? new Date(session.ended_at).getTime()
      : live
        ? Date.now()
        : start
    const totalSeconds = Math.max(0, Math.round((end - start) / 1000))
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60

    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, '0')}:${String(
        seconds,
      ).padStart(2, '0')}`
    }

    return `${minutes}:${String(seconds).padStart(2, '0')}`
  }

  function metricValue(
    session: WorkoutSession,
    metric: string,
    mode: 'avg' | 'sum' = 'avg',
    digits = 0,
  ) {
    const stats = statsFor(sessionSamples(session), metric)
    if (!stats) return t.noMetric
    const value = mode === 'sum' ? stats.sum : stats.avg
    return `${value.toFixed(digits)} ${stats.unit}`
  }

  async function rotate() {
    setBusy(true)
    const { data, error } = await supabase.rpc(
      'rotate_own_health_ingest_token',
      { p_label: 'iPhone / Atalhos' },
    )

    if (!error && data) {
      const next = String((data as { token?: string }).token || '')
      setToken(next)
      setStatus({ configured: true, last_used_at: null })

      if (next) {
        try {
          window.localStorage.setItem(storageKey, next)
        } catch {
          // Código continua disponível na tela.
        }

        try {
          await navigator.clipboard.writeText(next)
          setCopied(true)
          window.setTimeout(() => setCopied(false), 1800)
        } catch {
          // Botão copiar continua disponível.
        }
      }
    }

    setBusy(false)
  }

  async function copyToken() {
    if (!token) return
    await navigator.clipboard.writeText(token)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  async function revoke() {
    setBusy(true)
    const { error } = await supabase.rpc('revoke_own_health_ingest_token')

    if (!error) {
      setStatus({ configured: false })
      setToken('')
      try {
        window.localStorage.removeItem(storageKey)
      } catch {
        // Nada a fazer.
      }
    }

    setBusy(false)
  }

  const activeSamples = sessionSamples(activeSession)
  const activeHeart = statsFor(workoutHeartSamples(activeSession), 'heart_rate')
  const selectedSamples = sessionSamples(selectedSession)
  const selectedHeart = statsFor(
    workoutHeartSamples(selectedSession),
    'heart_rate',
  )
  const recovery = recoverySamples(selectedSession)
  const recoveryDrop =
    recovery.length >= 2
      ? Math.round(Number(recovery[0].value) - Number(recovery.at(-1)?.value))
      : null

  return (
    <section className="rvWorkoutModule" data-rv-workout-module="v19">
      <header className="rvWorkoutModuleHead">
        <div>
          <span>{t.eyebrow}</span>
          <h2>{t.title}</h2>
          <p>{t.subtitle}</p>
        </div>
        <Watch size={24} />
      </header>

      <section
        className={`rvWorkoutLiveCard ${activeSession ? 'is-active' : ''}`}
      >
        <div className="rvWorkoutLiveTop">
          <div>
            <span className="rvWorkoutLiveBadge">
              {activeSession ? t.activeBadge : 'APPLE HEALTH'}
            </span>
            <h3>{activeSession ? t.active : t.noneActive}</h3>
            <p>
              {activeSession
                ? `${workoutName(activeSession.workout_type)} · ${t.started} ${fmtDate(
                    activeSession.started_at,
                  )}`
                : t.noneActiveText}
            </p>
          </div>
          {activeSession ? <Activity size={23} /> : <TimerReset size={23} />}
        </div>

        {activeSession ? (
          <>
            <div className="rvWorkoutLiveStats">
              <article>
                <Clock3 size={16} />
                <span>{t.elapsed}</span>
                <strong>{duration(activeSession, true)}</strong>
              </article>
              <article>
                <TimerReset size={16} />
                <span>{t.planned}</span>
                <strong>
                  {activeSession.planned_duration_minutes
                    ? `${activeSession.planned_duration_minutes} ${t.minutes}`
                    : '—'}
                </strong>
              </article>
              <article>
                <HeartPulse size={16} />
                <span>{t.bpmRange}</span>
                <strong>
                  {activeHeart
                    ? `${Math.round(activeHeart.min)}–${Math.round(
                        activeHeart.max,
                      )} bpm`
                    : t.waiting}
                </strong>
              </article>
              <article>
                <RefreshCw size={16} />
                <span>{t.lastUpdate}</span>
                <strong>
                  {activeSession.last_synced_at
                    ? fmtDate(activeSession.last_synced_at)
                    : t.waiting}
                </strong>
              </article>
            </div>

            <div className="rvWorkoutLiveChart">
              <Sparkline samples={activeSamples} empty={t.chartEmpty} />
            </div>

            <div className="rvWorkoutLiveActions">
              <a
                className="rvWorkoutPrimary"
                href={SHORTCUT_SYNC}
                aria-label={t.update}
              >
                <RefreshCw size={16} />
                {t.update}
              </a>
              <small>{t.liveHint}</small>
            </div>
          </>
        ) : (
          <div className="rvWorkoutNoActiveFlow">
            <div>
              <Watch size={18} />
              <span>{t.flow1}</span>
            </div>
            <div>
              <HeartPulse size={18} />
              <span>{t.flow2}</span>
            </div>
            <div>
              <Check size={18} />
              <span>{t.flow3}</span>
            </div>
          </div>
        )}
      </section>

      <section className="rvWorkoutSetupCard">
        <div className="rvWorkoutSectionHead">
          <div>
            <span>APPLE HEALTH + SHORTCUTS</span>
            <h3>{t.setup}</h3>
          </div>
          <KeyRound size={19} />
        </div>

        <p>{t.setupText}</p>

        <div className="rvWorkoutSetupStatus">
          <span
            className={
              status.last_used_at
                ? 'ok'
                : status.configured
                  ? 'pending'
                  : ''
            }
          />
          <strong>
            {status.last_used_at
              ? t.configured
              : status.configured
                ? t.configuredPending
                : t.notConfigured}
          </strong>
        </div>

        <div className="rvWorkoutSetupActions">
          <button
            type="button"
            className="rvWorkoutPrimary"
            onClick={() => void rotate()}
            disabled={busy}
          >
            <KeyRound size={15} />
            {token ? t.copied : status.configured ? t.newCode : t.create}
          </button>

          <a
            className="rvWorkoutSecondary"
            href={OFFICIAL_SHORTCUT}
            target="_blank"
            rel="noreferrer"
          >
            <Watch size={15} />
            {t.install}
          </a>

          {status.configured && (
            <a className="rvWorkoutSecondary" href={SHORTCUT_SYNC}>
              <RefreshCw size={15} />
              {t.syncTest}
            </a>
          )}
        </div>

        {token && (
          <div className="rvWorkoutToken">
            <div>
              <small>{t.key}</small>
              <code>{token}</code>
            </div>
            <button type="button" onClick={() => void copyToken()}>
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? t.copied : t.key}
            </button>
          </div>
        )}

        <details className="rvWorkoutAdvanced">
          <summary>{t.advanced}</summary>
          <code>{ENDPOINT}</code>
          <code>X-RV-Health-Key</code>
          {status.configured && (
            <button type="button" onClick={() => void revoke()} disabled={busy}>
              {t.disconnect}
            </button>
          )}
        </details>
      </section>

      <section className="rvWorkoutFlowCard">
        <div className="rvWorkoutSectionHead">
          <div>
            <span>AUTOMAÇÃO</span>
            <h3>{t.flow}</h3>
          </div>
          <ShieldCheck size={19} />
        </div>

        <div className="rvWorkoutFlowGrid">
          <article>
            <span>1</span>
            <strong>{t.flow1}</strong>
            <p>{t.flow1Text}</p>
          </article>
          <article>
            <span>2</span>
            <strong>{t.flow2}</strong>
            <p>{t.flow2Text}</p>
          </article>
          <article>
            <span>3</span>
            <strong>{t.flow3}</strong>
            <p>{t.flow3Text}</p>
          </article>
          <article>
            <span>4</span>
            <strong>{t.flow4}</strong>
            <p>{t.flow4Text}</p>
          </article>
        </div>

        <small className="rvWorkoutIntegrationNote">{t.integrationNote}</small>
      </section>

      <section className="rvWorkoutHistory">
        <div className="rvWorkoutSectionHead">
          <div>
            <span>HISTÓRICO</span>
            <h3>{t.history}</h3>
          </div>
          <Route size={19} />
        </div>
        <p>{t.historyText}</p>

        {loading ? (
          <div className="rvWorkoutEmpty">{t.waiting}</div>
        ) : sessions.length === 0 ? (
          <div className="rvWorkoutEmpty">{t.noHistory}</div>
        ) : (
          <div className="rvWorkoutHistoryGrid">
            <div className="rvWorkoutHistoryList">
              {sessions.map((session) => {
                const rows = sessionSamples(session)
                const heart = statsFor(workoutHeartSamples(session), 'heart_rate')
                const energy = statsFor(rows, 'active_energy')
                const distance = statsFor(rows, 'distance')
                const steps = statsFor(rows, 'steps')

                return (
                  <button
                    type="button"
                    key={session.id}
                    className={`rvWorkoutHistoryItem ${
                      selectedId === session.id ? 'selected' : ''
                    }`}
                    onClick={() => setSelectedId(session.id)}
                  >
                    <div className="rvWorkoutHistoryItemTop">
                      <div>
                        <span>{fmtDate(session.started_at)}</span>
                        <strong>{workoutName(session.workout_type)}</strong>
                      </div>
                      <small className={`status-${session.status}`}>
                        {session.status === 'active'
                          ? t.activeBadge
                          : session.status === 'completed'
                            ? t.completed
                            : t.cancelled}
                      </small>
                    </div>

                    <div className="rvWorkoutHistoryNumbers">
                      <span>
                        <Clock3 size={13} />
                        {duration(session, session.status === 'active')}
                      </span>
                      <span>
                        <HeartPulse size={13} />
                        {heart
                          ? `${Math.round(heart.min)}–${Math.round(
                              heart.max,
                            )} · Ø ${Math.round(heart.avg)}`
                          : '—'}
                      </span>
                      {energy && (
                        <span>
                          <Flame size={13} />
                          {Math.round(energy.sum)} {energy.unit}
                        </span>
                      )}
                      {steps && (
                        <span>
                          <Footprints size={13} />
                          {Math.round(steps.sum)}
                        </span>
                      )}
                      {distance && (
                        <span>
                          <Route size={13} />
                          {distance.sum.toFixed(2)} {distance.unit}
                        </span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>

            {selectedSession && (
              <article className="rvWorkoutSessionDetail">
                <div className="rvWorkoutSessionDetailHead">
                  <div>
                    <span>
                      {selectedSession.status === 'active'
                        ? t.activeBadge
                        : t.completed}
                    </span>
                    <h4>{sessionTitle(selectedSession)}</h4>
                    <p>{workoutName(selectedSession.workout_type)}</p>
                  </div>
                  <Activity size={20} />
                </div>

                <div className="rvWorkoutMetricGrid">
                  <article>
                    <HeartPulse size={16} />
                    <span>{t.bpmRange}</span>
                    <strong>
                      {selectedHeart
                        ? `${Math.round(selectedHeart.min)}–${Math.round(
                            selectedHeart.max,
                          )} bpm`
                        : t.noMetric}
                    </strong>
                    <small>
                      {selectedHeart
                        ? `${t.average}: ${Math.round(selectedHeart.avg)} bpm`
                        : ''}
                    </small>
                  </article>

                  <article>
                    <Flame size={16} />
                    <span>{t.calories}</span>
                    <strong>
                      {metricValue(selectedSession, 'active_energy', 'sum', 0)}
                    </strong>
                  </article>

                  <article>
                    <Footprints size={16} />
                    <span>{t.steps}</span>
                    <strong>
                      {metricValue(selectedSession, 'steps', 'sum', 0)}
                    </strong>
                  </article>

                  <article>
                    <Route size={16} />
                    <span>{t.distance}</span>
                    <strong>
                      {metricValue(selectedSession, 'distance', 'sum', 2)}
                    </strong>
                  </article>

                  <article>
                    <Activity size={16} />
                    <span>{t.hrv}</span>
                    <strong>
                      {metricValue(
                        selectedSession,
                        'heart_rate_variability',
                        'avg',
                        0,
                      )}
                    </strong>
                  </article>

                  <article>
                    <Activity size={16} />
                    <span>{t.respiratory}</span>
                    <strong>
                      {metricValue(
                        selectedSession,
                        'respiratory_rate',
                        'avg',
                        1,
                      )}
                    </strong>
                  </article>

                  <article>
                    <Activity size={16} />
                    <span>{t.oxygen}</span>
                    <strong>
                      {metricValue(
                        selectedSession,
                        'oxygen_saturation',
                        'avg',
                        1,
                      )}
                    </strong>
                  </article>

                  <article>
                    <TimerReset size={16} />
                    <span>{t.recovery}</span>
                    <strong>
                      {recoveryDrop === null
                        ? t.noMetric
                        : `${recoveryDrop > 0 ? '−' : '+'}${Math.abs(
                            recoveryDrop,
                          )} bpm`}
                    </strong>
                    <small>{recoveryDrop === null ? '' : t.recoveryText}</small>
                  </article>
                </div>

                <div className="rvWorkoutSessionChart">
                  <div>
                    <strong>{t.chart}</strong>
                    <small>
                      {selectedHeart
                        ? `${selectedHeart.count} ${t.samples}`
                        : t.waiting}
                    </small>
                  </div>
                  <Sparkline samples={selectedSamples} empty={t.chartEmpty} />
                </div>
              </article>
            )}
          </div>
        )}
      </section>
    </section>
  )
}
