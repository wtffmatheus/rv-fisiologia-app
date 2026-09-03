import { useEffect, useMemo, useState } from 'react'
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  Check,
  Eye,
  LayoutDashboard,
  LogOut,
  RefreshCw,
  Search,
  Settings,
  ShieldX,
  UsersRound,
  X,
} from 'lucide-react'
import type { Profile } from '../types'
import { supabase } from '../lib/supabase'
import AdminContentManager from '../components/AdminContentManager'
import { RvEmptyState, RvLoadingState } from '../components/PlatformState'

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
    return (
      <div className="dashboardAdminPage">
        <div className="dashboardAdminCards">
          <button onClick={() => setActiveTab('students')}>
            <span>Alunos ativos</span>
            <strong>{activeCount}</strong>
            <small>Ver alunos</small>
          </button>
          <button onClick={() => setActiveTab('students')}>
            <span>Aguardando aprovação</span>
            <strong>{pendingCount}</strong>
            <small>Revisar cadastros</small>
          </button>
          <button onClick={() => setActiveTab('content')}>
            <span>Metodologias ativas</span>
            <strong>{activeProgramCount}</strong>
            <small>Gerenciar conteúdo</small>
          </button>
          <button onClick={() => setActiveTab('students')}>
            <span>Bloqueados</span>
            <strong>{blockedCount}</strong>
            <small>Gerenciar acessos</small>
          </button>
        </div>

        <div className="dashboardQuickGrid">
          <article>
            <p className="eyebrow">CONTEÚDO</p>
            <h2>Monte as aulas sem mexer no código</h2>
            <p>
              Crie metodologias, renomeie aulas, adicione exercícios, defina séries e repetições
              e envie os vídeos direto pelo painel.
            </p>
            <button className="dashboardPrimary" onClick={() => setActiveTab('content')}>
              <BookOpen size={17} /> Abrir editor de conteúdo
            </button>
          </article>

          <article>
            <p className="eyebrow">ACESSOS</p>
            <h2>Defina o plano de cada aluno</h2>
            <p>
              Todo cadastro novo continua aguardando sua aprovação. Você escolhe a metodologia
              antes de liberar o acesso e pode trocar depois.
            </p>
            <button className="dashboardSecondary" onClick={() => setActiveTab('students')}>
              <UsersRound size={17} /> Gerenciar alunos
            </button>
          </article>
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
          <div className="adminStats">
            <span><strong>{pendingCount}</strong> aguardando</span>
            <span><strong>{activeCount}</strong> ativos</span>
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
        {activeTab === 'content' && <AdminContentManager />}
        {activeTab === 'settings' && (
          <div className="adminSettingsCard">
            <p className="eyebrow">CONTA</p>
            <h2>{profile.name}</h2>
            <p>{profile.email}</p>
            <div className="settingsRoadmap">
              <span>Próximas integrações</span>
              <strong>Notificação de novo cadastro</strong>
              <strong>Pagamento e liberação automática</strong>
            </div>
          </div>
        )}
      </section>
    </main>
  )
}
