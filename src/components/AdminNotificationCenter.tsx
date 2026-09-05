import {
  BellRing,
  CalendarClock,
  Clock3,
  Send,
  Trash2,
  UserRound,
  UsersRound,
} from 'lucide-react'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import type { Profile } from '../types'
import { supabase } from '../lib/supabase'
import { useI18n } from '../i18n'

type Audience = 'student' | 'all'
type ScheduleType = 'now' | 'once' | 'daily'

type Campaign = {
  id: number
  audience: Audience
  student_id: string | null
  title: string
  message: string
  schedule_type: ScheduleType
  scheduled_for: string | null
  daily_time: string | null
  timezone: string
  active: boolean
  next_run_at: string | null
  created_at: string
}

export default function AdminNotificationCenter({
  students,
}: {
  students: Profile[]
}) {
  const { locale } = useI18n()
  const activeStudents = useMemo(
    () => students.filter((student) => student.status === 'active'),
    [students],
  )

  const [audience, setAudience] = useState<Audience>('student')
  const [studentId, setStudentId] = useState('')
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [scheduleType, setScheduleType] =
    useState<ScheduleType>('now')
  const [onceAt, setOnceAt] = useState('')
  const [dailyTime, setDailyTime] = useState('17:00')
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loadingCampaigns, setLoadingCampaigns] = useState(true)

  useEffect(() => {
    if (!studentId && activeStudents[0]) {
      setStudentId(activeStudents[0].id)
    }
  }, [activeStudents, studentId])

  async function loadCampaigns() {
    setLoadingCampaigns(true)

    const { data, error } = await supabase
      .from('student_notification_campaigns')
      .select(
        'id,audience,student_id,title,message,schedule_type,scheduled_for,daily_time,timezone,active,next_run_at,created_at',
      )
      .eq('active', true)
      .in('schedule_type', ['once', 'daily'])
      .order('next_run_at', { ascending: true })

    if (!error) {
      setCampaigns((data as Campaign[]) ?? [])
    }

    setLoadingCampaigns(false)
  }

  useEffect(() => {
    void loadCampaigns()
  }, [])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setFeedback('')

    const normalizedTitle = title.trim()
    const normalizedMessage = message.trim()

    if (!normalizedTitle || !normalizedMessage) {
      setFeedback('Preencha o título e a mensagem.')
      return
    }

    if (audience === 'student' && !studentId) {
      setFeedback('Escolha o aluno que receberá a notificação.')
      return
    }

    let scheduledFor: string | null = null

    if (scheduleType === 'once') {
      if (!onceAt) {
        setFeedback('Escolha a data e o horário do envio.')
        return
      }

      const date = new Date(onceAt)

      if (Number.isNaN(date.getTime()) || date.getTime() <= Date.now()) {
        setFeedback('Escolha uma data futura.')
        return
      }

      scheduledFor = date.toISOString()
    }

    if (scheduleType === 'daily' && !dailyTime) {
      setFeedback('Escolha o horário diário.')
      return
    }

    setSaving(true)

    const { error } = await supabase.rpc(
      'create_student_notification_campaign',
      {
        p_audience: audience,
        p_student_id: audience === 'student' ? studentId : null,
        p_title: normalizedTitle,
        p_message: normalizedMessage,
        p_schedule_type: scheduleType,
        p_scheduled_for: scheduledFor,
        p_daily_time:
          scheduleType === 'daily' ? `${dailyTime}:00` : null,
        p_timezone: 'America/Sao_Paulo',
      },
    )

    if (error) {
      console.error('Falha ao criar campanha:', error)
      setFeedback('Não foi possível salvar ou enviar a notificação.')
      setSaving(false)
      return
    }

    if (scheduleType === 'now') {
      setFeedback(
        audience === 'all'
          ? 'Notificação enviada para todos os alunos ativos.'
          : 'Notificação enviada para o aluno selecionado.',
      )
    } else if (scheduleType === 'daily') {
      setFeedback(
        `Agendamento diário salvo para ${dailyTime} no horário de Brasília.`,
      )
    } else {
      setFeedback('Notificação agendada com sucesso.')
    }

    setTitle('')
    setMessage('')
    setOnceAt('')
    setSaving(false)
    await loadCampaigns()
  }

  async function cancel(id: number) {
    const ok = window.confirm(
      'Cancelar este agendamento de notificação?',
    )

    if (!ok) return

    const { error } = await supabase.rpc(
      'cancel_student_notification_campaign',
      { p_campaign_id: id },
    )

    if (error) {
      setFeedback('Não foi possível cancelar o agendamento.')
      return
    }

    setFeedback('Agendamento cancelado.')
    await loadCampaigns()
  }

  function recipientLabel(campaign: Campaign) {
    if (campaign.audience === 'all') return 'Todos os alunos'

    return (
      activeStudents.find((student) => student.id === campaign.student_id)
        ?.name || 'Aluno selecionado'
    )
  }

  function scheduleLabel(campaign: Campaign) {
    if (campaign.schedule_type === 'daily') {
      return `Todos os dias às ${(campaign.daily_time || '').slice(0, 5)}`
    }

    if (!campaign.next_run_at) return 'Agendado'

    return new Intl.DateTimeFormat(locale, {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(campaign.next_run_at))
  }

  return (
    <div className="adminStudentNotificationCenter">
      <div className="notificationCenterIntro">
        <div className="notificationCenterIcon">
          <BellRing size={20} />
        </div>

        <div>
          <strong>Central de notificações dos alunos</strong>
          <span>
            Envie agora, programe um horário ou repita todos os dias.
            A mensagem sempre fica no RV App; o push chega ao telefone
            quando o aluno autorizar.
          </span>
        </div>
      </div>

      <form className="notificationComposer" onSubmit={submit}>
        <div className="notificationAudiencePicker">
          <button
            type="button"
            className={audience === 'student' ? 'active' : ''}
            onClick={() => setAudience('student')}
          >
            <UserRound size={16} />
            Um aluno
          </button>

          <button
            type="button"
            className={audience === 'all' ? 'active' : ''}
            onClick={() => setAudience('all')}
          >
            <UsersRound size={16} />
            Todos
          </button>
        </div>

        {audience === 'student' && (
          <label>
            Aluno
            <select
              value={studentId}
              onChange={(event) => setStudentId(event.target.value)}
              required
            >
              {activeStudents.length === 0 ? (
                <option value="">Nenhum aluno ativo</option>
              ) : (
                activeStudents.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.name || student.email}
                  </option>
                ))
              )}
            </select>
          </label>
        )}

        <label>
          Título
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Ex.: Hora do treino"
            maxLength={80}
            required
          />
          <small>{title.length}/80</small>
        </label>

        <label>
          Mensagem
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Escreva a mensagem que aparecerá para o aluno."
            maxLength={500}
            required
          />
          <small>{message.length}/500</small>
        </label>

        <div className="notificationSchedulePicker">
          <button
            type="button"
            className={scheduleType === 'now' ? 'active' : ''}
            onClick={() => setScheduleType('now')}
          >
            <Send size={15} />
            Agora
          </button>

          <button
            type="button"
            className={scheduleType === 'once' ? 'active' : ''}
            onClick={() => setScheduleType('once')}
          >
            <CalendarClock size={15} />
            Agendar
          </button>

          <button
            type="button"
            className={scheduleType === 'daily' ? 'active' : ''}
            onClick={() => setScheduleType('daily')}
          >
            <Clock3 size={15} />
            Todo dia
          </button>
        </div>

        {scheduleType === 'once' && (
          <label>
            Data e horário
            <input
              type="datetime-local"
              value={onceAt}
              onChange={(event) => setOnceAt(event.target.value)}
              required
            />
            <small>Usa o horário local deste dispositivo.</small>
          </label>
        )}

        {scheduleType === 'daily' && (
          <label>
            Horário diário
            <input
              type="time"
              value={dailyTime}
              onChange={(event) => setDailyTime(event.target.value)}
              required
            />
            <small>Horário de Brasília · America/Sao_Paulo</small>
          </label>
        )}

        <button
          className="notificationComposerSubmit"
          disabled={
            saving ||
            !title.trim() ||
            !message.trim() ||
            (audience === 'student' && !studentId)
          }
        >
          <Send size={16} />
          {saving
            ? 'Salvando...'
            : scheduleType === 'now'
              ? 'Enviar notificação'
              : 'Salvar agendamento'}
        </button>
      </form>

      {feedback && (
        <div className="notificationCenterFeedback" role="status">
          {feedback}
        </div>
      )}

      <div className="scheduledNotifications">
        <div className="scheduledNotificationsHeader">
          <div>
            <span>AGENDAMENTOS</span>
            <strong>Próximos envios</strong>
          </div>

          <button
            type="button"
            onClick={() => void loadCampaigns()}
            disabled={loadingCampaigns}
          >
            Atualizar
          </button>
        </div>

        {loadingCampaigns ? (
          <p className="scheduledNotificationsEmpty">
            Carregando agendamentos...
          </p>
        ) : campaigns.length === 0 ? (
          <p className="scheduledNotificationsEmpty">
            Nenhuma notificação programada.
          </p>
        ) : (
          <div className="scheduledNotificationList">
            {campaigns.map((campaign) => (
              <article
                className="scheduledNotificationItem"
                key={campaign.id}
              >
                <div>
                  <strong>{campaign.title}</strong>
                  <span>{recipientLabel(campaign)}</span>
                  <small>{scheduleLabel(campaign)}</small>
                </div>

                <button
                  type="button"
                  onClick={() => void cancel(campaign.id)}
                  aria-label="Cancelar agendamento"
                >
                  <Trash2 size={15} />
                </button>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
