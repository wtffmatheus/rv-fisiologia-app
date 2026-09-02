import { useEffect, useMemo, useState } from 'react'
import {
  BookOpen,
  Check,
  LayoutDashboard,
  LogOut,
  RefreshCw,
  Search,
  Settings,
  ShieldX,
  UsersRound,
} from 'lucide-react'
import type { Profile } from '../types'
import { supabase } from '../lib/supabase'
import AdminContentManager from '../components/AdminContentManager'

type AdminTab = 'dashboard' | 'students' | 'content' | 'settings'

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

export default function AdminHome({ profile }: { profile: Profile }) {
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard')
  const [students, setStudents] = useState<Profile[]>([])
  const [programs, setPrograms] = useState<Program[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [selectedPrograms, setSelectedPrograms] = useState<Record<string, number>>({})
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [savingStudentId, setSavingStudentId] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  async function loadData() {
    setLoading(true)

    const [studentsResult, programsResult, assignmentsResult] = await Promise.all([
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
    ])

    if (studentsResult.error || programsResult.error || assignmentsResult.error) {
      setMessage('Não foi possível atualizar todos os dados do painel.')
    }

    setStudents((studentsResult.data as Profile[]) ?? [])
    setPrograms((programsResult.data as Program[]) ?? [])
    setAssignments((assignmentsResult.data as unknown as Assignment[]) ?? [])
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
  const activeProgramCount = programs.filter((program) => program.is_active).length

  function getAssignment(studentId: string) {
    return assignments.find((item) => item.student_id === studentId) ?? null
  }

  function getProgramName(studentId: string) {
    return getAssignment(studentId)?.programs?.title ?? 'Sem metodologia'
  }

  async function approveStudent(studentId: string) {
    const programId = selectedPrograms[studentId]
    if (!programId) {
      setMessage('Escolha a metodologia antes de liberar o aluno.')
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
      setMessage(`Erro ao liberar aluno: ${error.message}`)
    } else {
      setMessage('Aluno liberado com a metodologia selecionada.')
      await loadData()
    }

    setSavingStudentId(null)
  }

  async function changeStudentProgram(studentId: string, programId: number) {
    setSavingStudentId(studentId)
    setMessage('')

    const { error } = await supabase.rpc('assign_program_to_student', {
      p_student_id: studentId,
      p_program_id: programId,
      p_starts_at: new Date().toISOString().slice(0, 10),
    })

    if (error) {
      setMessage(`Erro ao trocar metodologia: ${error.message}`)
    } else {
      setMessage('Metodologia do aluno atualizada.')
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
    const assignment = assignments.find((item) => item.student_id === studentId)

    if (!assignment) {
      setMessage('Selecione uma metodologia para liberar esse aluno novamente.')
      return
    }

    setSavingStudentId(studentId)

    const { error } = await supabase
      .from('profiles')
      .update({ status: 'active' })
      .eq('id', studentId)

    if (!error) {
      await supabase
        .from('student_programs')
        .update({ active: true })
        .eq('student_id', studentId)
        .eq('program_id', assignment.program_id)
      setMessage('Aluno reativado.')
      await loadData()
    } else {
      setMessage(`Erro ao reativar aluno: ${error.message}`)
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
    return (
      <div className="adminStudentsPage">
        <div className="adminToolbar strongToolbar">
          <div className="searchBox">
            <Search size={17} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por nome ou e-mail"
            />
          </div>
          <button className="adminRefresh" onClick={loadData}>
            <RefreshCw size={16} /> Atualizar
          </button>
        </div>

        <div className="studentTable enhancedStudentTable">
          <div className="tableHeader enhancedStudentHeader">
            <span>Aluno</span>
            <span>Status</span>
            <span>Metodologia</span>
            <span>Ações</span>
          </div>

          {loading && <div className="emptyState">Carregando alunos...</div>}

          {!loading && filteredStudents.map((student) => {
            const assignment = getAssignment(student.id)
            const currentProgramId = assignment?.program_id ?? 0
            const needsProgram = student.status === 'pending' || !assignment

            return (
              <article className="studentRow enhancedStudentRow" key={student.id}>
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
                    {student.status === 'pending' ? 'Aguardando' : student.status === 'active' ? 'Ativo' : 'Bloqueado'}
                  </span>
                </div>

                <div className="programCell">
                  <select
                    value={needsProgram ? selectedPrograms[student.id] ?? '' : currentProgramId}
                    onChange={(event) => {
                      const nextProgramId = Number(event.target.value)
                      if (needsProgram) {
                        setSelectedPrograms((current) => ({ ...current, [student.id]: nextProgramId }))
                      } else if (nextProgramId && nextProgramId !== currentProgramId) {
                        changeStudentProgram(student.id, nextProgramId)
                      }
                    }}
                    disabled={savingStudentId === student.id}
                  >
                    <option value="">Escolher metodologia</option>
                    {programs.filter((program) => program.is_active).map((program) => (
                      <option key={program.id} value={program.id}>{program.title}</option>
                    ))}
                  </select>
                  {!needsProgram && <small>Atual: {getProgramName(student.id)}</small>}
                </div>

                <div className="rowActions">
                  {student.status === 'pending' && (
                    <button
                      className="approveButton"
                      onClick={() => approveStudent(student.id)}
                      disabled={savingStudentId === student.id || !selectedPrograms[student.id]}
                    >
                      <Check size={16} /> Liberar
                    </button>
                  )}

                  {student.status === 'blocked' && assignment && (
                    <button
                      className="approveButton"
                      onClick={() => reactivateStudent(student.id)}
                      disabled={savingStudentId === student.id}
                    >
                      <Check size={16} /> Reativar
                    </button>
                  )}

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
      subtitle: 'Aprove cadastros, escolha metodologias e altere acessos.',
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
          <div className="adminMessage">
            <span>{message}</span>
            <button onClick={() => setMessage('')}>×</button>
          </div>
        )}

        {activeTab === 'dashboard' && renderDashboard()}
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
