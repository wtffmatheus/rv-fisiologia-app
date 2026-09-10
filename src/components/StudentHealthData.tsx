import {
  Activity,
  Check,
  ChevronDown,
  ChevronRight,
  Clock3,
  Copy,
  Flame,
  Footprints,
  HeartPulse,
  KeyRound,
  RefreshCw,
  Route,
  TimerReset,
  Watch,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useI18n } from '../i18n'
import { cleanSamples } from '../../supabase/functions/health-ingest/normalizers'
import { healthIntegration } from '../health/config'
import { loadHealthSamples } from '../health/loadSamples'
import { samplesDuringWorkout } from '../health/workoutSamples'

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
  raw_payload?: { source_id?: string | null }
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

type ExtraMetric = {
  key: string
  label: string
  value: string
}

const SHORTCUT_INSTALL_URL = healthIntegration.installUrl
const SHORTCUT_SYNC = healthIntegration.run('sync')
const SHORTCUT_ANALYSIS = healthIntegration.run('analysis')

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
    return <div className="rvWatchSimpleChartEmpty">{empty}</div>
  }

  const width = 640
  const height = 170
  const padding = 12
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
    <div className="rvWatchSimpleChart">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label="Heart rate"
      >
        <polyline points={points} fill="none" vectorEffect="non-scaling-stroke" />
      </svg>

      <div className="rvWatchSimpleChartScale">
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
  const [discardedSamples, setDiscardedSamples] = useState(0)
  const [status, setStatus] = useState<IngestStatus>({ configured: false })
  const [token, setToken] = useState('')
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const loadInFlight = useRef(false)
  const loadController = useRef<AbortController | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [, setTick] = useState(0)

  const labels = {
    'pt-BR': {
      connectTitle: 'Conectar seu Apple Watch',
      connectText: 'É só configurar uma vez.',
      step1: 'Criar código',
      step2: 'Instalar no iPhone',
      step3: 'Testar conexão',
      createCode: 'Criar código',
      newCode: 'Criar novo código',
      install: 'Instalar integração',
      test: 'Testar agora',
      copied: 'Código copiado',
      yourCode: 'Seu código',
      connected: 'RV recebeu dados do Apple Saúde',
      waitingFirst: 'Falta testar a conexão',
      manage: 'Gerenciar conexão',
      disconnect: 'Desconectar',
      connectionHelp:
        'O relógio envia os dados pelo Apple Saúde do iPhone. Não há pareamento direto com o RV.',
      currentWorkout: 'Treino agora',
      noWorkout: 'Nenhum treino em andamento',
      noWorkoutText:
        'Quando você iniciar um exercício no Apple Watch, ele aparecerá aqui.',
      started: 'Começou',
      elapsed: 'Tempo',
      planned: 'Previsto',
      beats: 'Batimentos',
      average: 'Média',
      calories: 'Calorias',
      update: 'Atualizar agora',
      updated: 'Atualizado',
      history: 'Seus treinos',
      historyText: 'Toque em um treino para ver os detalhes.',
      noHistory: 'Seu histórico aparecerá aqui depois do primeiro treino.',
      latest: 'Último treino',
      duration: 'Duração',
      minimum: 'Mínimo',
      maximum: 'Máximo',
      distance: 'Distância',
      steps: 'Passos',
      hrv: 'Variação cardíaca',
      breathing: 'Respiração',
      oxygen: 'Oxigenação',
      recovery: 'Recuperação',
      details: 'Detalhes do treino',
      close: 'Fechar detalhes',
      chart: 'Batimentos durante o treino',
      chartEmpty: 'Ainda não há leituras suficientes para montar o gráfico.',
      otherData: 'Outros dados',
      readings: 'leituras',
      live: 'AO VIVO',
      finished: 'Concluído',
      cancelled: 'Cancelado',
      minutes: 'min',
      noData: '—',
      justNow: 'agora',
      setupDone: 'Há dados recebidos. Isso não confirma as automações de início e fim.',
      analysisEyebrow: 'PRIMEIRO PASSO',
      analysisTitle: 'Faça sua análise inicial',
      analysisText:
        'O RV busca seus dados recentes do Apple Saúde e monta uma visão geral antes de começar a acompanhar os treinos.',
      analysisButton: 'Analisar meus dados',
      analysisUpdate: 'Atualizar análise',
      analysisReady: 'Dados recebidos para análise',
      analysisPeriod: 'Resumo dos últimos 7 dias',
      restingHeart: 'Batimentos em repouso',
      heartVariation: 'Batimentos registrados',
      activity: 'Atividade',
      hrvAnalysis: 'Variação cardíaca',
      breathingAnalysis: 'Respiração',
      oxygenAnalysis: 'Oxigenação',
      analysisHint:
        'Leva alguns segundos. O iPhone pode pedir permissão para acessar informações do Apple Saúde.',
      analysisNoData:
        'Depois de tocar no botão, volte para o RV. Os resultados aparecerão aqui automaticamente.',
      simpleHow: 'Como funciona',
      simpleHowText:
        'Você inicia o exercício no Apple Watch. O iPhone envia os dados ao RV e o treino fica salvo no histórico.',
    },
    en: {
      connectTitle: 'Connect your Apple Watch',
      connectText: 'You only need to set it up once.',
      step1: 'Create code',
      step2: 'Install on iPhone',
      step3: 'Test connection',
      createCode: 'Create code',
      newCode: 'Create new code',
      install: 'Install integration',
      test: 'Test now',
      copied: 'Code copied',
      yourCode: 'Your code',
      connected: 'RV received Apple Health data',
      waitingFirst: 'Connection still needs testing',
      manage: 'Manage connection',
      disconnect: 'Disconnect',
      connectionHelp:
        'The watch sends data through Apple Health on iPhone. RV does not pair directly with the watch.',
      currentWorkout: 'Workout now',
      noWorkout: 'No workout in progress',
      noWorkoutText: 'When you start an Apple Watch workout, it will appear here.',
      started: 'Started',
      elapsed: 'Time',
      planned: 'Planned',
      beats: 'Heart rate',
      average: 'Average',
      calories: 'Calories',
      update: 'Update now',
      updated: 'Updated',
      history: 'Your workouts',
      historyText: 'Tap a workout to see details.',
      noHistory: 'Your history will appear here after the first workout.',
      latest: 'Latest workout',
      duration: 'Duration',
      minimum: 'Minimum',
      maximum: 'Maximum',
      distance: 'Distance',
      steps: 'Steps',
      hrv: 'Heart variability',
      breathing: 'Breathing',
      oxygen: 'Oxygen',
      recovery: 'Recovery',
      details: 'Workout details',
      close: 'Close details',
      chart: 'Heart rate during workout',
      chartEmpty: 'There are not enough readings yet for a chart.',
      otherData: 'Other data',
      readings: 'readings',
      live: 'LIVE',
      finished: 'Completed',
      cancelled: 'Cancelled',
      minutes: 'min',
      noData: '—',
      justNow: 'now',
      setupDone: 'Data received. Start and end automations still need verification.',
      analysisEyebrow: 'FIRST STEP',
      analysisTitle: 'Run your initial analysis',
      analysisText:
        'RV checks recent Apple Health data and builds an overview before workout tracking starts.',
      analysisButton: 'Analyze my data',
      analysisUpdate: 'Update analysis',
      analysisReady: 'Data received for analysis',
      analysisPeriod: 'Last 7 days',
      restingHeart: 'Resting heart rate',
      heartVariation: 'Recorded heart rate',
      activity: 'Activity',
      hrvAnalysis: 'Heart variability',
      breathingAnalysis: 'Breathing',
      oxygenAnalysis: 'Oxygen',
      analysisHint:
        'It takes a few seconds. iPhone may ask for Apple Health permissions.',
      analysisNoData:
        'After tapping the button, return to RV. Results will appear here automatically.',
      simpleHow: 'How it works',
      simpleHowText:
        'Start a workout on Apple Watch. iPhone sends the data to RV and the workout is saved in history.',
    },
    es: {
      connectTitle: 'Conectar tu Apple Watch',
      connectText: 'Solo necesitas configurarlo una vez.',
      step1: 'Crear código',
      step2: 'Instalar en iPhone',
      step3: 'Probar conexión',
      createCode: 'Crear código',
      newCode: 'Crear nuevo código',
      install: 'Instalar integración',
      test: 'Probar ahora',
      copied: 'Código copiado',
      yourCode: 'Tu código',
      connected: 'RV recibió datos de Apple Salud',
      waitingFirst: 'Falta probar la conexión',
      manage: 'Administrar conexión',
      disconnect: 'Desconectar',
      connectionHelp:
        'El reloj envía datos por Apple Salud del iPhone. RV no se empareja directamente con el reloj.',
      currentWorkout: 'Entrenamiento ahora',
      noWorkout: 'Ningún entrenamiento en curso',
      noWorkoutText: 'Cuando inicies un ejercicio en Apple Watch, aparecerá aquí.',
      started: 'Comenzó',
      elapsed: 'Tiempo',
      planned: 'Previsto',
      beats: 'Pulsaciones',
      average: 'Media',
      calories: 'Calorías',
      update: 'Actualizar ahora',
      updated: 'Actualizado',
      history: 'Tus entrenamientos',
      historyText: 'Toca un entrenamiento para ver los detalles.',
      noHistory: 'Tu historial aparecerá después del primer entrenamiento.',
      latest: 'Último entrenamiento',
      duration: 'Duración',
      minimum: 'Mínimo',
      maximum: 'Máximo',
      distance: 'Distancia',
      steps: 'Pasos',
      hrv: 'Variación cardíaca',
      breathing: 'Respiración',
      oxygen: 'Oxigenación',
      recovery: 'Recuperación',
      details: 'Detalles del entrenamiento',
      close: 'Cerrar detalles',
      chart: 'Pulsaciones durante el entrenamiento',
      chartEmpty: 'Todavía no hay suficientes lecturas para el gráfico.',
      otherData: 'Otros datos',
      readings: 'lecturas',
      live: 'EN VIVO',
      finished: 'Completado',
      cancelled: 'Cancelado',
      minutes: 'min',
      noData: '—',
      justNow: 'ahora',
      setupDone: 'Hay datos recibidos. Falta verificar las automatizaciones de inicio y fin.',
      analysisEyebrow: 'PRIMER PASO',
      analysisTitle: 'Haz tu análisis inicial',
      analysisText:
        'RV revisa datos recientes de Apple Salud y crea una visión general antes de seguir los entrenamientos.',
      analysisButton: 'Analizar mis datos',
      analysisUpdate: 'Actualizar análisis',
      analysisReady: 'Datos recibidos para el análisis',
      analysisPeriod: 'Últimos 7 días',
      restingHeart: 'Pulsaciones en reposo',
      heartVariation: 'Pulsaciones registradas',
      activity: 'Actividad',
      hrvAnalysis: 'Variación cardíaca',
      breathingAnalysis: 'Respiración',
      oxygenAnalysis: 'Oxigenación',
      analysisHint:
        'Tarda unos segundos. El iPhone puede pedir permisos de Apple Salud.',
      analysisNoData:
        'Después de tocar el botón, vuelve a RV. Los resultados aparecerán automáticamente.',
      simpleHow: 'Cómo funciona',
      simpleHowText:
        'Inicia un ejercicio en Apple Watch. El iPhone envía los datos a RV y el entrenamiento queda guardado.',
    },
    'zh-CN': {
      connectTitle: '连接 Apple Watch',
      connectText: '只需设置一次。',
      step1: '创建代码',
      step2: '安装到 iPhone',
      step3: '测试连接',
      createCode: '创建代码',
      newCode: '创建新代码',
      install: '安装集成',
      test: '立即测试',
      copied: '代码已复制',
      yourCode: '你的代码',
      connected: 'RV 已收到 Apple 健康数据',
      waitingFirst: '还需要测试连接',
      manage: '管理连接',
      disconnect: '断开连接',
      connectionHelp: '手表通过 iPhone 的 Apple 健康发送数据，RV 不直接配对手表。',
      currentWorkout: '当前训练',
      noWorkout: '当前没有训练',
      noWorkoutText: '开始 Apple Watch 训练后会显示在这里。',
      started: '开始',
      elapsed: '时间',
      planned: '计划',
      beats: '心率',
      average: '平均',
      calories: '卡路里',
      update: '立即更新',
      updated: '已更新',
      history: '你的训练',
      historyText: '点击训练查看详情。',
      noHistory: '完成第一次训练后，历史会显示在这里。',
      latest: '最近训练',
      duration: '时长',
      minimum: '最低',
      maximum: '最高',
      distance: '距离',
      steps: '步数',
      hrv: '心率变异',
      breathing: '呼吸',
      oxygen: '血氧',
      recovery: '恢复',
      details: '训练详情',
      close: '关闭详情',
      chart: '训练期间心率',
      chartEmpty: '读数不足，暂时无法显示图表。',
      otherData: '其他数据',
      readings: '条读数',
      live: '实时',
      finished: '已完成',
      cancelled: '已取消',
      minutes: '分钟',
      noData: '—',
      justNow: '刚刚',
      setupDone: '已收到数据。开始和结束自动化仍需验证。',
      analysisEyebrow: '第一步',
      analysisTitle: '进行初始分析',
      analysisText: 'RV 会读取最近的 Apple 健康数据，并在训练追踪前生成概览。',
      analysisButton: '分析我的数据',
      analysisUpdate: '更新分析',
      analysisReady: '已收到分析数据',
      analysisPeriod: '最近 7 天',
      restingHeart: '静息心率',
      heartVariation: '已记录心率',
      activity: '活动',
      hrvAnalysis: '心率变异',
      breathingAnalysis: '呼吸',
      oxygenAnalysis: '血氧',
      analysisHint: '只需几秒钟。iPhone 可能会请求 Apple 健康权限。',
      analysisNoData: '点击按钮后返回 RV，结果会自动显示在这里。',
      simpleHow: '工作方式',
      simpleHowText: '在 Apple Watch 开始训练，iPhone 将数据发送到 RV，并保存到历史。',
    },
    de: {
      connectTitle: 'Apple Watch verbinden',
      connectText: 'Die Einrichtung ist nur einmal nötig.',
      step1: 'Code erstellen',
      step2: 'Auf iPhone installieren',
      step3: 'Verbindung testen',
      createCode: 'Code erstellen',
      newCode: 'Neuen Code erstellen',
      install: 'Integration installieren',
      test: 'Jetzt testen',
      copied: 'Code kopiert',
      yourCode: 'Dein Code',
      connected: 'RV hat Apple-Health-Daten empfangen',
      waitingFirst: 'Verbindung muss noch getestet werden',
      manage: 'Verbindung verwalten',
      disconnect: 'Trennen',
      connectionHelp:
        'Die Watch sendet Daten über Apple Health auf dem iPhone. RV koppelt sich nicht direkt mit der Uhr.',
      currentWorkout: 'Training jetzt',
      noWorkout: 'Kein Training aktiv',
      noWorkoutText: 'Wenn du ein Apple-Watch-Training startest, erscheint es hier.',
      started: 'Gestartet',
      elapsed: 'Zeit',
      planned: 'Geplant',
      beats: 'Herzfrequenz',
      average: 'Mittel',
      calories: 'Kalorien',
      update: 'Jetzt aktualisieren',
      updated: 'Aktualisiert',
      history: 'Deine Trainings',
      historyText: 'Tippe auf ein Training für Details.',
      noHistory: 'Nach dem ersten Training erscheint hier dein Verlauf.',
      latest: 'Letztes Training',
      duration: 'Dauer',
      minimum: 'Minimum',
      maximum: 'Maximum',
      distance: 'Distanz',
      steps: 'Schritte',
      hrv: 'Herzvariabilität',
      breathing: 'Atmung',
      oxygen: 'Sauerstoff',
      recovery: 'Erholung',
      details: 'Trainingsdetails',
      close: 'Details schließen',
      chart: 'Herzfrequenz im Training',
      chartEmpty: 'Für das Diagramm gibt es noch nicht genug Messwerte.',
      otherData: 'Weitere Daten',
      readings: 'Messwerte',
      live: 'LIVE',
      finished: 'Abgeschlossen',
      cancelled: 'Abgebrochen',
      minutes: 'Min',
      noData: '—',
      justNow: 'jetzt',
      setupDone: 'Daten empfangen. Start- und Endautomationen müssen noch geprüft werden.',
      analysisEyebrow: 'ERSTER SCHRITT',
      analysisTitle: 'Erstanalyse durchführen',
      analysisText:
        'RV prüft aktuelle Apple-Health-Daten und erstellt vor dem Trainingstracking eine Übersicht.',
      analysisButton: 'Meine Daten analysieren',
      analysisUpdate: 'Analyse aktualisieren',
      analysisReady: 'Daten zur Analyse empfangen',
      analysisPeriod: 'Letzte 7 Tage',
      restingHeart: 'Ruhepuls',
      heartVariation: 'Erfasster Puls',
      activity: 'Aktivität',
      hrvAnalysis: 'Herzvariabilität',
      breathingAnalysis: 'Atmung',
      oxygenAnalysis: 'Sauerstoff',
      analysisHint:
        'Dauert nur wenige Sekunden. Das iPhone kann nach Apple-Health-Berechtigungen fragen.',
      analysisNoData:
        'Nach dem Tippen zu RV zurückkehren. Die Ergebnisse erscheinen automatisch.',
      simpleHow: 'So funktioniert es',
      simpleHowText:
        'Starte ein Training auf der Apple Watch. Das iPhone sendet die Daten an RV und das Training wird gespeichert.',
    },
  } as const

  const t = labels[language]
  const storageKey = `rv_health_setup_token_${studentId}`

  async function load() {
    if (loadInFlight.current && !loadController.current?.signal.aborted) return
    loadInFlight.current = true
    const controller = new AbortController()
    loadController.current = controller
    const timeout = window.setTimeout(() => controller.abort(), 30000)
    setErrorMessage('')
    try {
      const [sessionResult, statusResult] = await Promise.all([
        supabase
          .from('workout_sessions')
          .select(
            'id,student_id,source,workout_type,planned_duration_minutes,started_at,ended_at,status,last_synced_at,created_at,updated_at',
          )
          .eq('student_id', studentId)
          .order('started_at', { ascending: false })
          .limit(20)
          .abortSignal(controller.signal),
        supabase.rpc('get_own_health_ingest_status').abortSignal(controller.signal),
      ])
      if (controller.signal.aborted) return

      if (sessionResult.error || statusResult.error) {
        setErrorMessage(language === 'pt-BR' ? 'Não foi possível atualizar todos os dados. Tente novamente.' : 'Could not refresh all data. Please retry.')
      }

      if (!sessionResult.error) {
        setSessions((sessionResult.data as WorkoutSession[]) ?? [])
      }

      if (sessionResult.error) throw sessionResult.error
      const sampleData = await loadHealthSamples(studentId, (sessionResult.data ?? []).map(row => row.id), controller.signal)
      if (controller.signal.aborted) return
      const validSamples = cleanSamples(sampleData as Sample[])
      setSamples(validSamples)
      setDiscardedSamples(sampleData.length - validSamples.length)

      if (!statusResult.error && statusResult.data) {
        const next = statusResult.data as IngestStatus
        setStatus(next)

        if (next.last_used_at) {
          setToken('')
          try {
            window.localStorage.removeItem(storageKey)
          } catch {
            // Mantém a interface funcionando sem localStorage.
          }
        }
      }

    } catch {
      if (loadController.current === controller) setErrorMessage(language === 'pt-BR' ? 'Falha de conexão. Tente novamente.' : 'Connection failed. Please retry.')
    } finally {
      window.clearTimeout(timeout)
      if (loadController.current === controller) {
        loadInFlight.current = false
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    setToken('')
    setSamples([])
    setDiscardedSamples(0)
    setSessions([])
    setStatus({ configured: false })
    try {
      window.localStorage.removeItem(storageKey)
    } catch {
      // Mantém a interface funcionando sem localStorage.
    }

    void load()

    const channel = supabase
      .channel(`rv-watch-simple-${studentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'workout_sessions',
          filter: `student_id=eq.${studentId}`,
        },
        (payload) => {
          const row = payload.new as WorkoutSession
          if (!row?.id) return

          setSessions((current) =>
            [row, ...current.filter((item) => item.id !== row.id)]
              .sort(
                (a, b) =>
                  new Date(b.started_at).getTime() -
                  new Date(a.started_at).getTime(),
              )
              .slice(0, 20),
          )
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
          const row = payload.new as Sample
          if (!row?.id) return

          setSamples((current) =>
            cleanSamples([row, ...current.filter((item) => item.id !== row.id)])
              .sort((first, second) => Date.parse(second.measured_at) - Date.parse(first.measured_at)),
          )
        },
      )
      .subscribe()

    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void load()
    }

    document.addEventListener('visibilitychange', refreshWhenVisible)
    window.addEventListener('pageshow', refreshWhenVisible)

    return () => {
      loadController.current?.abort()
      document.removeEventListener('visibilitychange', refreshWhenVisible)
      window.removeEventListener('pageshow', refreshWhenVisible)
      void supabase.removeChannel(channel)
    }
  }, [studentId])

  useEffect(() => {
    if (!token) return
    const timeout = window.setTimeout(() => setToken(''), 5 * 60 * 1000)
    return () => window.clearTimeout(timeout)
  }, [token])

  useEffect(() => {
    const timer = window.setInterval(() => setTick((value) => value + 1), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const samplesBySession = useMemo(() => {
    const map = new Map<string, Sample[]>()

    for (const sample of samples) {
      if (!sample.workout_session_id) continue
      const current = map.get(sample.workout_session_id) ?? []
      current.push(sample)
      map.set(sample.workout_session_id, current)
    }

    return map
  }, [samples])

  const activeSession =
    sessions.find((session) => session.status === 'active') ?? null

  const completedSessions = sessions.filter(
    (session) => session.status === 'completed',
  )

  const latestSession = completedSessions[0] ?? null
  const selectedSession =
    sessions.find((session) => session.id === selectedId) ?? null

  function sessionSamples(session: WorkoutSession | null) {
    if (!session) return []
    return samplesDuringWorkout(samplesBySession.get(session.id) ?? [], session)
  }

  function workoutHeartSamples(session: WorkoutSession | null) {
    const rows = sessionSamples(session).filter(
      (item) => item.metric === 'heart_rate',
    )

    if (!session?.ended_at) return rows

    const end = new Date(session.ended_at).getTime()
    return rows.filter((item) => new Date(item.measured_at).getTime() <= end)
  }

  function recoveryDrop(session: WorkoutSession | null) {
    if (!session?.ended_at) return null

    const end = new Date(session.ended_at).getTime()
    const rows = (samplesBySession.get(session.id) ?? [])
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

    if (rows.length < 2) return null

    return Math.round(Number(rows[0].value) - Number(rows.at(-1)?.value))
  }

  function fmtDate(value: string) {
    return new Intl.DateTimeFormat(locale, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value))
  }

  function fmtShort(value: string) {
    return new Intl.DateTimeFormat(locale, {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value))
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
    if (!Number.isFinite(totalSeconds) || end < start || totalSeconds > 86400) return t.noData
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

  function totalMetric(
    session: WorkoutSession,
    metric: string,
    digits = 0,
  ) {
    const stats = statsFor(sessionSamples(session), metric)
    if (!stats) return null
    return `${stats.sum.toFixed(digits)} ${stats.unit}`
  }

  function averageMetric(
    session: WorkoutSession,
    metric: string,
    digits = 0,
  ) {
    const stats = statsFor(sessionSamples(session), metric)
    if (!stats) return null
    return `${stats.avg.toFixed(digits)} ${stats.unit}`
  }

  function extraMetrics(session: WorkoutSession): ExtraMetric[] {
    const rows: ExtraMetric[] = []

    const hrv = averageMetric(session, 'heart_rate_variability', 0)
    const breathing = averageMetric(session, 'respiratory_rate', 1)
    const oxygen = averageMetric(session, 'oxygen_saturation', 1)
    const recovery = recoveryDrop(session)

    if (hrv) rows.push({ key: 'hrv', label: t.hrv, value: hrv })
    if (breathing) {
      rows.push({ key: 'breathing', label: t.breathing, value: breathing })
    }
    if (oxygen) {
      rows.push({ key: 'oxygen', label: t.oxygen, value: oxygen })
    }
    if (recovery !== null) {
      rows.push({
        key: 'recovery',
        label: t.recovery,
        value: `${recovery > 0 ? '−' : '+'}${Math.abs(recovery)} bpm`,
      })
    }

    return rows
  }

  async function rotate() {
    setBusy(true)
    setErrorMessage('')
    try {

      const { data, error } = await supabase.rpc(
        'rotate_own_health_ingest_token',
        { p_label: 'iPhone / Atalhos' },
      )
      if (error) throw error

      if (!error && data) {
        const next = String((data as { token?: string }).token || '')
        setToken(next)
        setStatus({ configured: true, last_used_at: null })

        if (next) {
          try {
            await navigator.clipboard.writeText(next)
            setCopied(true)
            window.setTimeout(() => setCopied(false), 1800)
          } catch {
            // O botão copiar continua disponível.
          }
        }
      }

    } catch {
      setErrorMessage(language === 'pt-BR' ? 'Não foi possível criar o código.' : 'Could not create the code.')
    } finally {
      setBusy(false)
    }
  }

  async function copyToken() {
    if (!token) return
    try {
      await navigator.clipboard.writeText(token)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setErrorMessage(language === 'pt-BR' ? 'Selecione e copie o código exibido.' : 'Select and copy the displayed code.')
    }
  }

  async function revoke() {
    setBusy(true)
    setErrorMessage('')
    try {
      const { error } = await supabase.rpc('revoke_own_health_ingest_token')
      if (error) throw error

      if (!error) {
        setStatus({ configured: false })
        setToken('')

        try {
          window.localStorage.removeItem(storageKey)
        } catch {
          // Nada a fazer.
        }
      }

    } catch {
      setErrorMessage(language === 'pt-BR' ? 'Não foi possível revogar a conexão.' : 'Could not revoke the connection.')
    } finally {
      setBusy(false)
    }
  }

  const connected = Boolean(status.last_used_at)

  const analysisSince = Date.now() - 7 * 24 * 60 * 60 * 1000
  const analysisRows = samples.filter(
    (item) =>
      item.metric !== 'workout_start' &&
      item.metric !== 'workout_end' &&
      new Date(item.measured_at).getTime() >= analysisSince,
  )

  const analysisResting =
    statsFor(analysisRows, 'resting_heart_rate')
  const analysisHeart = statsFor(analysisRows, 'heart_rate')
  const analysisHrv = statsFor(analysisRows, 'heart_rate_variability')
  const analysisBreathing = statsFor(analysisRows, 'respiratory_rate')
  const analysisOxygen = statsFor(analysisRows, 'oxygen_saturation')
  const analysisSteps = statsFor(analysisRows, 'steps')
  const analysisEnergy = statsFor(analysisRows, 'active_energy')
  const analysisDistance = statsFor(analysisRows, 'distance')

  const analysisMetricCount = [
    analysisHeart,
    analysisResting,
    analysisHrv,
    analysisBreathing,
    analysisOxygen,
    analysisSteps,
    analysisEnergy,
    analysisDistance,
  ].filter(Boolean).length

  const analysisReady = analysisMetricCount >= 1

  const analysisCards = [
    { metric: 'resting_heart_rate', label: t.restingHeart, icon: HeartPulse, value: analysisResting && `${Math.round(analysisResting.avg)} bpm` },
    { metric: 'heart_rate', label: t.heartVariation, icon: Activity, value: analysisHeart && `${Math.round(analysisHeart.min)}–${Math.round(analysisHeart.max)} bpm` },
    { metric: 'heart_rate_variability', label: t.hrvAnalysis, icon: Activity, value: analysisHrv && `${Math.round(analysisHrv.avg)} ${analysisHrv.unit}` },
    { metric: 'steps', label: t.steps, icon: Footprints, value: analysisSteps && `${Math.round(analysisSteps.sum)} ${t.steps.toLowerCase()}` },
    { metric: 'respiratory_rate', label: t.breathingAnalysis, icon: Activity, value: analysisBreathing && `${analysisBreathing.avg.toFixed(1)} ${analysisBreathing.unit}` },
    { metric: 'oxygen_saturation', label: t.oxygenAnalysis, icon: Activity, value: analysisOxygen && `${analysisOxygen.avg.toFixed(1)} ${analysisOxygen.unit}` },
    { metric: 'active_energy', label: language === 'pt-BR' ? 'Calorias ativas recebidas' : 'Active calories received', icon: Flame, value: analysisEnergy && `${Math.round(analysisEnergy.sum)} ${analysisEnergy.unit}` },
    { metric: 'distance', label: t.distance, icon: Route, value: analysisDistance && `${analysisDistance.sum.toFixed(2)} ${analysisDistance.unit}` },
  ]

  const activeRows = sessionSamples(activeSession)
  const recentHeart = activeRows.filter(sample => sample.metric === 'heart_rate')
    .reduce<Sample | undefined>((recent, sample) => !recent || Date.parse(sample.measured_at) > Date.parse(recent.measured_at) ? sample : recent, undefined)
  const activeHeart = statsFor(workoutHeartSamples(activeSession), 'heart_rate')
  const activeEnergy = activeSession
    ? totalMetric(activeSession, 'active_energy', 0)
    : null

  const latestHeart = statsFor(
    workoutHeartSamples(latestSession),
    'heart_rate',
  )
  const latestEnergy = latestSession
    ? totalMetric(latestSession, 'active_energy', 0)
    : null

  const detailRows = sessionSamples(selectedSession)
  const detailHeart = statsFor(
    workoutHeartSamples(selectedSession),
    'heart_rate',
  )

  const detailDistance = selectedSession
    ? totalMetric(selectedSession, 'distance', 2)
    : null
  const detailSteps = selectedSession
    ? totalMetric(selectedSession, 'steps', 0)
    : null
  const detailEnergy = selectedSession
    ? totalMetric(selectedSession, 'active_energy', 0)
    : null
  const detailExtras = selectedSession ? extraMetrics(selectedSession) : []

  return (
    <section className="rvWatchSimpleModule" data-rv-health-module="simple-v21">
      {discardedSamples > 0 && (
        <p role="status" className="rvWatchEmptyCopy">
          {language === 'pt-BR'
            ? `${discardedSamples} amostras inválidas ou repetidas foram desconsideradas. Os números abaixo usam apenas as leituras aceitas.`
            : `${discardedSamples} invalid or duplicate samples were excluded. Figures below use accepted readings only.`}
        </p>
      )}
      {errorMessage && <p role="alert">{errorMessage} <button type="button" onClick={() => void load()}>{t.update}</button></p>}
      <details className="rvWatchSimpleHow">
      <summary>{t.simpleHow}</summary>
      <p className="rvWatchEmptyCopy">
        {language === 'pt-BR'
          ? `A análise usa o atalho ${healthIntegration.name}. Instalar o atalho não instala as automações pessoais do iPhone.`
          : `Analysis uses the ${healthIntegration.name} shortcut. Installing it does not install iPhone personal automations.`}
      </p>
      {!healthIntegration.supportsModes && (
        <>
          <p className="rvWatchEmptyCopy">
            {language === 'pt-BR'
              ? 'Este atalho só coleta dados: não aceita start, sync ou end. Preserve as duas automações que enviavam início e fim diretamente ao RV. Não substitua esses envios por Executar Atalho de análise.'
              : 'This shortcut only collects data: it does not accept start, sync or end. Keep the two automations that sent start and end directly to RV. Do not replace those requests with Run Analysis Shortcut.'}
          </p>
          <ol className="rvWatchAutomationSteps">
            <li>{language === 'pt-BR' ? 'Atalhos → Automação → Exercício Apple Watch → Qualquer Exercício → Início: manter o envio workout_start.' : 'Shortcuts → Automation → Apple Watch Workout → Any Workout → Starts: keep the workout_start request.'}</li>
            <li>{language === 'pt-BR' ? 'Outra automação → Fim: manter o envio workout_end. Nas duas, ativar Executar imediatamente (ou desativar Perguntar Antes de Executar).' : 'A separate automation → Ends: keep the workout_end request. Enable Run Immediately (or disable Ask Before Running) on both.'}</li>
            <li>{language === 'pt-BR' ? 'Teste cada automação no iPhone. Depois de encerrar e os dados chegarem ao Saúde, execute a análise. Só início/fim não preenche o relatório.' : 'Test each automation on iPhone. After ending the workout and Health receives the readings, run analysis. Start/end alone cannot fill the report.'}</li>
          </ol>
        </>
      )}
      </details>
      {healthIntegration.supportsModes && healthIntegration.name && (
        <nav aria-label="Workout Shortcuts">
          <a href={healthIntegration.run('start')}>START</a>{' · '}
          <a href={healthIntegration.run('sync')}>SYNC</a>{' · '}
          <a href={healthIntegration.run('end')}>END</a>
        </nav>
      )}
      {!connected && (
        <section className="rvWatchConnectCard">
          <div className="rvWatchSimpleSectionHead">
            <div>
              <span>{t.connectText}</span>
              <h2>{t.connectTitle}</h2>
            </div>
            <Watch size={21} />
          </div>

          <div className="rvWatchConnectSteps">
            <article className={status.configured ? 'done' : ''}>
              <span>1</span>
              <strong>{t.step1}</strong>
              <button
                type="button"
                onClick={() => void rotate()}
                disabled={busy}
              >
                <KeyRound size={15} />
                {status.configured ? t.newCode : t.createCode}
              </button>
            </article>

            <article>
              <span>2</span>
              <strong>{t.step2}</strong>
              <a
                href={SHORTCUT_INSTALL_URL}
                aria-disabled={!SHORTCUT_INSTALL_URL}
                target="_blank"
                rel="noreferrer"
              >
                <Watch size={15} />
                {t.install}
              </a>
            </article>

            <article className={status.configured ? '' : 'disabled'}>
              <span>3</span>
              <strong>{t.step3}</strong>
              <button
                type="button"
                onClick={() => void load()}
                disabled={!status.configured || loading}
              >
                <RefreshCw size={15} />
                {t.test}
              </button>
            </article>
          </div>

          {token && (
            <div className="rvWatchConnectCode">
              <div>
                <small>{t.yourCode}</small>
                <code>{token}</code>
              </div>

              <button type="button" onClick={() => void copyToken()}>
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? t.copied : t.yourCode}
              </button>
            </div>
          )}

          <p className="rvWatchConnectNote">
            {status.configured ? t.waitingFirst : t.connectionHelp}
          </p>
        </section>
      )}

      {connected && (
        <div className="rvWatchConnectedBar">
          <div>
            <span className="rvWatchConnectedDot" />
            <strong>{t.connected}</strong>
          </div>

          <details>
            <summary>{t.manage}</summary>
            <p>{t.connectionHelp}</p>
            {SHORTCUT_INSTALL_URL && (
              <a href={SHORTCUT_INSTALL_URL} target="_blank" rel="noreferrer" className="rvWatchSimpleLinkButton">
                <Watch size={15} />
                {language === 'pt-BR' ? 'Instalar / atualizar atalho de análise' : 'Install / update analysis shortcut'}
              </a>
            )}
            <button
              type="button"
              onClick={() => void revoke()}
              disabled={busy}
            >
              {t.disconnect}
            </button>
          </details>
        </div>
      )}

      {connected && (
        <section className={`rvWatchAnalysisCard ${analysisReady ? 'ready' : ''}`}>
          <div className="rvWatchSimpleSectionHead">
            <div>
              <span>{analysisReady ? t.analysisReady : t.analysisEyebrow}</span>
              <h2>{analysisReady ? t.analysisPeriod : t.analysisTitle}</h2>
            </div>
            <HeartPulse size={21} />
          </div>

          <p className="rvWatchAnalysisCopy">
            {analysisReady && analysisRows.length
              ? `${fmtShort(analysisRows.at(-1)!.measured_at)} – ${fmtShort(analysisRows[0].measured_at)}`
              : t.analysisText}
          </p>

          <div className="rvWatchAnalysisMetrics">
            {analysisCards.map(({ metric, label, icon: Icon, value }) => {
              const latest = analysisRows.reduce<Sample | undefined>((recent, sample) => sample.metric === metric && (!recent || Date.parse(sample.measured_at) > Date.parse(recent.measured_at)) ? sample : recent, undefined)
              const notCollected = healthIntegration.collectedMetrics && !healthIntegration.collectedMetrics.includes(metric)
              return (
                <article key={metric}>
                  <Icon size={15} />
                  <span>{label}</span>
                  <strong>{value ?? t.noData}</strong>
                  <small>
                    {latest
                      ? `${language === 'pt-BR' ? 'Última leitura' : 'Latest reading'}: ${fmtShort(latest.measured_at)}`
                      : notCollected
                        ? (language === 'pt-BR' ? 'Não coletado pelo atalho atual' : 'Not collected by the current shortcut')
                        : (language === 'pt-BR' ? 'Nenhuma leitura recebida neste período' : 'No readings received for this period')}
                  </small>
                </article>
              )
            })}
          </div>
          <p className="rvWatchAnalysisCopy">
            {language === 'pt-BR'
              ? 'Passos, calorias e distância somam as amostras recebidas nos últimos 7 dias, não um treino nem o total consolidado do Fitness. Dados antigos sem horário original podem estar repetidos. Ausência de leitura não significa zero: confira a coleta e as permissões no Saúde.'
              : 'Steps, calories and distance sum received samples over the last 7 days, not a workout or the consolidated Fitness total. Older data without original timestamps may be duplicated. Missing readings do not mean zero: check collection and Health permissions.'}
          </p>

          <div className="rvWatchAnalysisBottom">
            <div>
              <small>{analysisReady ? t.setupDone : t.analysisNoData}</small>
              <span>{t.analysisHint}</span>
            </div>

            <a href={SHORTCUT_ANALYSIS} className="rvWatchAnalysisPrimary">
              <RefreshCw size={15} />
              {analysisReady ? t.analysisUpdate : t.analysisButton}
            </a>
          </div>
        </section>
      )}

      <section className={`rvWatchNowCard ${activeSession ? 'live' : ''}`}>
        <div className="rvWatchSimpleSectionHead">
          <div>
            <span>{activeSession ? t.currentWorkout : 'APPLE WATCH'}</span>
            <h2>{activeSession ? t.currentWorkout : t.noWorkout}</h2>
          </div>
          {activeSession ? <Activity size={21} /> : <TimerReset size={21} />}
        </div>

        {activeSession ? (
          <>
            <p className="rvWatchNowSub">
              {workoutName(activeSession.workout_type)} · {t.started}{' '}
              {fmtShort(activeSession.started_at)}
            </p>

            <div className="rvWatchNowMetrics">
              <article>
                <HeartPulse size={16} />
                <span>{t.beats}</span>
                <strong>{recentHeart ? `${Math.round(recentHeart.value)} bpm` : t.noData}</strong>
                <small>{recentHeart ? fmtShort(recentHeart.measured_at) : t.noData}</small>
              </article>
              <article>
                <Clock3 size={16} />
                <span>{t.elapsed}</span>
                <strong>{duration(activeSession, true)}</strong>
              </article>

              <article>
                <HeartPulse size={16} />
                <span>{t.minimum} / {t.maximum}</span>
                <strong>
                  {activeHeart
                    ? `${Math.round(activeHeart.min)}–${Math.round(
                        activeHeart.max,
                      )}`
                    : t.noData}
                </strong>
                <small>
                  {activeHeart
                    ? `${t.average} ${Math.round(activeHeart.avg)} bpm`
                    : 'bpm'}
                </small>
              </article>

              {activeEnergy && (
                <article>
                  <Flame size={16} />
                  <span>{t.calories}</span>
                  <strong>{activeEnergy}</strong>
                </article>
              )}
            </div>

            <Sparkline samples={activeRows} empty={t.chartEmpty} />

            <div className="rvWatchNowBottom">
              <small>
                {activeSession.last_synced_at
                  ? `${t.updated}: ${new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(-Math.max(0, Math.floor((Date.now() - Date.parse(activeSession.last_synced_at)) / 60000)), 'minute')}`
                  : t.updated}
              </small>

              <button type="button" onClick={() => SHORTCUT_SYNC ? window.location.assign(SHORTCUT_SYNC) : void load()} className="rvWatchSimplePrimary">
                <RefreshCw size={15} />
                {t.update}
              </button>
            </div>
          </>
        ) : (
          <p className="rvWatchEmptyCopy">{t.noWorkout} · {t.connectionHelp}</p>
        )}
      </section>

      {!activeSession && latestSession && (
        <section className="rvWatchLatestCard">
          <div className="rvWatchSimpleSectionHead">
            <div>
              <span>{t.latest}</span>
              <h2>
                {workoutName(latestSession.workout_type)} ·{' '}
                {fmtShort(latestSession.started_at)}
              </h2>
            </div>
            {latestHeart && latestEnergy ? <Check size={20} /> : <Clock3 size={20} />}
          </div>

          {(!latestHeart || !latestEnergy) && (
            <p className="rvWatchEmptyCopy">
              {language === 'pt-BR'
                ? `Treino encerrado; relatório parcial. Sem leituras de ${[!latestHeart && 'BPM', !latestEnergy && 'calorias ativas'].filter(Boolean).join(' e ')} neste intervalo. Execute a análise depois que os dados chegarem ao Saúde do iPhone.`
                : `Workout ended; partial report. Missing ${[!latestHeart && 'BPM', !latestEnergy && 'active calories'].filter(Boolean).join(' and ')} for this interval. Run analysis after iPhone Health receives the readings.`}
            </p>
          )}

          <div className="rvWatchLatestMetrics">
            <div>
              <span>{t.duration}</span>
              <strong>{duration(latestSession)}</strong>
            </div>

            <div>
              <span>{t.beats}</span>
              <strong>
                {latestHeart
                  ? `${Math.round(latestHeart.min)}–${Math.round(
                      latestHeart.max,
                    )} bpm`
                  : t.noData}
              </strong>
              {latestHeart && (
                <small>
                  {t.average} {Math.round(latestHeart.avg)} bpm
                </small>
              )}
            </div>

            {latestEnergy && (
              <div>
                <span>{t.calories}</span>
                <strong>{latestEnergy}</strong>
              </div>
            )}
          </div>

          <button
            type="button"
            className="rvWatchSimpleLinkButton"
            onClick={() =>
              setSelectedId(
                selectedId === latestSession.id ? null : latestSession.id,
              )
            }
          >
            {t.details}
            <ChevronRight size={15} />
          </button>
        </section>
      )}

      <section className="rvWatchHistorySimple">
        <div className="rvWatchSimpleSectionHead">
          <div>
            <span>HISTÓRICO</span>
            <h2>{t.history}</h2>
          </div>
          <Clock3 size={20} />
        </div>

        <p>{t.historyText}</p>

        {loading ? (
          <div className="rvWatchSimpleEmpty">
            <RefreshCw className="rvWatchSimpleSpin" size={18} />
          </div>
        ) : completedSessions.length === 0 ? (
          <div className="rvWatchSimpleEmpty">{t.noHistory}</div>
        ) : (
          <div className="rvWatchHistorySimpleList">
            {completedSessions.slice(0, 12).map((session) => {
              const heart = statsFor(workoutHeartSamples(session), 'heart_rate')
              const energy = totalMetric(session, 'active_energy', 0)
              const selected = selectedId === session.id

              return (
                <button
                  type="button"
                  key={session.id}
                  className={selected ? 'selected' : ''}
                  onClick={() => setSelectedId(selected ? null : session.id)}
                >
                  <div className="rvWatchHistorySimpleMain">
                    <span>{fmtDate(session.started_at)}</span>
                    <strong>{workoutName(session.workout_type)}</strong>
                    {(!heart || !energy) && <span>{language === 'pt-BR' ? 'Relatório parcial' : 'Partial report'}</span>}
                  </div>

                  <div className="rvWatchHistorySimpleSummary">
                    <span>
                      <Clock3 size={13} />
                      {duration(session)}
                    </span>
                    {heart && (
                      <span>
                        <HeartPulse size={13} />
                        {Math.round(heart.avg)} bpm
                      </span>
                    )}
                    {energy && (
                      <span>
                        <Flame size={13} />
                        {energy}
                      </span>
                    )}
                  </div>

                  <ChevronDown
                    size={16}
                    className={selected ? 'open' : ''}
                  />
                </button>
              )
            })}
          </div>
        )}
      </section>

      {selectedSession && (
        <section className="rvWatchDetailSimple">
          {!detailRows.length && (
            <p role="status" className="rvWatchEmptyCopy">
              {language === 'pt-BR'
                ? 'Início e fim recebidos, mas ainda não há leituras válidas neste intervalo. A automação de exercício não envia os dados de Saúde sozinha: execute a coleta no iPhone e atualize o RV. Não estimamos BPM ou calorias ausentes.'
                : 'Start and end received, but no valid readings arrived for this interval. Run Health data collection on iPhone, then refresh RV. Missing BPM and calories are not estimated.'}
            </p>
          )}
          <div className="rvWatchDetailHead">
            <div>
              <span>{t.finished}</span>
              <h2>{t.details}</h2>
              <p>
                {workoutName(selectedSession.workout_type)} ·{' '}
                {fmtDate(selectedSession.started_at)}
              </p>
            </div>

            <button
              type="button"
              aria-label={t.close}
              onClick={() => setSelectedId(null)}
            >
              <X size={17} />
            </button>
          </div>

          <div className="rvWatchDetailMainMetrics">
            <article>
              <Clock3 size={16} />
              <span>{t.duration}</span>
              <strong>{duration(selectedSession)}</strong>
            </article>

            <article>
              <HeartPulse size={16} />
              <span>{t.average}</span>
              <strong>
                {detailHeart ? `${Math.round(detailHeart.avg)} bpm` : t.noData}
              </strong>
            </article>

            <article>
              <HeartPulse size={16} />
              <span>{t.minimum}</span>
              <strong>
                {detailHeart ? `${Math.round(detailHeart.min)} bpm` : t.noData}
              </strong>
            </article>

            <article>
              <HeartPulse size={16} />
              <span>{t.maximum}</span>
              <strong>
                {detailHeart ? `${Math.round(detailHeart.max)} bpm` : t.noData}
              </strong>
            </article>

            {detailEnergy && (
              <article>
                <Flame size={16} />
                <span>{t.calories}</span>
                <strong>{detailEnergy}</strong>
              </article>
            )}

            {detailDistance && (
              <article>
                <Route size={16} />
                <span>{t.distance}</span>
                <strong>{detailDistance}</strong>
              </article>
            )}

            {detailSteps && (
              <article>
                <Footprints size={16} />
                <span>{t.steps}</span>
                <strong>{detailSteps}</strong>
              </article>
            )}
          </div>

          <div className="rvWatchDetailChart">
            <div>
              <strong>{t.chart}</strong>
              {detailHeart && (
                <small>
                  {detailHeart.count} {t.readings}
                </small>
              )}
            </div>
            <Sparkline samples={detailRows} empty={t.chartEmpty} />
          </div>

          {detailExtras.length > 0 && (
            <details className="rvWatchOtherData">
              <summary>{t.otherData}</summary>
              <div>
                {detailExtras.map((item) => (
                  <article key={item.key}>
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </article>
                ))}
              </div>
            </details>
          )}
        </section>
      )}

    </section>
  )
}
