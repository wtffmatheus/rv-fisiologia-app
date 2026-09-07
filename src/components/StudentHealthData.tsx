import {
  Check,
  Copy,
  Database,
  Gauge,
  HeartPulse,
  KeyRound,
  RefreshCw,
} from 'lucide-react'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useI18n } from '../i18n'

type Sample = {
  id: string
  source: string
  metric: string
  value: number
  unit: string
  measured_at: string
  received_at: string
}

type Pressure = {
  id: string
  systolic: number
  diastolic: number
  pulse: number | null
  source: string
  measured_at: string
  created_at: string
}

type Status = {
  configured: boolean
  last_used_at?: string | null
}

const ENDPOINT =
  'https://ilnlnkcxajkarwviynbm.supabase.co/functions/v1/health-ingest'

const SHORTCUT =
  'shortcuts://run-shortcut?name=RV%20-%20Sincronizar%20Sa%C3%BAde'

const OFFICIAL_SHORTCUT =
  'https://www.icloud.com/shortcuts/7f89138a88834de78d0a256ba0418c5b'

export default function StudentHealthData({
  studentId,
}: {
  studentId: string
}) {
  const { language, locale } = useI18n()
  const [samples, setSamples] = useState<Sample[]>([])
  const [pressures, setPressures] = useState<Pressure[]>([])
  const [status, setStatus] = useState<Status>({ configured: false })
  const [token, setToken] = useState('')
  const [copied, setCopied] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [sys, setSys] = useState('')
  const [dia, setDia] = useState('')
  const [pulse, setPulse] = useState('')
  const [message, setMessage] = useState('')

  const strings = {
    'pt-BR': {
      title: 'Saúde & Watch',
      subtitle: 'Dados reais recebidos do Apple Saúde e do OMRON.',
      heart: 'Frequência cardíaca',
      noHeart: 'Sem leitura recebida',
      pressure: 'Pressão arterial',
      noPressure: 'Sem leitura registrada',
      lastSync: 'Última sincronização',
      never: 'Ainda não sincronizado',
      integration: 'Conectar Apple Saúde',
      integrationText:
        'Gere uma chave individual e use no Atalho RV do iPhone. Ela não dá acesso à sua conta.',
      generate: 'Gerar chave',
      regenerate: 'Gerar nova chave',
      revoke: 'Revogar',
      keyOnce: 'Copie esta chave agora. Ela só aparece neste momento.',
      endpoint: 'URL do receptor',
      key: 'Chave RV Health',
      copy: 'Copiar',
      copied: 'Copiado',
      shortcut: 'Executar Atalho RV',
      setup: 'Como montar o Atalho',
      step1: 'Crie um atalho chamado “RV - Sincronizar Saúde”.',
      step2:
        'Adicione “Buscar Amostras de Saúde” > Frequência Cardíaca > mais recente > limite 1.',
      step3:
        'Crie um Dicionário: source=apple_health, metric=heart_rate, value=valor, unit=bpm e measured_at=data.',
      step4:
        'Use “Obter Conteúdo do URL”: POST + JSON + URL abaixo + cabeçalho X-RV-Health-Key.',
      omron: 'Registrar pressão OMRON',
      omronText: 'Digite os três números do visor.',
      systolic: 'Sistólica',
      diastolic: 'Diastólica',
      pulse: 'Pulso',
      save: 'Salvar leitura',
      saving: 'Salvando...',
      saved: 'Leitura salva no RV.',
      invalid: 'Confira os valores antes de salvar.',
      recent: 'Dados recentes',
      empty: 'Nenhum dado do Apple Saúde recebido ainda.',
      history: 'Histórico de pressão',
      pressureEmpty: 'Nenhuma pressão registrada.',
      configured: 'Integração configurada',
      notConfigured: 'Integração não configurada',
      sourceWatch: 'Apple Watch · Apple Saúde',
      sourceOmron: 'OMRON HEM-6221',
    },
    en: {
      title: 'Health & Watch',
      subtitle: 'Real data received from Apple Health and OMRON.',
      heart: 'Heart rate',
      noHeart: 'No reading received',
      pressure: 'Blood pressure',
      noPressure: 'No reading recorded',
      lastSync: 'Last sync',
      never: 'Not synced yet',
      integration: 'Connect Apple Health',
      integrationText: 'Generate an individual key for the RV Shortcut.',
      generate: 'Generate key',
      regenerate: 'Generate new key',
      revoke: 'Revoke',
      keyOnce: 'Copy this key now. It is only shown once.',
      endpoint: 'Receiver URL',
      key: 'RV Health key',
      copy: 'Copy',
      copied: 'Copied',
      shortcut: 'Run RV Shortcut',
      setup: 'Shortcut setup',
      step1: 'Create “RV - Sincronizar Saúde”.',
      step2: 'Find the newest Heart Rate health sample, limit 1.',
      step3: 'Create a Dictionary with source, metric, value, unit and measured_at.',
      step4: 'POST JSON to the URL below with X-RV-Health-Key.',
      omron: 'Record OMRON pressure',
      omronText: 'Enter the three values from the display.',
      systolic: 'Systolic',
      diastolic: 'Diastolic',
      pulse: 'Pulse',
      save: 'Save reading',
      saving: 'Saving...',
      saved: 'Reading saved in RV.',
      invalid: 'Check the values before saving.',
      recent: 'Recent data',
      empty: 'No Apple Health data received yet.',
      history: 'Pressure history',
      pressureEmpty: 'No pressure readings.',
      configured: 'Integration configured',
      notConfigured: 'Integration not configured',
      sourceWatch: 'Apple Watch · Apple Health',
      sourceOmron: 'OMRON HEM-6221',
    },
    es: {
      title: 'Salud & Watch',
      subtitle: 'Datos reales de Apple Salud y OMRON.',
      heart: 'Frecuencia cardíaca',
      noHeart: 'Sin lectura recibida',
      pressure: 'Presión arterial',
      noPressure: 'Sin lectura registrada',
      lastSync: 'Última sincronización',
      never: 'Aún sin sincronizar',
      integration: 'Conectar Apple Salud',
      integrationText: 'Genera una clave individual para el Atajo RV.',
      generate: 'Generar clave',
      regenerate: 'Generar nueva clave',
      revoke: 'Revocar',
      keyOnce: 'Copia esta clave ahora. Solo aparece una vez.',
      endpoint: 'URL del receptor',
      key: 'Clave RV Health',
      copy: 'Copiar',
      copied: 'Copiado',
      shortcut: 'Ejecutar Atajo RV',
      setup: 'Configurar Atajo',
      step1: 'Crea “RV - Sincronizar Saúde”.',
      step2: 'Busca la muestra de frecuencia cardíaca más reciente.',
      step3: 'Crea un Diccionario con source, metric, value, unit y measured_at.',
      step4: 'POST JSON a la URL con X-RV-Health-Key.',
      omron: 'Registrar presión OMRON',
      omronText: 'Escribe los tres valores de la pantalla.',
      systolic: 'Sistólica',
      diastolic: 'Diastólica',
      pulse: 'Pulso',
      save: 'Guardar lectura',
      saving: 'Guardando...',
      saved: 'Lectura guardada.',
      invalid: 'Revisa los valores.',
      recent: 'Datos recientes',
      empty: 'Aún no hay datos de Apple Salud.',
      history: 'Historial de presión',
      pressureEmpty: 'No hay lecturas.',
      configured: 'Integración configurada',
      notConfigured: 'Integración no configurada',
      sourceWatch: 'Apple Watch · Apple Salud',
      sourceOmron: 'OMRON HEM-6221',
    },
    'zh-CN': {
      title: '健康 & Watch',
      subtitle: '来自 Apple 健康和 OMRON 的真实数据。',
      heart: '心率',
      noHeart: '暂无数据',
      pressure: '血压',
      noPressure: '暂无记录',
      lastSync: '上次同步',
      never: '尚未同步',
      integration: '连接 Apple 健康',
      integrationText: '为 iPhone 的 RV 快捷指令生成个人密钥。',
      generate: '生成密钥',
      regenerate: '生成新密钥',
      revoke: '撤销',
      keyOnce: '请立即复制，此密钥只显示一次。',
      endpoint: '接收 URL',
      key: 'RV Health 密钥',
      copy: '复制',
      copied: '已复制',
      shortcut: '运行 RV 快捷指令',
      setup: '快捷指令设置',
      step1: '创建 “RV - Sincronizar Saúde”。',
      step2: '查找最新心率样本，限制 1。',
      step3: '创建包含 source、metric、value、unit、measured_at 的字典。',
      step4: 'POST JSON 到 URL，并添加 X-RV-Health-Key。',
      omron: '记录 OMRON 血压',
      omronText: '输入屏幕上的三个数值。',
      systolic: '收缩压',
      diastolic: '舒张压',
      pulse: '脉搏',
      save: '保存',
      saving: '保存中...',
      saved: '已保存。',
      invalid: '请检查数值。',
      recent: '最近数据',
      empty: '尚未收到 Apple 健康数据。',
      history: '血压历史',
      pressureEmpty: '暂无血压记录。',
      configured: '集成已配置',
      notConfigured: '集成未配置',
      sourceWatch: 'Apple Watch · Apple 健康',
      sourceOmron: 'OMRON HEM-6221',
    },
    de: {
      title: 'Gesundheit & Watch',
      subtitle: 'Echte Daten aus Apple Health und OMRON.',
      heart: 'Herzfrequenz',
      noHeart: 'Keine Messung',
      pressure: 'Blutdruck',
      noPressure: 'Keine Messung',
      lastSync: 'Letzte Synchronisierung',
      never: 'Noch nicht synchronisiert',
      integration: 'Apple Health verbinden',
      integrationText: 'Erzeuge einen individuellen Schlüssel für den RV-Kurzbefehl.',
      generate: 'Schlüssel erzeugen',
      regenerate: 'Neuen Schlüssel erzeugen',
      revoke: 'Widerrufen',
      keyOnce: 'Jetzt kopieren. Der Schlüssel wird nur einmal gezeigt.',
      endpoint: 'Empfänger-URL',
      key: 'RV Health Schlüssel',
      copy: 'Kopieren',
      copied: 'Kopiert',
      shortcut: 'RV-Kurzbefehl ausführen',
      setup: 'Kurzbefehl einrichten',
      step1: 'Erstelle “RV - Sincronizar Saúde”.',
      step2: 'Hole die neueste Herzfrequenz-Probe.',
      step3: 'Erstelle ein Wörterbuch mit source, metric, value, unit und measured_at.',
      step4: 'POST JSON an die URL mit X-RV-Health-Key.',
      omron: 'OMRON-Blutdruck erfassen',
      omronText: 'Gib die drei Werte vom Display ein.',
      systolic: 'Systolisch',
      diastolic: 'Diastolisch',
      pulse: 'Puls',
      save: 'Speichern',
      saving: 'Speichern...',
      saved: 'Messung gespeichert.',
      invalid: 'Bitte Werte prüfen.',
      recent: 'Aktuelle Daten',
      empty: 'Noch keine Apple-Health-Daten.',
      history: 'Blutdruckverlauf',
      pressureEmpty: 'Keine Messungen.',
      configured: 'Integration eingerichtet',
      notConfigured: 'Integration nicht eingerichtet',
      sourceWatch: 'Apple Watch · Apple Health',
      sourceOmron: 'OMRON HEM-6221',
    },
  } as const

  const t = strings[language]

  const simple = {
    'pt-BR': {
      title: 'Conectar Apple Saúde',
      text: 'Configure uma vez. Depois, o Atalho RV envia ao RV os dados autorizados do Apple Saúde.',
      once: 'Você só precisa fazer isso uma vez',
      step1: '1. Criar código',
      step1Text: 'O RV cria seu código pessoal e já copia automaticamente.',
      createCode: 'Criar e copiar código',
      newCode: 'Criar novo código',
      codeCopied: 'Código copiado',
      step2: '2. Instalar integração',
      step2Text: 'Abra o atalho oficial do RV e adicione ao seu iPhone.',
      install: 'Instalar no iPhone',
      pasteHint: 'Quando o iPhone pedir, cole o código que o RV acabou de copiar.',
      step3: '3. Enviar dados',
      step3Text: 'Depois de instalado, use este botão para buscar a leitura mais recente no Apple Saúde e enviar ao RV.',
      sync: 'Atualizar dados agora',
      ready: 'Atalho pronto para enviar',
      notReady: 'Falta concluir a configuração',
      yourCode: 'Seu código de conexão',
      copyCode: 'Copiar código',
      advanced: 'Avançado',
      advancedText: 'Informações técnicas e opção para revogar a conexão.',
      revoke: 'Desconectar Apple Saúde',
    },
    en: {
      title: 'Connect Apple Health',
      text: 'Set it up once. Then the RV Shortcut sends authorized Apple Health data to RV.',
      once: 'You only need to do this once',
      step1: '1. Create code',
      step1Text: 'RV creates your personal code and copies it automatically.',
      createCode: 'Create and copy code',
      newCode: 'Create new code',
      codeCopied: 'Code copied',
      step2: '2. Install integration',
      step2Text: 'Open the official RV Shortcut and add it to your iPhone.',
      install: 'Install on iPhone',
      pasteHint: 'When prompted, paste the code RV just copied.',
      step3: '3. Send data',
      step3Text: 'After installation, use this button to fetch the latest Apple Health reading and send it to RV.',
      sync: 'Update data now',
      ready: 'Shortcut ready to send',
      notReady: 'Setup is not complete yet',
      yourCode: 'Your connection code',
      copyCode: 'Copy code',
      advanced: 'Advanced',
      advancedText: 'Technical information and disconnect option.',
      revoke: 'Disconnect Apple Health',
    },
    es: {
      title: 'Conectar Apple Salud',
      text: 'Configúralo una vez. Luego el Atajo RV envía a RV los datos autorizados de Apple Salud.',
      once: 'Solo necesitas hacer esto una vez',
      step1: '1. Crear código',
      step1Text: 'RV crea tu código personal y lo copia automáticamente.',
      createCode: 'Crear y copiar código',
      newCode: 'Crear nuevo código',
      codeCopied: 'Código copiado',
      step2: '2. Instalar integración',
      step2Text: 'Abre el Atajo oficial de RV y agrégalo al iPhone.',
      install: 'Instalar en iPhone',
      pasteHint: 'Cuando lo pida, pega el código copiado por RV.',
      step3: '3. Enviar datos',
      step3Text: 'Después de instalar, usa este botón para buscar la última lectura en Apple Salud y enviarla a RV.',
      sync: 'Actualizar datos ahora',
      ready: 'Atajo listo para enviar',
      notReady: 'Falta terminar la configuración',
      yourCode: 'Tu código de conexión',
      copyCode: 'Copiar código',
      advanced: 'Avanzado',
      advancedText: 'Información técnica y opción para desconectar.',
      revoke: 'Desconectar Apple Salud',
    },
    'zh-CN': {
      title: '连接 Apple 健康',
      text: '只需设置一次。之后 RV 快捷指令会把已授权的 Apple 健康数据发送到 RV。',
      once: '只需要设置一次',
      step1: '1. 创建代码',
      step1Text: 'RV 会创建个人代码并自动复制。',
      createCode: '创建并复制代码',
      newCode: '创建新代码',
      codeCopied: '代码已复制',
      step2: '2. 安装集成',
      step2Text: '打开 RV 官方快捷指令并添加到 iPhone。',
      install: '安装到 iPhone',
      pasteHint: '提示时粘贴 RV 刚刚复制的代码。',
      step3: '3. 发送数据',
      step3Text: '安装完成后，使用此按钮发送数据。',
      sync: '立即更新数据',
      ready: '快捷指令已可发送',
      notReady: '尚未完成设置',
      yourCode: '连接代码',
      copyCode: '复制代码',
      advanced: '高级',
      advancedText: '技术信息和断开连接选项。',
      revoke: '断开 Apple 健康',
    },
    de: {
      title: 'Apple Health verbinden',
      text: 'Einmal einrichten. Danach sendet der RV-Kurzbefehl freigegebene Apple-Health-Daten an RV.',
      once: 'Nur einmal erforderlich',
      step1: '1. Code erstellen',
      step1Text: 'RV erstellt deinen persönlichen Code und kopiert ihn automatisch.',
      createCode: 'Code erstellen und kopieren',
      newCode: 'Neuen Code erstellen',
      codeCopied: 'Code kopiert',
      step2: '2. Integration installieren',
      step2Text: 'Öffne den offiziellen RV-Kurzbefehl und füge ihn dem iPhone hinzu.',
      install: 'Auf iPhone installieren',
      pasteHint: 'Wenn gefragt, füge den von RV kopierten Code ein.',
      step3: '3. Daten senden',
      step3Text: 'Nach der Installation sendest du hier deine Daten.',
      sync: 'Daten jetzt aktualisieren',
      ready: 'Kurzbefehl bereit zum Senden',
      notReady: 'Einrichtung noch nicht abgeschlossen',
      yourCode: 'Verbindungscode',
      copyCode: 'Code kopieren',
      advanced: 'Erweitert',
      advancedText: 'Technische Informationen und Trennen-Option.',
      revoke: 'Apple Health trennen',
    },
  } as const

  const s = simple[language]
  const tokenStorageKey = `rv_health_setup_token_${studentId}`
  const verified = Boolean(status.last_used_at)

  function acceptStatus(nextStatus: Status) {
    setStatus(nextStatus)

    if (nextStatus.last_used_at) {
      setToken('')
      try {
        window.localStorage.removeItem(tokenStorageKey)
      } catch {
        // Storage pode estar indisponivel em modos privados/restritos.
      }
    }
  }

  async function load() {
    setLoading(true)
    const [a, b, c] = await Promise.all([
      supabase
        .from('health_samples')
        .select('id,source,metric,value,unit,measured_at,received_at')
        .eq('student_id', studentId)
        .order('measured_at', { ascending: false })
        .limit(30),
      supabase
        .from('blood_pressure_readings')
        .select('id,systolic,diastolic,pulse,source,measured_at,created_at')
        .eq('student_id', studentId)
        .order('measured_at', { ascending: false })
        .limit(20),
      supabase.rpc('get_own_health_ingest_status'),
    ])

    if (!a.error) setSamples((a.data as Sample[]) ?? [])
    if (!b.error) setPressures((b.data as Pressure[]) ?? [])
    if (!c.error && c.data) acceptStatus(c.data as Status)
    setLoading(false)
  }

  useEffect(() => {
    void load()

    const channel = supabase
      .channel(`rv-health-${studentId}`)
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
          setSamples((current) =>
            [row, ...current.filter((item) => item.id !== row.id)].slice(0, 30),
          )
          void refreshStatus()
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'blood_pressure_readings',
          filter: `student_id=eq.${studentId}`,
        },
        (payload) => {
          const row = payload.new as Pressure
          setPressures((current) =>
            [row, ...current.filter((item) => item.id !== row.id)].slice(0, 20),
          )
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [studentId])

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(tokenStorageKey) || ''
      if (stored) setToken(stored)
    } catch {
      // Mantem o fluxo funcional mesmo sem localStorage.
    }

    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void load()
    }
    const refreshOnPageShow = () => {
      void load()
    }

    document.addEventListener('visibilitychange', refreshWhenVisible)
    window.addEventListener('pageshow', refreshOnPageShow)

    return () => {
      document.removeEventListener('visibilitychange', refreshWhenVisible)
      window.removeEventListener('pageshow', refreshOnPageShow)
    }
  }, [studentId])

  async function refreshStatus() {
    const { data, error } = await supabase.rpc('get_own_health_ingest_status')
    if (!error && data) acceptStatus(data as Status)
  }

  const heart = useMemo(
    () => samples.find((item) => item.metric === 'heart_rate') ?? null,
    [samples],
  )

  const pressure = pressures[0] ?? null

  const latest = useMemo(() => {
    const values = [
      status.last_used_at,
      samples[0]?.received_at,
      pressures[0]?.created_at,
    ]
      .filter(Boolean)
      .map((value) => new Date(String(value)).getTime())
      .filter(Number.isFinite)

    return values.length ? new Date(Math.max(...values)) : null
  }, [status, samples, pressures])

  function date(value: string | Date) {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(value instanceof Date ? value : new Date(value))
  }

  async function rotate() {
    setBusy(true)
    setToken('')
    const { data, error } = await supabase.rpc(
      'rotate_own_health_ingest_token',
      { p_label: 'iPhone / Atalhos' },
    )

    if (!error && data) {
      const result = data as { token?: string }
      const nextToken = result.token || ''
      setToken(nextToken)
      setStatus({ configured: true, last_used_at: null })

      if (nextToken) {
        try {
          window.localStorage.setItem(tokenStorageKey, nextToken)
        } catch {
          // O codigo continua visivel/copiavel mesmo sem persistencia local.
        }

        try {
          await navigator.clipboard.writeText(nextToken)
          setCopied('key')
          window.setTimeout(() => setCopied(''), 2200)
        } catch {
          // O botao de copiar continua disponivel como fallback.
        }
      }
    }

    setBusy(false)
  }

  async function revoke() {
    setBusy(true)
    const { error } = await supabase.rpc('revoke_own_health_ingest_token')
    if (!error) {
      setStatus({ configured: false })
      setToken('')
      try {
        window.localStorage.removeItem(tokenStorageKey)
      } catch {
        // Nada a fazer.
      }
    }
    setBusy(false)
  }

  async function copy(id: string, value: string) {
    await navigator.clipboard.writeText(value)
    setCopied(id)
    window.setTimeout(() => setCopied(''), 1500)
  }

  async function savePressure(event: FormEvent) {
    event.preventDefault()
    setMessage('')

    const a = Number(sys)
    const b = Number(dia)
    const c = pulse ? Number(pulse) : null

    if (
      !Number.isFinite(a) ||
      !Number.isFinite(b) ||
      a < 40 ||
      a > 350 ||
      b < 20 ||
      b > 250 ||
      (c !== null && (!Number.isFinite(c) || c < 20 || c > 300))
    ) {
      setMessage(t.invalid)
      return
    }

    setBusy(true)

    const { error } = await supabase
      .from('blood_pressure_readings')
      .insert({
        student_id: studentId,
        systolic: Math.round(a),
        diastolic: Math.round(b),
        pulse: c === null ? null : Math.round(c),
        source: 'omron_hem_6221',
        measured_at: new Date().toISOString(),
      })

    if (error) {
      setMessage(error.message)
    } else {
      setSys('')
      setDia('')
      setPulse('')
      setMessage(t.saved)
    }

    setBusy(false)
  }

  return (
    <section className="rvHealthModule" data-rv-health-module="v18">
      <div className="rvHealthModuleHead">
        <div>
          <span>RV HEALTH</span>
          <h2>{t.title}</h2>
          <p>{t.subtitle}</p>
        </div>
        <HeartPulse size={23} />
      </div>

      <div className="rvHealthQuickGrid">
        <article>
          <HeartPulse size={18} />
          <span>{t.heart}</span>
          <strong>
            {heart
              ? `${Math.round(heart.value)} ${heart.unit}`
              : t.noHeart}
          </strong>
          <small>
            {heart ? `${t.sourceWatch} · ${date(heart.measured_at)}` : t.sourceWatch}
          </small>
        </article>

        <article>
          <Gauge size={18} />
          <span>{t.pressure}</span>
          <strong>
            {pressure
              ? `${pressure.systolic} / ${pressure.diastolic} mmHg`
              : t.noPressure}
          </strong>
          <small>
            {pressure
              ? `${pressure.pulse ? `${t.pulse} ${pressure.pulse} · ` : ''}${date(
                  pressure.measured_at,
                )}`
              : t.sourceOmron}
          </small>
        </article>

        <article>
          <RefreshCw size={18} />
          <span>{t.lastSync}</span>
          <strong>{latest ? date(latest) : t.never}</strong>
          <small>
            {verified
              ? t.configured
              : status.configured
                ? s.ready
                : t.notConfigured}
          </small>
        </article>
      </div>

      <div className="rvHealthTwoColumns">
        <section className="rvHealthBox rvHealthSimpleSetup">
          <div className="rvHealthBoxHead">
            <div>
              <span>APPLE HEALTH</span>
              <h3>{s.title}</h3>
            </div>
            <KeyRound size={19} />
          </div>

          <p>{s.text}</p>

          <div className="rvHealthOnceNote">
            <Check size={15} />
            {s.once}
          </div>

          <div className="rvHealthSimpleSteps">
            <article className={status.configured ? 'done' : ''}>
              <span className="rvHealthStepNumber">1</span>
              <div>
                <strong>{s.step1}</strong>
                <p>{s.step1Text}</p>

                <button
                  type="button"
                  className="rvHealthSimplePrimary"
                  onClick={() => void rotate()}
                  disabled={busy}
                >
                  <KeyRound size={15} />
                  {token
                    ? s.codeCopied
                    : status.configured
                      ? s.newCode
                      : s.createCode}
                </button>
              </div>
            </article>

            <article>
              <span className="rvHealthStepNumber">2</span>
              <div>
                <strong>{s.step2}</strong>
                <p>{s.step2Text}</p>

                <a
                  className="rvHealthSimplePrimary"
                  href={OFFICIAL_SHORTCUT}
                  target="_blank"
                  rel="noreferrer"
                >
                  {s.install}
                </a>

                <small>{s.pasteHint}</small>
              </div>
            </article>

            <article className={verified ? 'done' : ''}>
              <span className="rvHealthStepNumber">3</span>
              <div>
                <strong>{s.step3}</strong>
                <p>{s.step3Text}</p>

                <a
                  className={
                    status.configured
                      ? 'rvHealthSimplePrimary'
                      : 'rvHealthSimplePrimary disabled'
                  }
                  href={status.configured ? SHORTCUT : undefined}
                  aria-disabled={!status.configured}
                >
                  <RefreshCw size={15} />
                  {s.sync}
                </a>

                <small>
                  {verified
                    ? t.configured
                    : status.configured
                      ? s.ready
                      : s.notReady}
                </small>
              </div>
            </article>
          </div>

          {token && (
            <div className="rvHealthSimpleCode">
              <div>
                <small>{s.yourCode}</small>
                <code>{token}</code>
              </div>

              <button
                type="button"
                onClick={() => void copy('key', token)}
              >
                {copied === 'key' ? (
                  <Check size={14} />
                ) : (
                  <Copy size={14} />
                )}
                {copied === 'key'
                  ? t.copied
                  : s.copyCode}
              </button>
            </div>
          )}

          <details className="rvHealthSetup rvHealthAdvanced">
            <summary>{s.advanced}</summary>
            <p>{s.advancedText}</p>

            <div className="rvHealthAdvancedRow">
              <small>{t.endpoint}</small>
              <code>{ENDPOINT}</code>
            </div>

            <div className="rvHealthAdvancedRow">
              <small>Header</small>
              <code>X-RV-Health-Key</code>
            </div>

            {status.configured && (
              <button
                type="button"
                className="rvHealthDisconnect"
                onClick={() => void revoke()}
                disabled={busy}
              >
                {s.revoke}
              </button>
            )}
          </details>
        </section>

        <section className="rvHealthBox">
          <div className="rvHealthBoxHead">
            <div>
              <span>OMRON HEM-6221</span>
              <h3>{t.omron}</h3>
            </div>
            <Gauge size={19} />
          </div>

          <p>{t.omronText}</p>

          <form className="rvPressureMiniForm" onSubmit={savePressure}>
            <label>
              <span>{t.systolic}</span>
              <input
                type="number"
                inputMode="numeric"
                value={sys}
                onChange={(event) => setSys(event.target.value)}
                placeholder="120"
                required
              />
            </label>

            <label>
              <span>{t.diastolic}</span>
              <input
                type="number"
                inputMode="numeric"
                value={dia}
                onChange={(event) => setDia(event.target.value)}
                placeholder="80"
                required
              />
            </label>

            <label>
              <span>{t.pulse}</span>
              <input
                type="number"
                inputMode="numeric"
                value={pulse}
                onChange={(event) => setPulse(event.target.value)}
                placeholder="72"
              />
            </label>

            <button disabled={busy}>
              <Gauge size={15} />
              {busy ? t.saving : t.save}
            </button>
          </form>

          {message && (
            <div className="rvHealthMessage" role="status">
              {message}
            </div>
          )}
        </section>
      </div>

      <div className="rvHealthTwoColumns">
        <section className="rvHealthBox">
          <div className="rvHealthBoxHead">
            <div>
              <span>APPLE HEALTH</span>
              <h3>{t.recent}</h3>
            </div>
            <Database size={19} />
          </div>

          {loading ? (
            <div className="rvHealthEmpty">
              <RefreshCw className="rvHealthSpin" size={18} />
            </div>
          ) : samples.length === 0 ? (
            <div className="rvHealthEmpty">{t.empty}</div>
          ) : (
            <div className="rvHealthList">
              {samples.slice(0, 8).map((item) => (
                <article key={item.id}>
                  <span>
                    <strong>{item.metric.replaceAll('_', ' ')}</strong>
                    <small>{date(item.measured_at)}</small>
                  </span>
                  <b>
                    {Number.isInteger(item.value)
                      ? item.value
                      : item.value.toFixed(1)}{' '}
                    {item.unit}
                  </b>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="rvHealthBox">
          <div className="rvHealthBoxHead">
            <div>
              <span>OMRON</span>
              <h3>{t.history}</h3>
            </div>
            <Database size={19} />
          </div>

          {pressures.length === 0 ? (
            <div className="rvHealthEmpty">{t.pressureEmpty}</div>
          ) : (
            <div className="rvHealthList">
              {pressures.slice(0, 8).map((item) => (
                <article key={item.id}>
                  <span>
                    <strong>
                      {item.systolic} / {item.diastolic} mmHg
                    </strong>
                    <small>{date(item.measured_at)}</small>
                  </span>
                  <b>{item.pulse ? `${item.pulse} bpm` : '—'}</b>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </section>
  )
}
