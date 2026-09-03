import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import {
  BarChart3,
  Bell,
  BookOpen,
  CalendarDays,
  Check,
  CheckCheck,
  Eye,
  LayoutDashboard,
  LogOut,
  RefreshCw,
  Search,
  Settings,
  ShieldX,
  Trophy,
  UserPlus,
  UsersRound,
  X,
} from 'lucide-react'
import type { Profile } from '../types'
import { supabase } from '../lib/supabase'
import { RvEmptyState, RvLoadingState } from '../components/PlatformState'

const AdminContentManager = lazy(
  () => import('../components/AdminContentManager'),
)

type AdminTab = 'dashboard' | 'students' | 'content' | 'settings'

function readAdminTab(): AdminTab {
  const value = new URLSearchParams(window.location.search).get('admin')

  if (
    value === 'students' ||
    value === 'content' ||
    value === 'settings'
  ) {
    return value
  }

  return 'dashboard'
}

function writeAdminTab(tab: AdminTab, mode: 'push' | 'replace' = 'replace') {
  const url = new URL(window.location.href)

  // Remove parâmetros usados apenas na navegação do aluno.
  url.searchParams.delete('view')
  url.searchParams.delete('lesson')

  if (tab === 'dashboard') {
    url.searchParams.delete('admin')
  } else {
    url.searchParams.set('admin', tab)
  }

  const next = `${url.pathname}${url.search}${url.hash}`

  if (mode === 'push') {
    window.history.pushState({}, document.title, next)
  } else {
    window.history.replaceState({}, document.title, next)
  }
}

type Program = {
  id: number
  title: string
  description: string | null
  is_active: boolean
}

type Assignment = {
  id: number
  student_id: string
  program_id: number
  starts_at: string
  ends_at: string | null
  active: boolean
  programs: { title: string } | null
}

type ProgressRow = {
  student_id: string
  lesson_id: number
  completed: boolean
  completed_at: string | null
}

type WeekIndexRow = {
  id: number
  program_id: number
}

type LessonIndexRow = {
  id: number
  week_id: number
}

type StudentFilter = 'all' | 'pending' | 'active' | 'blocked'

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
}

