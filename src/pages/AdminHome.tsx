import { useEffect, useMemo, useState } from 'react'
import {
  BookOpen,
  Check,
  Dumbbell,
  LayoutDashboard,
  LogOut,
  Search,
  Settings,
  ShieldX,
  UsersRound,
} from 'lucide-react'
import type { Profile } from '../types'
import { supabase } from '../lib/supabase'

export default function AdminHome({ profile }: { profile: Profile }) {
  const [students, setStudents] = useState<Profile[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)

  async function loadStudents() {
    setLoading(true)
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'student')
      .order('created_at', { ascending: false })

    if (!error) setStudents((data as Profile[]) ?? [])
    setLoading(false)
  }

  async function changeStatus(id: string, next: 'active' | 'blocked') {
    const { error } = await supabase.from('profiles').update({ status: next }).eq('id', id)
    if (!error) await loadStudents()
  }

  useEffect(() => {
    loadStudents()
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
          <button><LayoutDashboard size={18} />Dashboard</button>
          <button className="active"><UsersRound size={18} />Alunos</button>
          <button><BookOpen size={18} />Programas</button>
          <button><Dumbbell size={18} />Aulas</button>
          <button><Settings size={18} />Configurações</button>
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
            <p className="eyebrow">GESTÃO DE ALUNOS</p>
            <h1>Alunos</h1>
          </div>
          <div className="adminStats">
            <span><strong>{pendingCount}</strong> aguardando</span>
            <span><strong>{activeCount}</strong> ativos</span>
          </div>
        </header>

        <div className="adminToolbar">
          <div className="searchBox">
            <Search size={17} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por nome ou e-mail"
            />
          </div>
        </div>

        <div className="studentTable">
          <div className="tableHeader">
            <span>Aluno</span>
            <span>Status</span>
            <span>Cadastro</span>
            <span>Ações</span>
          </div>

          {loading && <div className="emptyState">Carregando alunos...</div>}

          {!loading && filteredStudents.length === 0 && (
            <div className="emptyState">Nenhum aluno encontrado.</div>
          )}

          {!loading && filteredStudents.map((student) => (
            <article className="studentRow" key={student.id}>
              <div className="studentIdentity">
                <div className="studentAvatar">{student.name?.charAt(0)?.toUpperCase() || 'A'}</div>
                <div>
                  <strong>{student.name || 'Sem nome'}</strong>
                  <span>{student.email}</span>
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

              <span className="createdAt">
                {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(new Date(student.created_at))}
              </span>

              <div className="rowActions">
                <button
                  className="approveButton"
                  onClick={() => changeStatus(student.id, 'active')}
                  disabled={student.status === 'active'}
                >
                  <Check size={16} />
                  Liberar
                </button>
                <button
                  className="blockButton"
                  onClick={() => changeStatus(student.id, 'blocked')}
                >
                  <ShieldX size={16} />
                  Bloquear
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}
