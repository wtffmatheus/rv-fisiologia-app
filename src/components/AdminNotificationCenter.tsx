import {
  CalendarClock,
  Clock3,
  Send,
  X,
} from 'lucide-react'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import type { Profile } from '../types'
import { supabase } from '../lib/supabase'
import { useI18n } from '../i18n'
import SettingsAccordion from './SettingsAccordion'

type ScheduleType = 'now' | 'once' | 'daily'

type Campaign = {
  id: number
  audience: 'student' | 'all'
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

const copy = {
  'pt-BR': {
    accordionTitle: 'Envios aos alunos',
    accordionSubtitle: 'Escolha quem recebe, escreva a mensagem e defina quando enviar.',
    recipients: 'Destinatários',
    all: 'Todos os alunos',
    allHelp: 'Selecionar todos os alunos ativos',
    selected: 'selecionado(s)',
    noActive: 'Nenhum aluno ativo disponível.',
    title: 'Título',
    titlePlaceholder: 'Ex.: Hora do treino',
    message: 'Mensagem',
    messagePlaceholder: 'Escreva a mensagem que aparecerá para o aluno.',
    now: 'Agora',
    once: 'Agendar',
    daily: 'Todo dia',
    dateTime: 'Data e horário',
    localTime: 'Usa o horário local deste dispositivo.',
    dailyTime: 'Horário diário',
    brasilia: 'Horário de Brasília · America/Sao_Paulo',
    sending: 'Salvando...',
    send: 'Enviar notificação',
    save: 'Salvar agendamento',
    requiredMessage: 'Preencha o título e a mensagem.',
    chooseStudent: 'Selecione pelo menos um aluno.',
    future: 'Escolha uma data futura.',
    chooseDate: 'Escolha a data e o horário do envio.',
    chooseTime: 'Escolha o horário diário.',
    failed: 'Não foi possível salvar ou enviar a notificação.',
    sentAll: 'Notificação enviada para todos os alunos ativos.',
    sentSelected: 'Notificação enviada para os alunos selecionados.',
    partial: 'Parte dos envios não pôde ser concluída.',
    dailySaved: 'Agendamento diário salvo para {time} no horário de Brasília.',
    scheduled: 'Notificação agendada com sucesso.',
    schedules: 'Agendamentos',
    schedulesSubtitle: '{count} ativo(s)',
    loading: 'Carregando agendamentos...',
    empty: 'Nenhuma notificação programada.',
    cancel: 'Cancelar agendamento',
    cancelConfirm: 'Cancelar este agendamento de notificação?',
    cancelError: 'Não foi possível cancelar o agendamento.',
    cancelled: 'Agendamento cancelado.',
    refresh: 'Atualizar',
    everyDay: 'Todos os dias às {time}',
    allStudents: 'Todos os alunos',
    selectedStudent: 'Aluno selecionado',
  },
  en: {
    accordionTitle: 'Student messages',
    accordionSubtitle: 'Choose recipients, write the message and decide when to send it.',
    recipients: 'Recipients',
    all: 'All students',
    allHelp: 'Select all active students',
    selected: 'selected',
    noActive: 'No active students available.',
    title: 'Title',
    titlePlaceholder: 'Example: Training time',
    message: 'Message',
    messagePlaceholder: 'Write the message the student will receive.',
    now: 'Now',
    once: 'Schedule',
    daily: 'Daily',
    dateTime: 'Date and time',
    localTime: 'Uses this device local time.',
    dailyTime: 'Daily time',
    brasilia: 'Brasília time · America/Sao_Paulo',
    sending: 'Saving...',
    send: 'Send notification',
    save: 'Save schedule',
    requiredMessage: 'Fill in the title and message.',
    chooseStudent: 'Select at least one student.',
    future: 'Choose a future date.',
    chooseDate: 'Choose the send date and time.',
    chooseTime: 'Choose the daily time.',
    failed: 'Could not save or send the notification.',
    sentAll: 'Notification sent to all active students.',
    sentSelected: 'Notification sent to the selected students.',
    partial: 'Some deliveries could not be completed.',
    dailySaved: 'Daily schedule saved for {time} Brasília time.',
    scheduled: 'Notification scheduled successfully.',
    schedules: 'Schedules',
    schedulesSubtitle: '{count} active',
    loading: 'Loading schedules...',
    empty: 'No scheduled notifications.',
    cancel: 'Cancel schedule',
    cancelConfirm: 'Cancel this notification schedule?',
    cancelError: 'Could not cancel the schedule.',
    cancelled: 'Schedule cancelled.',
    refresh: 'Refresh',
    everyDay: 'Every day at {time}',
    allStudents: 'All students',
    selectedStudent: 'Selected student',
  },
  es: {
    accordionTitle: 'Envíos a alumnos',
    accordionSubtitle: 'Elige destinatarios, escribe el mensaje y define cuándo enviarlo.',
    recipients: 'Destinatarios',
    all: 'Todos los alumnos',
    allHelp: 'Seleccionar todos los alumnos activos',
    selected: 'seleccionado(s)',
    noActive: 'No hay alumnos activos disponibles.',
    title: 'Título',
    titlePlaceholder: 'Ej.: Hora de entrenar',
    message: 'Mensaje',
    messagePlaceholder: 'Escribe el mensaje que verá el alumno.',
    now: 'Ahora',
    once: 'Programar',
    daily: 'Cada día',
    dateTime: 'Fecha y hora',
    localTime: 'Usa la hora local de este dispositivo.',
    dailyTime: 'Hora diaria',
    brasilia: 'Hora de Brasilia · America/Sao_Paulo',
    sending: 'Guardando...',
    send: 'Enviar notificación',
    save: 'Guardar programación',
    requiredMessage: 'Completa el título y el mensaje.',
    chooseStudent: 'Selecciona al menos un alumno.',
    future: 'Elige una fecha futura.',
    chooseDate: 'Elige la fecha y hora del envío.',
    chooseTime: 'Elige la hora diaria.',
    failed: 'No se pudo guardar o enviar la notificación.',
    sentAll: 'Notificación enviada a todos los alumnos activos.',
    sentSelected: 'Notificación enviada a los alumnos seleccionados.',
    partial: 'Algunos envíos no pudieron completarse.',
    dailySaved: 'Programación diaria guardada para las {time} hora de Brasilia.',
    scheduled: 'Notificación programada correctamente.',
    schedules: 'Programaciones',
    schedulesSubtitle: '{count} activa(s)',
    loading: 'Cargando programaciones...',
    empty: 'No hay notificaciones programadas.',
    cancel: 'Cancelar programación',
    cancelConfirm: '¿Cancelar esta programación de notificación?',
    cancelError: 'No se pudo cancelar la programación.',
    cancelled: 'Programación cancelada.',
    refresh: 'Actualizar',
    everyDay: 'Todos los días a las {time}',
    allStudents: 'Todos los alumnos',
    selectedStudent: 'Alumno seleccionado',
  },
  'zh-CN': {
    accordionTitle: '发送给学员',
    accordionSubtitle: '选择接收者、编辑消息并设置发送时间。',
    recipients: '接收者',
    all: '所有学员',
    allHelp: '选择所有活跃学员',
    selected: '已选择',
    noActive: '暂无活跃学员。',
    title: '标题',
    titlePlaceholder: '例如：训练时间',
    message: '消息',
    messagePlaceholder: '输入学员将看到的消息。',
    now: '立即发送',
    once: '定时发送',
    daily: '每天',
    dateTime: '日期和时间',
    localTime: '使用此设备的本地时间。',
    dailyTime: '每日时间',
    brasilia: '巴西利亚时间 · America/Sao_Paulo',
    sending: '保存中...',
    send: '发送通知',
    save: '保存计划',
    requiredMessage: '请填写标题和消息。',
    chooseStudent: '请至少选择一名学员。',
    future: '请选择未来的日期。',
    chooseDate: '请选择发送日期和时间。',
    chooseTime: '请选择每日时间。',
    failed: '无法保存或发送通知。',
    sentAll: '通知已发送给所有活跃学员。',
    sentSelected: '通知已发送给所选学员。',
    partial: '部分通知未能发送。',
    dailySaved: '每日 {time}（巴西利亚时间）的计划已保存。',
    scheduled: '通知计划已保存。',
    schedules: '计划',
    schedulesSubtitle: '{count} 个有效',
    loading: '正在加载计划...',
    empty: '暂无计划通知。',
    cancel: '取消计划',
    cancelConfirm: '取消此通知计划？',
    cancelError: '无法取消计划。',
    cancelled: '计划已取消。',
    refresh: '刷新',
    everyDay: '每天 {time}',
    allStudents: '所有学员',
    selectedStudent: '所选学员',
  },
  de: {
    accordionTitle: 'Nachrichten an Schüler',
    accordionSubtitle: 'Empfänger auswählen, Nachricht schreiben und Versandzeit festlegen.',
    recipients: 'Empfänger',
    all: 'Alle Schüler',
    allHelp: 'Alle aktiven Schüler auswählen',
    selected: 'ausgewählt',
    noActive: 'Keine aktiven Schüler verfügbar.',
    title: 'Titel',
    titlePlaceholder: 'Beispiel: Trainingszeit',
    message: 'Nachricht',
    messagePlaceholder: 'Schreibe die Nachricht für den Schüler.',
    now: 'Jetzt',
    once: 'Planen',
    daily: 'Täglich',
    dateTime: 'Datum und Uhrzeit',
    localTime: 'Verwendet die lokale Zeit dieses Geräts.',
    dailyTime: 'Tägliche Uhrzeit',
    brasilia: 'Brasília-Zeit · America/Sao_Paulo',
    sending: 'Wird gespeichert...',
    send: 'Benachrichtigung senden',
    save: 'Zeitplan speichern',
    requiredMessage: 'Titel und Nachricht ausfüllen.',
    chooseStudent: 'Wähle mindestens einen Schüler.',
    future: 'Wähle ein zukünftiges Datum.',
    chooseDate: 'Wähle Datum und Uhrzeit.',
    chooseTime: 'Wähle die tägliche Uhrzeit.',
    failed: 'Benachrichtigung konnte nicht gespeichert oder gesendet werden.',
    sentAll: 'Benachrichtigung an alle aktiven Schüler gesendet.',
    sentSelected: 'Benachrichtigung an die ausgewählten Schüler gesendet.',
    partial: 'Einige Sendungen konnten nicht abgeschlossen werden.',
    dailySaved: 'Täglicher Zeitplan für {time} Uhr Brasília-Zeit gespeichert.',
    scheduled: 'Benachrichtigung erfolgreich geplant.',
    schedules: 'Zeitpläne',
    schedulesSubtitle: '{count} aktiv',
    loading: 'Zeitpläne werden geladen...',
    empty: 'Keine geplanten Benachrichtigungen.',
    cancel: 'Zeitplan abbrechen',
    cancelConfirm: 'Diesen Benachrichtigungszeitplan abbrechen?',
    cancelError: 'Zeitplan konnte nicht abgebrochen werden.',
    cancelled: 'Zeitplan abgebrochen.',
    refresh: 'Aktualisieren',
    everyDay: 'Täglich um {time}',
    allStudents: 'Alle Schüler',
    selectedStudent: 'Ausgewählter Schüler',
  },
} as const

export default function AdminNotificationCenter({
  students,
}: {
  students: Profile[]
}) {
  const { locale, language } = useI18n()
  const text = copy[language]

  const activeStudents = useMemo(
    () => students.filter((student) => student.status === 'active'),
    [students],
  )

  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([])
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
    const allowed = new Set(activeStudents.map((student) => student.id))

    setSelectedStudentIds((current) =>
      current.filter((id) => allowed.has(id)),
    )
  }, [activeStudents])

  const allSelected =
    activeStudents.length > 0 &&
    selectedStudentIds.length === activeStudents.length

  function toggleAll() {
    setSelectedStudentIds(
      allSelected
        ? []
        : activeStudents.map((student) => student.id),
    )
  }

  function toggleStudent(studentId: string) {
    setSelectedStudentIds((current) =>
      current.includes(studentId)
        ? current.filter((id) => id !== studentId)
        : [...current, studentId],
    )
  }

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

  async function createCampaign(studentId: string | null, useAll: boolean, scheduledFor: string | null) {
    return supabase.rpc(
      'create_student_notification_campaign',
      {
        p_audience: useAll ? 'all' : 'student',
        p_student_id: useAll ? null : studentId,
        p_title: title.trim(),
        p_message: message.trim(),
        p_schedule_type: scheduleType,
        p_scheduled_for: scheduledFor,
        p_daily_time:
          scheduleType === 'daily' ? `${dailyTime}:00` : null,
        p_timezone: 'America/Sao_Paulo',
      },
    )
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setFeedback('')

    const normalizedTitle = title.trim()
    const normalizedMessage = message.trim()

    if (!normalizedTitle || !normalizedMessage) {
      setFeedback(text.requiredMessage)
      return
    }

    if (selectedStudentIds.length === 0) {
      setFeedback(text.chooseStudent)
      return
    }

    let scheduledFor: string | null = null

    if (scheduleType === 'once') {
      if (!onceAt) {
        setFeedback(text.chooseDate)
        return
      }

      const date = new Date(onceAt)

      if (Number.isNaN(date.getTime()) || date.getTime() <= Date.now()) {
        setFeedback(text.future)
        return
      }

      scheduledFor = date.toISOString()
    }

    if (scheduleType === 'daily' && !dailyTime) {
      setFeedback(text.chooseTime)
      return
    }

    setSaving(true)

    try {
      const useAll =
        allSelected &&
        selectedStudentIds.length === activeStudents.length

      const results = useAll
        ? [await createCampaign(null, true, scheduledFor)]
        : await Promise.all(
            selectedStudentIds.map((studentId) =>
              createCampaign(studentId, false, scheduledFor),
            ),
          )

      const failures = results.filter((result) => result.error)

      if (failures.length === results.length) {
        failures.forEach((result) => {
          if (result.error) {
            console.error('Falha ao criar campanha:', result.error)
          }
        })

        setFeedback(text.failed)
        return
      }

      if (failures.length > 0) {
        setFeedback(text.partial)
      } else if (scheduleType === 'now') {
        setFeedback(useAll ? text.sentAll : text.sentSelected)
      } else if (scheduleType === 'daily') {
        setFeedback(
          text.dailySaved.replace('{time}', dailyTime),
        )
      } else {
        setFeedback(text.scheduled)
      }

      setTitle('')
      setMessage('')
      setOnceAt('')

      if (scheduleType !== 'now') {
        await loadCampaigns()
      }
    } finally {
      setSaving(false)
    }
  }

  async function cancel(id: number) {
    if (!window.confirm(text.cancelConfirm)) return

    const { error } = await supabase.rpc(
      'cancel_student_notification_campaign',
      { p_campaign_id: id },
    )

    if (error) {
      setFeedback(text.cancelError)
      return
    }

    setFeedback(text.cancelled)
    await loadCampaigns()
  }

  function recipientLabel(campaign: Campaign) {
    if (campaign.audience === 'all') return text.allStudents

    return (
      activeStudents.find((student) => student.id === campaign.student_id)
        ?.name || text.selectedStudent
    )
  }

  function scheduleLabel(campaign: Campaign) {
    if (campaign.schedule_type === 'daily') {
      return text.everyDay.replace(
        '{time}',
        (campaign.daily_time || '').slice(0, 5),
      )
    }

    if (!campaign.next_run_at) return text.scheduled

    return new Intl.DateTimeFormat(locale, {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(campaign.next_run_at))
  }

  return (
    <SettingsAccordion
      title={text.accordionTitle}
      subtitle={text.accordionSubtitle}
      className="adminNotificationAccordion"
    >
      <div className="adminStudentNotificationCenter">
        <form className="notificationComposer" onSubmit={submit}>
          <section className="notificationRecipients">
            <header>
              <strong>{text.recipients}</strong>
              <span>
                {selectedStudentIds.length} {text.selected}
              </span>
            </header>

            <label className="notificationRecipientAll">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                disabled={activeStudents.length === 0}
              />

              <span className="notificationCustomCheck" />

              <span className="notificationRecipientCopy">
                <strong>{text.all}</strong>
                <small>{text.allHelp}</small>
              </span>
            </label>

            <div className="notificationRecipientList">
              {activeStudents.length === 0 ? (
                <p className="notificationRecipientEmpty">
                  {text.noActive}
                </p>
              ) : (
                activeStudents.map((student) => (
                  <label
                    className="notificationRecipientItem"
                    key={student.id}
                  >
                    <input
                      type="checkbox"
                      checked={selectedStudentIds.includes(student.id)}
                      onChange={() => toggleStudent(student.id)}
                    />

                    <span className="notificationCustomCheck" />

                    <span className="notificationRecipientAvatar">
                      {(student.name || student.email || 'A')
                        .charAt(0)
                        .toUpperCase()}
                    </span>

                    <span className="notificationRecipientCopy">
                      <strong>{student.name || student.email}</strong>
                      <small>{student.email}</small>
                    </span>
                  </label>
                ))
              )}
            </div>
          </section>

          <label>
            {text.title}
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={text.titlePlaceholder}
              maxLength={80}
              required
            />
            <small>{title.length}/80</small>
          </label>

          <label>
            {text.message}
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder={text.messagePlaceholder}
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
              {text.now}
            </button>

            <button
              type="button"
              className={scheduleType === 'once' ? 'active' : ''}
              onClick={() => setScheduleType('once')}
            >
              <CalendarClock size={15} />
              {text.once}
            </button>

            <button
              type="button"
              className={scheduleType === 'daily' ? 'active' : ''}
              onClick={() => setScheduleType('daily')}
            >
              <Clock3 size={15} />
              {text.daily}
            </button>
          </div>

          {scheduleType === 'once' && (
            <label>
              {text.dateTime}
              <input
                type="datetime-local"
                value={onceAt}
                onChange={(event) => setOnceAt(event.target.value)}
                required
              />
              <small>{text.localTime}</small>
            </label>
          )}

          {scheduleType === 'daily' && (
            <label>
              {text.dailyTime}
              <input
                type="time"
                value={dailyTime}
                onChange={(event) => setDailyTime(event.target.value)}
                required
              />
              <small>{text.brasilia}</small>
            </label>
          )}

          <button
            className="notificationComposerSubmit"
            disabled={
              saving ||
              !title.trim() ||
              !message.trim() ||
              selectedStudentIds.length === 0
            }
          >
            <Send size={16} />
            {saving
              ? text.sending
              : scheduleType === 'now'
                ? text.send
                : text.save}
          </button>
        </form>

        {feedback && (
          <div className="notificationCenterFeedback" role="status">
            {feedback}
          </div>
        )}

        <SettingsAccordion
          title={text.schedules}
          subtitle={text.schedulesSubtitle.replace(
            '{count}',
            String(campaigns.length),
          )}
          className="scheduledNotificationsAccordion"
          defaultOpen={campaigns.length > 0}
        >
          <div className="scheduledNotifications">
            <div className="scheduledNotificationsToolbar">
              <button
                type="button"
                onClick={() => void loadCampaigns()}
                disabled={loadingCampaigns}
              >
                {text.refresh}
              </button>
            </div>

            {loadingCampaigns ? (
              <p className="scheduledNotificationsEmpty">
                {text.loading}
              </p>
            ) : campaigns.length === 0 ? (
              <p className="scheduledNotificationsEmpty">
                {text.empty}
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
                      className="scheduledNotificationCancel"
                      onClick={() => void cancel(campaign.id)}
                      aria-label={text.cancel}
                      title={text.cancel}
                    >
                      <X size={16} />
                    </button>
                  </article>
                ))}
              </div>
            )}
          </div>
        </SettingsAccordion>
      </div>
    </SettingsAccordion>
  )
}