function todayInputValue() {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

function formatDateOnly(value?: string | null) {
  if (!value) return '—'
  const [year, month, day] = value.split('-')
  if (!year || !month || !day) return value
  return `${day}/${month}/${year}`
}

function formatDateTime(value?: string | null) {
  if (!value) return 'Nenhuma aula concluída'
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}

export default function AdminHome({ profile }: { profile: Profile }) {
  const [activeTab, setActiveTab] = useState<AdminTab>(() => readAdminTab())
  const [students, setStudents] = useState<Profile[]>([])
  const [programs, setPrograms] = useState<Program[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [progressRows, setProgressRows] = useState<ProgressRow[]>([])
  const [weeksIndex, setWeeksIndex] = useState<WeekIndexRow[]>([])
  const [lessonsIndex, setLessonsIndex] = useState<LessonIndexRow[]>([])
  const [selectedPrograms, setSelectedPrograms] = useState<Record<string, number>>({})
  const [selectedStartDates, setSelectedStartDates] = useState<Record<string, string>>({})
  const [studentFilter, setStudentFilter] = useState<StudentFilter>('all')
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [savingStudentId, setSavingStudentId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [notifications, setNotifications] = useState<AdminNotification[]>([])
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [notificationsLoading, setNotificationsLoading] = useState(true)

  async function loadNotifications() {
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

  async function loadData(showLoader = false) {
    if (showLoader) setLoading(true)
    setRefreshing(true)

    const [
      studentsResult,
      programsResult,
      assignmentsResult,
      progressResult,
      weeksResult,
      lessonsResult,
    ] = await Promise.all([
      supabase
        .from('profiles')
        .select('*')
        .eq('role', 'student')
        .order('created_at', { ascending: false }),
      supabase
        .from('programs')
        .select('id,title,description,is_active')
        .order('title'),
      supabase
        .from('student_programs')
        .select('id,student_id,program_id,starts_at,ends_at,active,programs(title)')
        .eq('active', true),
      supabase
        .from('lesson_progress')
        .select('student_id,lesson_id,completed,completed_at'),
      supabase
        .from('weeks')
        .select('id,program_id'),
      supabase
        .from('lessons')
        .select('id,week_id'),
    ])

    if (
      studentsResult.error ||
      programsResult.error ||
      assignmentsResult.error ||
      progressResult.error ||
      weeksResult.error ||
      lessonsResult.error
    ) {
      setMessage('Não foi possível atualizar todos os dados do painel.')
    }

    const nextAssignments =
      (assignmentsResult.data as unknown as Assignment[]) ?? []

    setStudents((studentsResult.data as Profile[]) ?? [])
    setPrograms((programsResult.data as Program[]) ?? [])
    setAssignments(nextAssignments)
    setProgressRows((progressResult.data as ProgressRow[]) ?? [])
    setWeeksIndex((weeksResult.data as WeekIndexRow[]) ?? [])
    setLessonsIndex((lessonsResult.data as LessonIndexRow[]) ?? [])

    setSelectedPrograms((current) => {
      const next = { ...current }
      nextAssignments.forEach((assignment) => {
        next[assignment.student_id] = assignment.program_id
      })
      return next
    })

    setSelectedStartDates((current) => {
      const next = { ...current }
      nextAssignments.forEach((assignment) => {
        next[assignment.student_id] = assignment.starts_at
      })
      return next
    })

    setLoading(false)
    setRefreshing(false)
  }

  useEffect(() => {
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
  }, [activeTab])

  useEffect(() => {
    function handlePopState() {
      setActiveTab(readAdminTab())
      window.scrollTo({ top: 0, behavior: 'auto' })
    }

    window.addEventListener('popstate', handlePopState)

    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [])

  const filteredStudents = useMemo(() => {
    const normalized = query.trim().toLowerCase()

    return students.filter((student) => {
      const matchesStatus =
        studentFilter === 'all' || student.status === studentFilter

      const matchesQuery =
        !normalized ||
        `${student.name} ${student.email}`.toLowerCase().includes(normalized)

      return matchesStatus && matchesQuery
    })
  }, [query, studentFilter, students])

  const pendingCount = students.filter((student) => student.status === 'pending').length
  const activeCount = students.filter((student) => student.status === 'active').length
  const blockedCount = students.filter((student) => student.status === 'blocked').length
  const activeProgramCount = programs.filter((program) => program.is_active).length
  const unreadNotificationCount = notifications.filter(
    (notification) => !notification.read_at,
  ).length

  const lessonProgramById = useMemo(() => {
    const weekProgram = new Map<number, number>()
    weeksIndex.forEach((week) => weekProgram.set(week.id, week.program_id))

    const lessonProgram = new Map<number, number>()
    lessonsIndex.forEach((lesson) => {
      const programId = weekProgram.get(lesson.week_id)
      if (programId) lessonProgram.set(lesson.id, programId)
    })

    return lessonProgram
  }, [lessonsIndex, weeksIndex])

  const lessonCountByProgram = useMemo(() => {
    const counts = new Map<number, number>()

    lessonProgramById.forEach((programId) => {
      counts.set(programId, (counts.get(programId) ?? 0) + 1)
    })

    return counts
  }, [lessonProgramById])

  async function markNotificationRead(notificationId: number) {
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

  function getAssignment(studentId: string) {
    return assignments.find((item) => item.student_id === studentId) ?? null
  }

  function getProgramName(studentId: string) {
    return getAssignment(studentId)?.programs?.title ?? 'Sem metodologia'
  }

  function getStudentProgress(studentId: string) {
    const assignment = getAssignment(studentId)

    if (!assignment) {
      return {
        completed: 0,
        total: 0,
        percentage: 0,
        lastCompletedAt: null as string | null,
      }
    }

    const total = lessonCountByProgram.get(assignment.program_id) ?? 0

    const completedRows = progressRows.filter(
      (item) =>
        item.student_id === studentId &&
        item.completed &&
        lessonProgramById.get(item.lesson_id) === assignment.program_id,
    )

    const lastCompletedAt =
      completedRows
        .map((item) => item.completed_at)
        .filter(Boolean)
        .sort()
        .at(-1) ?? null

    return {
      completed: completedRows.length,
      total,
      percentage: total ? Math.round((completedRows.length / total) * 100) : 0,
      lastCompletedAt,
    }
  }

  const dashboardMetrics = useMemo(() => {
    const activeStudents = students.filter((student) => student.status === 'active')

    const activeRows = activeStudents.map((student) => {
      const assignment =
        assignments.find((item) => item.student_id === student.id) ?? null

      const total = assignment
        ? lessonCountByProgram.get(assignment.program_id) ?? 0
        : 0

      const completedRows = assignment
        ? progressRows.filter(
            (item) =>
              item.student_id === student.id &&
              item.completed &&
              lessonProgramById.get(item.lesson_id) === assignment.program_id,
          )
        : []

      const percentage = total
        ? Math.round((completedRows.length / total) * 100)
        : 0

      return {
        student,
        assignment,
        total,
        completed: completedRows.length,
        percentage,
      }
    })

    const assignedRows = activeRows.filter((row) => Boolean(row.assignment))
    const withoutProgram = activeRows.filter((row) => !row.assignment).length

    const averageProgress = assignedRows.length
      ? Math.round(
          assignedRows.reduce((sum, row) => sum + row.percentage, 0) /
            assignedRows.length,
        )
      : 0

    const completedPrograms = assignedRows.filter(
      (row) => row.total > 0 && row.completed >= row.total,
    ).length

    const inProgress = assignedRows.filter(
      (row) => row.completed > 0 && row.percentage < 100,
    ).length

    const notStarted = assignedRows.filter((row) => row.completed === 0).length

    const programDistribution = programs
      .map((program) => {
        const programRows = assignedRows.filter(
          (row) => row.assignment?.program_id === program.id,
        )

        const average = programRows.length
          ? Math.round(
              programRows.reduce((sum, row) => sum + row.percentage, 0) /
                programRows.length,
            )
          : 0

        return {
          id: program.id,
          title: program.title,
          students: programRows.length,
          average,
          active: program.is_active,
        }
      })
      .filter((item) => item.students > 0 || item.active)
      .sort((a, b) => b.students - a.students || a.title.localeCompare(b.title))

    const recentActivity = progressRows
      .filter((item) => item.completed && item.completed_at)
      .slice()
      .sort((a, b) =>
        String(b.completed_at).localeCompare(String(a.completed_at)),
      )
      .slice(0, 6)
      .map((item) => {
        const student =
          students.find((row) => row.id === item.student_id) ?? null
        const programId = lessonProgramById.get(item.lesson_id) ?? null
        const program = programId
          ? programs.find((row) => row.id === programId) ?? null
          : null

        return {
          ...item,
          student,
          program,
        }
      })

    const recentPending = students
      .filter((student) => student.status === 'pending')
      .slice()
      .sort((a, b) =>
        String(b.created_at).localeCompare(String(a.created_at)),
      )
      .slice(0, 5)

    return {
      totalStudents: students.length,
      activeStudents: activeRows.length,
      withoutProgram,
      averageProgress,
      completedPrograms,
      inProgress,
      notStarted,
      programDistribution,
      recentActivity,
      recentPending,
    }
  }, [
    assignments,
    lessonCountByProgram,
    lessonProgramById,
    programs,
    progressRows,
    students,
  ])

  function openStudentsWithFilter(filter: StudentFilter) {
    setStudentFilter(filter)
    setActiveTab('students')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function getSelectedProgramId(studentId: string) {
    return selectedPrograms[studentId] ?? getAssignment(studentId)?.program_id ?? 0
  }

  function getSelectedStartDate(studentId: string) {
    return (
      selectedStartDates[studentId] ??
      getAssignment(studentId)?.starts_at ??
      todayInputValue()
    )
  }

  async function approveStudent(studentId: string) {
    const programId = getSelectedProgramId(studentId)
    const startDate = getSelectedStartDate(studentId)

    if (!programId) {
      setMessage('Escolha a metodologia antes de liberar o aluno.')
      return
    }

    setSavingStudentId(studentId)
    setMessage('')

    const { error } = await supabase.rpc('assign_program_to_student', {
      p_student_id: studentId,
      p_program_id: programId,
      p_starts_at: startDate,
    })

    if (error) {
      setMessage(`Erro ao liberar aluno: ${error.message}`)
    } else {
      setMessage('Aluno liberado com a metodologia e data selecionadas.')
      await loadData()
    }

    setSavingStudentId(null)
  }

  async function saveStudentPlan(studentId: string) {
    const assignment = getAssignment(studentId)
    const programId = getSelectedProgramId(studentId)
    const startDate = getSelectedStartDate(studentId)

    if (!programId) {
      setMessage('Escolha uma metodologia.')
      return
    }

    if (assignment && programId !== assignment.program_id) {
      const student = students.find((item) => item.id === studentId)
      const nextProgram = programs.find((item) => item.id === programId)

      const accepted = window.confirm(
        `Trocar ${student?.name || 'este aluno'} de "${assignment.programs?.title || 'metodologia atual'}" para "${nextProgram?.title || 'nova metodologia'}"?`,
      )

      if (!accepted) {
        setSelectedPrograms((current) => ({
          ...current,
          [studentId]: assignment.program_id,
        }))
        return
      }
    }

    setSavingStudentId(studentId)
    setMessage('')

    const { error } = await supabase.rpc('assign_program_to_student', {
      p_student_id: studentId,
      p_program_id: programId,
      p_starts_at: startDate,
    })

    if (error) {
      setMessage(`Erro ao atualizar o plano: ${error.message}`)
    } else {
      setMessage('Plano do aluno atualizado.')
      await loadData()
    }

    setSavingStudentId(null)
  }

  async function blockStudent(studentId: string) {
    setSavingStudentId(studentId)
    setMessage('')

    const { error } = await supabase
      .from('profiles')
      .update({ status: 'blocked' })
      .eq('id', studentId)

    if (error) {
      setMessage(`Erro ao bloquear aluno: ${error.message}`)
    } else {
      setMessage('Aluno bloqueado. A metodologia foi mantida para facilitar uma futura reativação.')
      await loadData()
    }

    setSavingStudentId(null)
  }

  async function reactivateStudent(studentId: string) {
    const programId = getSelectedProgramId(studentId)
    const startDate = getSelectedStartDate(studentId)

    if (!programId) {
      setMessage('Escolha uma metodologia para reativar esse aluno.')
      return
    }

    setSavingStudentId(studentId)
    setMessage('')

    const { error } = await supabase.rpc('assign_program_to_student', {
      p_student_id: studentId,
      p_program_id: programId,
      p_starts_at: startDate,
    })

    if (error) {
      setMessage(`Erro ao reativar aluno: ${error.message}`)
    } else {
      setMessage('Aluno reativado com o plano selecionado.')
      await loadData()
    }

    setSavingStudentId(null)
  }

  function renderDashboard() {
    const maxProgramStudents = Math.max(
      1,
      ...dashboardMetrics.programDistribution.map((item) => item.students),
    )

    return (
      <div className="dashboardAdminPage dashboardAdminV2">
        <section className="dashboardOverviewHero">
          <div>
            <p className="eyebrow">VISÃO GERAL</p>
            <h2>Operação da RV em um só lugar</h2>
            <p>
              Acompanhe acessos, andamento dos alunos e metodologias sem precisar
              abrir cada cadastro individualmente.
            </p>
          </div>

          <button
            type="button"
            className="adminRefresh dashboardRefreshButton"
            onClick={() => loadData(false)}
            disabled={refreshing}
          >
            <RefreshCw size={16} className={refreshing ? 'rvUiSpin' : ''} />
            {refreshing ? 'Atualizando...' : 'Atualizar dados'}
          </button>
        </section>

        <div className="dashboardAdminCards dashboardAdminCardsV2">
          <button onClick={() => openStudentsWithFilter('active')}>
            <span>Alunos ativos</span>
            <strong>{activeCount}</strong>
            <small>{dashboardMetrics.inProgress} em andamento</small>
          </button>

          <button
            className={pendingCount > 0 ? 'needsAttention' : ''}
            onClick={() => openStudentsWithFilter('pending')}
          >
            <span>Aguardando aprovação</span>
            <strong>{pendingCount}</strong>
            <small>{pendingCount ? 'Requer sua análise' : 'Nenhum pendente'}</small>
          </button>

          <button onClick={() => setActiveTab('content')}>
            <span>Metodologias ativas</span>
            <strong>{activeProgramCount}</strong>
            <small>{programs.length} cadastrada(s)</small>
          </button>

          <button onClick={() => openStudentsWithFilter('blocked')}>
            <span>Bloqueados</span>
            <strong>{blockedCount}</strong>
            <small>Gerenciar acessos</small>
          </button>

          <article className="dashboardMetricCard accentMetric">
            <span>Progresso médio</span>
            <strong>{dashboardMetrics.averageProgress}%</strong>
            <div className="dashboardMetricTrack">
              <i style={{ width: dashboardMetrics.averageProgress + '%' }} />
            </div>
            <small>Entre alunos ativos com plano</small>
          </article>

          <article className="dashboardMetricCard">
            <span>Programa concluído</span>
            <strong>{dashboardMetrics.completedPrograms}</strong>
            <small>Aluno(s) em 100%</small>
          </article>

          <article
            className={
              dashboardMetrics.withoutProgram > 0
                ? 'dashboardMetricCard warningMetric'
                : 'dashboardMetricCard'
            }
          >
            <span>Ativos sem plano</span>
            <strong>{dashboardMetrics.withoutProgram}</strong>
            <small>
              {dashboardMetrics.withoutProgram > 0
                ? 'Precisa de correção'
                : 'Tudo vinculado'}
            </small>
          </article>

          <article className="dashboardMetricCard">
            <span>Ainda não iniciaram</span>
            <strong>{dashboardMetrics.notStarted}</strong>
            <small>Com plano, 0 aulas concluídas</small>
          </article>
        </div>

        <div className="dashboardOperationsGrid">
          <section className="dashboardPanel">
            <header className="dashboardPanelHeader">
              <div>
                <p className="eyebrow">ATIVIDADE</p>
                <h3>Últimas conclusões</h3>
              </div>
              <BarChart3 size={19} />
            </header>

            {dashboardMetrics.recentActivity.length === 0 ? (
              <RvEmptyState
                compact
                kind="program"
                title="Nenhuma atividade ainda"
                text="As aulas concluídas pelos alunos aparecerão aqui."
              />
            ) : (
              <div className="dashboardActivityList">
                {dashboardMetrics.recentActivity.map((activity, index) => (
                  <div
                    className="dashboardActivityItem"
                    key={
                      activity.student_id +
                      '-' +
                      activity.lesson_id +
                      '-' +
                      activity.completed_at +
                      '-' +
                      index
                    }
                  >
                    <div className="dashboardActivityAvatar">
                      {activity.student?.name?.charAt(0)?.toUpperCase() || 'A'}
                    </div>

                    <div className="dashboardActivityCopy">
                      <strong>{activity.student?.name || 'Aluno'}</strong>
                      <span>
                        Concluiu uma aula
                        {activity.program?.title
                          ? ' · ' + activity.program.title
                          : ''}
                      </span>
                    </div>

                    <time>{formatDateTime(activity.completed_at)}</time>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="dashboardPanel">
            <header className="dashboardPanelHeader">
              <div>
                <p className="eyebrow">METODOLOGIAS</p>
                <h3>Distribuição dos alunos</h3>
              </div>
              <BookOpen size={19} />
            </header>

            {dashboardMetrics.programDistribution.length === 0 ? (
              <RvEmptyState
                compact
                kind="program"
                title="Nenhuma metodologia ativa"
                text="Crie uma metodologia para começar."
              />
            ) : (
              <div className="dashboardProgramList">
                {dashboardMetrics.programDistribution.map((item) => (
                  <div className="dashboardProgramItem" key={item.id}>
                    <div className="dashboardProgramTop">
                      <div>
                        <strong>{item.title}</strong>
                        <span>
                          {item.students} aluno(s) · média {item.average}%
                        </span>
                      </div>
                      <b>{item.students}</b>
                    </div>

                    <div className="dashboardProgramTrack">
                      <i
                        style={{
                          width:
                            Math.max(
                              item.students > 0 ? 7 : 0,
                              Math.round(
                                (item.students / maxProgramStudents) * 100,
                              ),
                            ) + '%',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button
              type="button"
              className="dashboardPanelAction"
              onClick={() => setActiveTab('content')}
            >
              Gerenciar metodologias
            </button>
          </section>
        </div>

        <div className="dashboardSecondaryGrid">
          <section className="dashboardPanel">
            <header className="dashboardPanelHeader">
              <div>
                <p className="eyebrow">NOVOS CADASTROS</p>
                <h3>Aguardando sua aprovação</h3>
              </div>
              <UsersRound size={19} />
            </header>

            {dashboardMetrics.recentPending.length === 0 ? (
              <div className="dashboardEverythingOk">
                <Check size={18} />
                <div>
                  <strong>Nenhum cadastro pendente</strong>
                  <span>Todos os novos alunos já foram revisados.</span>
                </div>
              </div>
            ) : (
              <div className="dashboardPendingList">
                {dashboardMetrics.recentPending.map((student) => (
                  <button
                    key={student.id}
                    type="button"
                    onClick={() => openStudentsWithFilter('pending')}
                  >
                    <div className="dashboardActivityAvatar">
                      {student.name?.charAt(0)?.toUpperCase() || 'A'}
                    </div>
                    <div>
                      <strong>{student.name || 'Sem nome'}</strong>
                      <span>{student.email}</span>
                    </div>
                    <small>
                      {new Intl.DateTimeFormat('pt-BR', {
                        dateStyle: 'short',
                      }).format(new Date(student.created_at))}
                    </small>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="dashboardPanel">
            <header className="dashboardPanelHeader">
              <div>
                <p className="eyebrow">RESUMO</p>
                <h3>Base de alunos</h3>
              </div>
              <UsersRound size={19} />
            </header>

            <div className="dashboardSummaryRows">
              <div>
                <span>Total cadastrados</span>
                <strong>{dashboardMetrics.totalStudents}</strong>
              </div>
              <div>
                <span>Ativos</span>
                <strong>{dashboardMetrics.activeStudents}</strong>
              </div>
              <div>
                <span>Em andamento</span>
                <strong>{dashboardMetrics.inProgress}</strong>
              </div>
              <div>
                <span>100% concluído</span>
                <strong>{dashboardMetrics.completedPrograms}</strong>
              </div>
            </div>

            <button
              type="button"
              className="dashboardPanelAction"
              onClick={() => openStudentsWithFilter('all')}
            >
              Abrir gestão de alunos
            </button>
          </section>
        </div>
      </div>
    )
  }

  function renderStudents() {
    const selectedStudent =
      students.find((student) => student.id === selectedStudentId) ?? null

    const selectedStudentAssignment = selectedStudent
      ? getAssignment(selectedStudent.id)
      : null

    const selectedStudentProgress = selectedStudent
      ? getStudentProgress(selectedStudent.id)
      : null

    return (
      <div className="adminStudentsPage">
        <div className="adminToolbar strongToolbar studentManagementToolbar">
          <div className="searchBox">
            <Search size={17} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por nome ou e-mail"
            />
          </div>

          <div className="studentStatusFilters" aria-label="Filtrar alunos">
            {(
              [
                ['all', 'Todos'],
                ['pending', 'Aguardando'],
                ['active', 'Ativos'],
                ['blocked', 'Bloqueados'],
              ] as Array<[StudentFilter, string]>
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={studentFilter === value ? 'active' : ''}
                onClick={() => setStudentFilter(value)}
              >
                {label}
                <span>
                  {value === 'all'
                    ? students.length
                    : value === 'pending'
                      ? pendingCount
                      : value === 'active'
                        ? activeCount
                        : blockedCount}
                </span>
              </button>
            ))}
          </div>

          <button
            className="adminRefresh"
            onClick={() => loadData(false)}
            disabled={refreshing}
          >
            <RefreshCw size={16} className={refreshing ? 'rvUiSpin' : ''} />
            {refreshing ? 'Atualizando...' : 'Atualizar'}
          </button>
        </div>

        <div className="studentTable enhancedStudentTable advancedStudentTable">
          <div className="tableHeader enhancedStudentHeader advancedStudentHeader">
            <span>Aluno</span>
            <span>Status</span>
            <span>Plano e início</span>
            <span>Progresso</span>
            <span>Ações</span>
          </div>

          {loading && (
            <RvLoadingState
              compact
              title="Carregando alunos"
              text="Buscando cadastros, planos e progresso."
            />
          )}

          {!loading && filteredStudents.length === 0 && (
            <RvEmptyState
              compact
              kind="search"
              title="Nenhum aluno encontrado"
              text="Tente outro nome, e-mail ou filtro de status."
            />
          )}

          {!loading &&
            filteredStudents.map((student) => {
              const assignment = getAssignment(student.id)
              const currentProgramId = assignment?.program_id ?? 0
              const selectedProgramId = getSelectedProgramId(student.id)
              const startDate = getSelectedStartDate(student.id)
              const progress = getStudentProgress(student.id)
              const needsProgram = student.status === 'pending' || !assignment

              const planDirty =
                Boolean(assignment) &&
                (selectedProgramId !== currentProgramId ||
                  startDate !== assignment?.starts_at)

              return (
                <article
                  className="studentRow enhancedStudentRow advancedStudentRow"
                  key={student.id}
                >
                  <div className="studentIdentity">
                    <div className="studentAvatar">
                      {student.name?.charAt(0)?.toUpperCase() || 'A'}
                    </div>
                    <div>
                      <strong>{student.name || 'Sem nome'}</strong>
                      <span>{student.email}</span>
                      <small>
                        Cadastro em{' '}
                        {new Intl.DateTimeFormat('pt-BR', {
                          dateStyle: 'short',
                        }).format(new Date(student.created_at))}
                      </small>
                    </div>
                  </div>

                  <div>
                    <span className={`statusPill ${student.status}`}>
                      {student.status === 'pending'
                        ? 'Aguardando'
                        : student.status === 'active'
                          ? 'Ativo'
                          : 'Bloqueado'}
                    </span>
                  </div>

                  <div className="studentPlanCell">
                    <select
                      value={selectedProgramId || ''}
                      onChange={(event) =>
                        setSelectedPrograms((current) => ({
                          ...current,
                          [student.id]: Number(event.target.value),
                        }))
                      }
                      disabled={savingStudentId === student.id}
                    >
                      <option value="">Escolher metodologia</option>
                      {programs
                        .filter(
                          (program) =>
                            program.is_active || program.id === currentProgramId,
                        )
                        .map((program) => (
                          <option key={program.id} value={program.id}>
                            {program.title}
                            {!program.is_active ? ' · inativa' : ''}
                          </option>
                        ))}
                    </select>

                    <label className="studentStartDate">
                      <CalendarDays size={14} />
                      <span>Início</span>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(event) =>
                          setSelectedStartDates((current) => ({
                            ...current,
                            [student.id]: event.target.value,
                          }))
                        }
                        disabled={savingStudentId === student.id}
                      />
                    </label>

                    {assignment && (
                      <small>
                        Atual: {getProgramName(student.id)} · início{' '}
                        {formatDateOnly(assignment.starts_at)}
                      </small>
                    )}
                  </div>

                  <div className="studentProgressCell">
                    {assignment ? (
                      <>
                        <div className="studentProgressTop">
                          <strong>{progress.percentage}%</strong>
                          <span>
                            {progress.completed}/{progress.total} aulas
                          </span>
                        </div>
                        <div className="studentProgressTrack">
                          <span style={{ width: `${progress.percentage}%` }} />
                        </div>
                        <small>
                          {progress.lastCompletedAt
                            ? `Última conclusão: ${formatDateTime(progress.lastCompletedAt)}`
                            : 'Nenhuma aula concluída'}
                        </small>
                      </>
                    ) : (
                      <span className="noProgressYet">Sem plano ativo</span>
                    )}
                  </div>

                  <div className="rowActions advancedRowActions">
                    {student.status === 'pending' && (
                      <button
                        className="approveButton"
                        onClick={() => approveStudent(student.id)}
                        disabled={
                          savingStudentId === student.id || !selectedProgramId
                        }
                      >
                        <Check size={16} /> Liberar
                      </button>
                    )}

                    {student.status === 'active' && (
                      <button
                        className="savePlanButton"
                        onClick={() => saveStudentPlan(student.id)}
                        disabled={
                          savingStudentId === student.id ||
                          !selectedProgramId ||
                          !planDirty
                        }
                        title={
                          planDirty
                            ? 'Salvar metodologia/data'
                            : 'O plano já está salvo'
                        }
                      >
                        <Check size={15} /> Salvar plano
                      </button>
                    )}

                    {student.status === 'blocked' && (
                      <button
                        className="approveButton"
                        onClick={() => reactivateStudent(student.id)}
                        disabled={
                          savingStudentId === student.id || !selectedProgramId
                        }
                      >
                        <Check size={16} /> Reativar
                      </button>
                    )}

                    <button
                      className="studentDetailsButton"
                      type="button"
                      onClick={() => setSelectedStudentId(student.id)}
                    >
                      <Eye size={15} /> Detalhes
                    </button>

                    {student.status !== 'blocked' && (
                      <button
                        className="blockButton"
                        onClick={() => blockStudent(student.id)}
                        disabled={savingStudentId === student.id}
                      >
                        <ShieldX size={16} /> Bloquear
                      </button>
                    )}
                  </div>
                </article>
              )
            })}
        </div>

        {selectedStudent && selectedStudentProgress && (
          <div
            className="studentDetailBackdrop"
            role="dialog"
            aria-modal="true"
            aria-label={`Detalhes de ${selectedStudent.name || 'aluno'}`}
            onMouseDown={(event) => {
              if (event.currentTarget === event.target) {
                setSelectedStudentId(null)
              }
            }}
          >
            <section className="studentDetailModal">
              <header className="studentDetailHeader">
                <div className="studentDetailIdentity">
                  <div className="studentAvatar studentDetailAvatar">
                    {selectedStudent.name?.charAt(0)?.toUpperCase() || 'A'}
                  </div>
                  <div>
                    <span>ALUNO</span>
                    <h2>{selectedStudent.name || 'Sem nome'}</h2>
                    <p>{selectedStudent.email}</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedStudentId(null)}
                  aria-label="Fechar detalhes"
                >
                  <X size={18} />
                </button>
              </header>

              <div className="studentDetailBody">
                <div className="studentDetailStatusRow">
                  <span className={`statusPill ${selectedStudent.status}`}>
                    {selectedStudent.status === 'pending'
                      ? 'Aguardando aprovação'
                      : selectedStudent.status === 'active'
                        ? 'Acesso ativo'
                        : 'Acesso bloqueado'}
                  </span>

                  <span>
                    Cadastro:{' '}
                    {new Intl.DateTimeFormat('pt-BR', {
                      dateStyle: 'medium',
                    }).format(new Date(selectedStudent.created_at))}
                  </span>
                </div>

                <div className="studentDetailPlan">
                  <div>
                    <span>METODOLOGIA ATUAL</span>
                    <strong>
                      {selectedStudentAssignment?.programs?.title ||
                        'Nenhuma metodologia vinculada'}
                    </strong>
                  </div>

                  <div>
                    <span>INÍCIO DO PROGRAMA</span>
                    <strong>
                      {formatDateOnly(selectedStudentAssignment?.starts_at)}
                    </strong>
                  </div>

                  <div>
                    <span>FIM PROGRAMADO</span>
                    <strong>
                      {formatDateOnly(selectedStudentAssignment?.ends_at)}
                    </strong>
                  </div>
                </div>

                <section className="studentDetailProgress">
                  <div className="studentDetailProgressHead">
                    <div>
                      <BarChart3 size={18} />
                      <span>PROGRESSO NA METODOLOGIA ATUAL</span>
                    </div>
                    <strong>{selectedStudentProgress.percentage}%</strong>
                  </div>

                  <div className="studentDetailBigTrack">
                    <span
                      style={{
                        width: `${selectedStudentProgress.percentage}%`,
                      }}
                    />
                  </div>

                  <div className="studentDetailMetrics">
                    <div>
                      <span>Aulas concluídas</span>
                      <strong>
                        {selectedStudentProgress.completed} de{' '}
                        {selectedStudentProgress.total}
                      </strong>
                    </div>
                    <div>
                      <span>Última atividade</span>
                      <strong>
                        {formatDateTime(
                          selectedStudentProgress.lastCompletedAt,
                        )}
                      </strong>
                    </div>
                  </div>
                </section>
              </div>
            </section>
          </div>
        )}
      </div>
    )
  }

  const tabInfo: Record<AdminTab, { eyebrow: string; title: string; subtitle: string }> = {
    dashboard: {
      eyebrow: 'VISÃO GERAL',
      title: 'Dashboard',
      subtitle: 'Acompanhe alunos, acessos e conteúdo da plataforma.',
    },
    students: {
      eyebrow: 'GESTÃO DE ALUNOS',
      title: 'Alunos',
      subtitle: 'Aprove cadastros, defina planos, datas, acessos e acompanhe o progresso.',
    },
    content: {
      eyebrow: 'EDITOR DA PLATAFORMA',
      title: 'Conteúdo',
      subtitle: 'Metodologias, semanas, aulas, exercícios e vídeos em um só lugar.',
    },
    settings: {
      eyebrow: 'CONFIGURAÇÕES',
      title: 'Configurações',
      subtitle: 'Dados da conta administrativa e futuras integrações.',
    },
  }

  return (
    <main className="adminPage upgradedAdminPage">
      <aside className="adminSidebar upgradedAdminSidebar">
        <div className="adminBrand">
          <img src="/logo-rv.png" className="adminLogo" alt="RV Fisiologia" />
          <div>
            <strong>RV Fisiologia</strong>
            <span>Administração</span>
          </div>
        </div>

        <nav className="adminMenu upgradedAdminMenu">
          <button className={activeTab === 'dashboard' ? 'active' : ''} onClick={() => setActiveTab('dashboard')}>
            <LayoutDashboard size={18} /> Dashboard
          </button>
          <button className={activeTab === 'students' ? 'active' : ''} onClick={() => setActiveTab('students')}>
            <UsersRound size={18} /> Alunos
            {pendingCount > 0 && <span className="menuBadge">{pendingCount}</span>}
          </button>
          <button className={activeTab === 'content' ? 'active' : ''} onClick={() => setActiveTab('content')}>
            <BookOpen size={18} /> Conteúdo
          </button>
          <button className={activeTab === 'settings' ? 'active' : ''} onClick={() => setActiveTab('settings')}>
            <Settings size={18} /> Configurações
          </button>
        </nav>

        <div className="adminProfile">
          <div className="profileInitial">{profile.name?.charAt(0)?.toUpperCase() || 'R'}</div>
          <div>
            <strong>{profile.name}</strong>
            <span>Administrador</span>
          </div>
          <button className="sidebarLogout" onClick={() => supabase.auth.signOut()} aria-label="Sair">
            <LogOut size={17} />
          </button>
        </div>
      </aside>

      <section className={`adminContent upgradedAdminContent ${activeTab === 'content' ? 'contentTabOpen' : ''}`}>
        <header className="adminTopbar upgradedAdminTopbar">
          <div>
            <p className="eyebrow">{tabInfo[activeTab].eyebrow}</p>
            <h1>{tabInfo[activeTab].title}</h1>
            <p>{tabInfo[activeTab].subtitle}</p>
          </div>
          <div className="adminTopbarActions">
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
          </div>
        </header>

        {message && (
          <div
            className={`adminMessage ${
              /erro|não foi possível|escolha/i.test(message) ? 'error' : 'success'
            }`}
            role="status"
          >
            <span>{message}</span>
            <button onClick={() => setMessage('')}>×</button>
          </div>
        )}

        {activeTab === 'dashboard' && (
          loading ? (
            <RvLoadingState
              title="Carregando dashboard"
              text="Atualizando alunos, acessos e metodologias."
            />
          ) : renderDashboard()
        )}
        {activeTab === 'students' && renderStudents()}
        {activeTab === 'content' && (
          <Suspense
            fallback={
              <RvLoadingState
                title="Abrindo editor de conteúdo"
                text="Carregando ferramentas de metodologias, aulas e exercícios."
              />
            }
          >
            <AdminContentManager />
          </Suspense>
        )}
        {activeTab === 'settings' && (
          <div className="adminSettingsCard">
            <p className="eyebrow">CONTA</p>
            <h2>{profile.name}</h2>
            <p>{profile.email}</p>
            <div className="settingsRoadmap">
              <span>Integrações</span>
              <strong>Notificações em tempo real ativas</strong>
              <strong>Pagamento e liberação automática</strong>
            </div>
          </div>
        )}
      </section>
    </main>
  )
}
