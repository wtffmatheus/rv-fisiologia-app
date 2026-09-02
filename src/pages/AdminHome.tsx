import { useEffect, useMemo, useState } from 'react'
import {
  BookOpen,
  Check,
  Dumbbell,
  LayoutDashboard,
  LogOut,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldX,
  UsersRound,
} from 'lucide-react'
import type { Profile } from '../types'
import { supabase } from '../lib/supabase'

type AdminTab = 'dashboard' | 'students' | 'programs' | 'lessons' | 'settings'

type Program = {
  id: number
  title: string
  description: string | null
  is_active: boolean
}

type Assignment = {
  student_id: string
  program_id: number
  active: boolean
  programs: { title: string } | null
}

type ProgramTree = {
  id: number
  title: string
  weeks: {
    id: number
    week_number: number
    title: string | null
    lessons: {
      id: number
      lesson_number: number
      title: string
    }[]
  }[]
}

export default function AdminHome({ profile }: { profile: Profile }) {
  const [activeTab, setActiveTab] = useState<AdminTab>('students')
  const [students, setStudents] = useState<Profile[]>([])
  const [programs, setPrograms] = useState<Program[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [programTree, setProgramTree] = useState<ProgramTree[]>([])
  const [selectedPrograms, setSelectedPrograms] = useState<Record<string, number>>({})
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [savingStudentId, setSavingStudentId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [newProgramTitle, setNewProgramTitle] = useState('')
  const [newProgramDescription, setNewProgramDescription] = useState('')
  const [creatingProgram, setCreatingProgram] = useState(false)

  async function loadData() {
    setLoading(true)
    setMessage('')

    const [studentsResult, programsResult, assignmentsResult, treeResult] = await Promise.all([
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
        .select('student_id,program_id,active,programs(title)')
        .eq('active', true),
      supabase
        .from('programs')
        .select(`
          id,
          title,
          weeks (
            id,
            week_number,
            title,
            lessons (
              id,
              lesson_number,
              title
            )
          )
        `)
        .eq('is_active', true)
        .order('title'),
    ])

    if (studentsResult.error || programsResult.error || assignmentsResult.error || treeResult.error) {
      console.error({
        students: studentsResult.error,
        programs: programsResult.error,
        assignments: assignmentsResult.error,
        tree: treeResult.error,
      })
      setMessage('Alguns dados do painel não puderam ser carregados.')
    }

    setStudents((studentsResult.data as Profile[]) ?? [])
    setPrograms((programsResult.data as Program[]) ?? [])
    setAssignments((assignmentsResult.data as unknown as Assignment[]) ?? [])

    const tree = ((treeResult.data as unknown as ProgramTree[]) ?? []).map((program) => ({
      ...program,
      weeks: [...(program.weeks ?? [])]
        .sort((a, b) => a.week_number - b.week_number)
        .map((week) => ({
          ...week,
          lessons: [...(week.lessons ?? [])].sort((a, b) => a.lesson_number - b.lesson_number),
        })),
    }))
    setProgramTree(tree)
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  const filteredStudents = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return students
    return students.filter((student) =>
      `${student.name} ${student.email}`.toLowerCase().includes(normalized),
    )
  }, [query, students])

  const pendingCount = students.filter((student) => student.status === 'pending').length
  const activeCount = students.filter((student) => student.status === 'active').length
  const blockedCount = students.filter((student) => student.status === 'blocked').length

  function getProgramName(studentId: string) {
    return assignments.find((item) => item.student_id === studentId)?.programs?.title ?? 'Sem metodologia'
  }

  async function approveStudent(studentId: string) {
    const programId = selectedPrograms[studentId]

    if (!programId) {
      setMessage('Escolha a metodologia do aluno antes de liberar o acesso.')
      return
    }

    setSavingStudentId(studentId)
    setMessage('')

    const { error } = await supabase.rpc('assign_program_to_student', {
      p_student_id: studentId,
      p_program_id: programId,
      p_starts_at: new Date().toISOString().slice(0, 10),
    })

    if (error) {
      console.error(error)
      setMessage(`Erro ao liberar aluno: ${error.message}`)
    } else {
      setMessage('Aluno liberado e metodologia vinculada.')
      setSelectedPrograms((current) => {
        const next = { ...current }
        delete next[studentId]
        return next
      })
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
      await supabase
        .from('student_programs')
        .update({ active: false })
        .eq('student_id', studentId)

      setMessage('Aluno bloqueado.')
      await loadData()
    }

    setSavingStudentId(null)
  }

  async function reactivateStudent(studentId: string) {
    setSavingStudentId(studentId)
    setMessage('')

    const assignment = assignments.find((item) => item.student_id === studentId)

    if (!assignment) {
      setMessage('Esse aluno não tem metodologia vinculada. Selecione uma metodologia e libere novamente.')
      setSavingStudentId(null)
      return
    }

    const { error } = await supabase
      .from('profiles')
      .update({ status: 'active' })
      .eq('id', studentId)

    if (error) {
      setMessage(`Erro ao reativar aluno: ${error.message}`)
    } else {
      await supabase
        .from('student_programs')
        .update({ active: true })
        .eq('student_id', studentId)
        .eq('program_id', assignment.program_id)

      setMessage('Aluno reativado.')
      await loadData()
    }

    setSavingStudentId(null)
  }

  async function createProgram() {
    const title = newProgramTitle.trim()

    if (!title) {
      setMessage('Digite o nome da metodologia.')
      return
    }

    setCreatingProgram(true)
    setMessage('')

    const { data: createdProgram, error: programError } = await supabase
      .from('programs')
      .insert({
        title,
        description: newProgramDescription.trim() || null,
        is_active: true,
      })
      .select('id,title')
      .single()

    if (programError || !createdProgram) {
      setMessage(`Erro ao criar metodologia: ${programError?.message ?? 'erro desconhecido'}`)
      setCreatingProgram(false)
      return
    }

    const { data: createdWeeks, error: weeksError } = await supabase
      .from('weeks')
      .insert([
        { program_id: createdProgram.id, week_number: 1, title: 'Semana 1' },
        { program_id: createdProgram.id, week_number: 2, title: 'Semana 2' },
      ])
      .select('id,week_number')

    if (weeksError || !createdWeeks || createdWeeks.length !== 2) {
      setMessage('A metodologia foi criada, mas houve erro ao criar as semanas.')
      setCreatingProgram(false)
      await loadData()
      return
    }

    const week1 = createdWeeks.find((week) => week.week_number === 1)
    const week2 = createdWeeks.find((week) => week.week_number === 2)

    if (!week1 || !week2) {
      setMessage('A metodologia foi criada, mas não foi possível identificar as semanas.')
      setCreatingProgram(false)
      await loadData()
      return
    }

    const lessons = Array.from({ length: 14 }, (_, index) => {
      const lessonNumber = index + 1
      return {
        week_id: lessonNumber <= 7 ? week1.id : week2.id,
        lesson_number: lessonNumber,
        title: `Aula ${String(lessonNumber).padStart(2, '0')}`,
        description: null,
      }
    })

    const { error: lessonsError } = await supabase.from('lessons').insert(lessons)

    if (lessonsError) {
      setMessage('Metodologia e semanas criadas, mas houve erro ao criar as 14 aulas.')
    } else {
      setMessage(`Metodologia "${title}" criada com 2 semanas e 14 aulas.`)
      setNewProgramTitle('')
      setNewProgramDescription('')
    }

    setCreatingProgram(false)
    await loadData()
  }

  function renderDashboard() {
    return (
      <div className="adminPanelSection">
        <div className="dashboardCards">
          <article>
            <span>Alunos ativos</span>
            <strong>{activeCount}</strong>
          </article>
          <article>
            <span>Aguardando aprovação</span>
            <strong>{pendingCount}</strong>
          </article>
          <article>
            <span>Bloqueados</span>
            <strong>{blockedCount}</strong>
          </article>
          <article>
            <span>Metodologias</span>
            <strong>{programs.filter((program) => program.is_active).length}</strong>
          </article>
        </div>

        <div className="adminSimpleCard">
          <h2>Resumo</h2>
          <p>
            Use Alunos para liberar acessos e escolher a metodologia. Em Programas você pode
            criar novas metodologias. Em Aulas você confere a estrutura de cada programa.
          </p>
        </div>
      </div>
    )
  }

  function renderStudents() {
    return (
      <div className="adminPanelSection">
        <div className="adminToolbar">
          <div className="searchBox">
            <Search size={17} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por nome ou e-mail"
            />
          </div>

          <button className="adminRefresh" onClick={loadData}>
            <RefreshCw size={16} />
            Atualizar
          </button>
        </div>

        <div className="studentTable">
          <div className="tableHeader planTableHeader">
            <span>Aluno</span>
            <span>Status</span>
            <span>Metodologia</span>
            <span>Ações</span>
          </div>

          {loading && <div className="emptyState">Carregando alunos...</div>}

          {!loading && filteredStudents.length === 0 && (
            <div className="emptyState">Nenhum aluno encontrado.</div>
          )}

          {!loading && filteredStudents.map((student) => (
            <article className="studentRow planStudentRow" key={student.id}>
              <div className="studentIdentity">
                <div className="studentAvatar">{student.name?.charAt(0)?.toUpperCase() || 'A'}</div>
                <div>
                  <strong>{student.name || 'Sem nome'}</strong>
                  <span>{student.email}</span>
                  <small>
                    Cadastro em {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(new Date(student.created_at))}
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

              <div className="programCell">
                {student.status === 'pending' || (student.status === 'blocked' && getProgramName(student.id) === 'Sem metodologia') ? (
                  <select
                    value={selectedPrograms[student.id] ?? ''}
                    onChange={(event) =>
                      setSelectedPrograms((current) => ({
                        ...current,
                        [student.id]: Number(event.target.value),
                      }))
                    }
                  >
                    <option value="">Escolher metodologia</option>
                    {programs.filter((program) => program.is_active).map((program) => (
                      <option key={program.id} value={program.id}>{program.title}</option>
                    ))}
                  </select>
                ) : (
                  <span className="assignedProgram">{getProgramName(student.id)}</span>
                )}
              </div>

              <div className="rowActions">
                {student.status === 'pending' && (
                  <button
                    className="approveButton"
                    onClick={() => approveStudent(student.id)}
                    disabled={savingStudentId === student.id || !selectedPrograms[student.id]}
                  >
                    <Check size={16} />
                    {savingStudentId === student.id ? 'Liberando...' : 'Liberar'}
                  </button>
                )}

                {student.status === 'blocked' && getProgramName(student.id) !== 'Sem metodologia' && (
                  <button
                    className="approveButton"
                    onClick={() => reactivateStudent(student.id)}
                    disabled={savingStudentId === student.id}
                  >
                    <Check size={16} />
                    Reativar
                  </button>
                )}

                {student.status === 'blocked' && getProgramName(student.id) === 'Sem metodologia' && (
                  <button
                    className="approveButton"
                    onClick={() => approveStudent(student.id)}
                    disabled={savingStudentId === student.id || !selectedPrograms[student.id]}
                  >
                    <Check size={16} />
                    Liberar
                  </button>
                )}

                {student.status !== 'blocked' && (
                  <button
                    className="blockButton"
                    onClick={() => blockStudent(student.id)}
                    disabled={savingStudentId === student.id}
                  >
                    <ShieldX size={16} />
                    Bloquear
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      </div>
    )
  }

  function renderPrograms() {
    return (
      <div className="adminPanelSection programManager">
        <div className="adminSimpleCard createProgramCard">
          <p className="eyebrow">NOVA METODOLOGIA</p>
          <h2>Criar programa</h2>

          <label>
            Nome
            <input
              value={newProgramTitle}
              onChange={(event) => setNewProgramTitle(event.target.value)}
              placeholder="Ex.: Hipertrofia"
            />
          </label>

          <label>
            Descrição
            <textarea
              value={newProgramDescription}
              onChange={(event) => setNewProgramDescription(event.target.value)}
              placeholder="Descrição opcional"
            />
          </label>

          <button className="approveButton createProgramButton" onClick={createProgram} disabled={creatingProgram}>
            <Plus size={16} />
            {creatingProgram ? 'Criando...' : 'Criar metodologia'}
          </button>
        </div>

        <div className="programCards">
          {programs.map((program) => (
            <article className="adminSimpleCard" key={program.id}>
              <span className={`programState ${program.is_active ? 'active' : 'inactive'}`}>
                {program.is_active ? 'Ativa' : 'Inativa'}
              </span>
              <h2>{program.title}</h2>
              <p>{program.description || 'Sem descrição.'}</p>
            </article>
          ))}
        </div>
      </div>
    )
  }

  function renderLessons() {
    return (
      <div className="adminPanelSection">
        {programTree.length === 0 && !loading && (
          <div className="emptyState">Nenhuma metodologia cadastrada.</div>
        )}

        <div className="adminProgramTree">
          {programTree.map((program) => (
            <article className="adminSimpleCard programTreeCard" key={program.id}>
              <h2>{program.title}</h2>

              {program.weeks.map((week) => (
                <div className="adminWeek" key={week.id}>
                  <strong>Semana {week.week_number}</strong>
                  <div className="adminLessonGrid">
                    {week.lessons.map((lesson) => (
                      <span key={lesson.id}>
                        {String(lesson.lesson_number).padStart(2, '0')} · {lesson.title}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </article>
          ))}
        </div>
      </div>
    )
  }

  function renderSettings() {
    return (
      <div className="adminPanelSection">
        <div className="adminSimpleCard">
          <p className="eyebrow">CONFIGURAÇÕES</p>
          <h2>Conta administrativa</h2>
          <p><strong>Nome:</strong> {profile.name}</p>
          <p><strong>E-mail:</strong> {profile.email}</p>
          <p className="muted">
            As configurações de notificações e pagamentos serão adicionadas nas próximas etapas.
          </p>
        </div>
      </div>
    )
  }

  const titles: Record<AdminTab, { eyebrow: string; title: string }> = {
    dashboard: { eyebrow: 'VISÃO GERAL', title: 'Dashboard' },
    students: { eyebrow: 'GESTÃO DE ALUNOS', title: 'Alunos' },
    programs: { eyebrow: 'METODOLOGIAS', title: 'Programas' },
    lessons: { eyebrow: 'CONTEÚDO', title: 'Aulas' },
    settings: { eyebrow: 'PREFERÊNCIAS', title: 'Configurações' },
  }

  return (
    <main className="adminPage">
      <aside className="adminSidebar">
        <div className="adminBrand">
          <img src="/logo-rv.png" className="adminLogo" alt="RV Fisiologia" />
          <div>
            <strong>RV Fisiologia</strong>
            <span>Painel administrativo</span>
          </div>
        </div>

        <nav className="adminMenu">
          <button
            className={activeTab === 'dashboard' ? 'active' : ''}
            onClick={() => setActiveTab('dashboard')}
          >
            <LayoutDashboard size={18} />Dashboard
          </button>

          <button
            className={activeTab === 'students' ? 'active' : ''}
            onClick={() => setActiveTab('students')}
          >
            <UsersRound size={18} />Alunos
          </button>

          <button
            className={activeTab === 'programs' ? 'active' : ''}
            onClick={() => setActiveTab('programs')}
          >
            <BookOpen size={18} />Programas
          </button>

          <button
            className={activeTab === 'lessons' ? 'active' : ''}
            onClick={() => setActiveTab('lessons')}
          >
            <Dumbbell size={18} />Aulas
          </button>

          <button
            className={activeTab === 'settings' ? 'active' : ''}
            onClick={() => setActiveTab('settings')}
          >
            <Settings size={18} />Configurações
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

      <section className="adminContent">
        <header className="adminTopbar">
          <div>
            <p className="eyebrow">{titles[activeTab].eyebrow}</p>
            <h1>{titles[activeTab].title}</h1>
          </div>

          <div className="adminStats">
            <span><strong>{pendingCount}</strong> aguardando</span>
            <span><strong>{activeCount}</strong> ativos</span>
          </div>
        </header>

        {message && <div className="adminMessage">{message}</div>}

        {activeTab === 'dashboard' && renderDashboard()}
        {activeTab === 'students' && renderStudents()}
        {activeTab === 'programs' && renderPrograms()}
        {activeTab === 'lessons' && renderLessons()}
        {activeTab === 'settings' && renderSettings()}
      </section>
    </main>
  )
}
