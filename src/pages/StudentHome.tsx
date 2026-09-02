import { FormEvent, useEffect, useMemo, useState } from 'react'
import {
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Home,
  KeyRound,
  LogOut,
  Play,
  UserRound,
} from 'lucide-react'
import type { Profile } from '../types'
import { supabase } from '../lib/supabase'

type StudentNav = 'home' | 'program' | 'profile'

function readStudentRoute(): {
  tab: StudentNav
  lessonId: number | null
} {
  const params = new URLSearchParams(window.location.search)
  const rawView = params.get('view')
  const rawLesson = params.get('lesson')

  const lessonId =
    rawLesson && Number.isFinite(Number(rawLesson)) && Number(rawLesson) > 0
      ? Number(rawLesson)
      : null

  if (lessonId) {
    return { tab: 'program', lessonId }
  }

  if (rawView === 'program' || rawView === 'profile') {
    return { tab: rawView, lessonId: null }
  }

  return { tab: 'home', lessonId: null }
}

function writeStudentRoute(
  tab: StudentNav,
  lessonId: number | null,
  mode: 'push' | 'replace' = 'push',
) {
  const url = new URL(window.location.href)

  if (tab === 'home') {
    url.searchParams.delete('view')
  } else {
    url.searchParams.set('view', tab)
  }

  if (lessonId) {
    url.searchParams.set('lesson', String(lessonId))
    url.searchParams.set('view', 'program')
  } else {
    url.searchParams.delete('lesson')
  }

  const next = `${url.pathname}${url.search}${url.hash}`

  if (mode === 'replace') {
    window.history.replaceState({}, document.title, next)
  } else {
    window.history.pushState({}, document.title, next)
  }
}

type Exercise = {
  id: number
  title: string
  instructions: string | null
  video_url: string | null
  video_path: string | null
  video_ratio: '9:16' | '4:5' | '1:1' | '16:9'
  video_fit: 'cover' | 'contain'
  sets: string | null
  repetitions: string | null
  rest_seconds: number | null
  sort_order: number
}

type Lesson = {
  id: number
  lesson_number: number
  title: string
  description: string | null
  exercises: Exercise[]
}

type Week = {
  id: number
  week_number: number
  title: string | null
  lessons: Lesson[]
}

type Program = {
  id: number
  title: string
  description: string | null
  weeks: Week[]
}

type Assignment = {
  program_id: number
  starts_at: string
  programs: Program | null
}

type Progress = {
  lesson_id: number
  completed: boolean
}

export default function StudentHome({ profile }: { profile: Profile }) {
  const firstName = profile.name?.trim().split(' ')[0] || 'Aluno'
  const [assignment, setAssignment] = useState<Assignment | null>(null)
  const [progress, setProgress] = useState<Progress[]>([])
  const [selectedLessonId, setSelectedLessonId] = useState<number | null>(
    () => readStudentRoute().lessonId,
  )
  const [videoUrls, setVideoUrls] = useState<Record<number, string>>({})
  const [activeNav, setActiveNav] = useState<StudentNav>(
    () => readStudentRoute().tab,
  )
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [accountEmail, setAccountEmail] = useState(profile.email || '')
  const [newEmail, setNewEmail] = useState('')
  const [emailMessage, setEmailMessage] = useState('')
  const [emailLoading, setEmailLoading] = useState(false)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordMessage, setPasswordMessage] = useState('')
  const [passwordLoading, setPasswordLoading] = useState(false)


  async function loadStudentData() {
    setLoading(true)

    const { data: assignmentData, error: assignmentError } = await supabase
      .from('student_programs')
      .select(`
        program_id,
        starts_at,
        programs (
          id,
          title,
          description,
          weeks (
            id,
            week_number,
            title,
            lessons (
              id,
              lesson_number,
              title,
              description,
              exercises (
                id,
                title,
                instructions,
                video_url,
                video_path,
                video_ratio,
                video_fit,
                sets,
                repetitions,
                rest_seconds,
                sort_order
              )
            )
          )
        )
      `)
      .eq('student_id', profile.id)
      .eq('active', true)
      .maybeSingle()

    const { data: progressData, error: progressError } = await supabase
      .from('lesson_progress')
      .select('lesson_id,completed')
      .eq('student_id', profile.id)

    if (assignmentError) {
      setMessage(`Não foi possível carregar seu programa: ${assignmentError.message}`)
    }

    if (progressError) {
      console.error(progressError)
    }

    let normalized = assignmentData as unknown as Assignment | null

    if (normalized?.programs) {
      const sortedProgram: Program = {
        ...normalized.programs,
        weeks: [...(normalized.programs.weeks ?? [])]
          .sort((a, b) => a.week_number - b.week_number)
          .map((week) => ({
            ...week,
            lessons: [...(week.lessons ?? [])]
              .sort((a, b) => a.lesson_number - b.lesson_number)
              .map((lesson) => ({
                ...lesson,
                exercises: [...(lesson.exercises ?? [])].sort(
                  (a, b) => a.sort_order - b.sort_order,
                ),
              })),
          })),
      }

      normalized = { ...normalized, programs: sortedProgram }
    }

    setAssignment(normalized)
    setProgress((progressData as Progress[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    loadStudentData()
  }, [])

  useEffect(() => {
    function handlePopState() {
      const route = readStudentRoute()
      setActiveNav(route.tab)
      setSelectedLessonId(route.lessonId)
      window.scrollTo({ top: 0, behavior: 'auto' })
    }

    window.addEventListener('popstate', handlePopState)

    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [])

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setAccountEmail(data.user?.email || profile.email || '')
    })
  }, [profile.email])

  const program = assignment?.programs ?? null

  const lessons = useMemo(
    () => program?.weeks.flatMap((week) => week.lessons) ?? [],
    [program],
  )

  const selectedLesson = useMemo(
    () => lessons.find((lesson) => lesson.id === selectedLessonId) ?? null,
    [lessons, selectedLessonId],
  )

  useEffect(() => {
    if (
      !loading &&
      selectedLessonId &&
      lessons.length > 0 &&
      !lessons.some((lesson) => lesson.id === selectedLessonId)
    ) {
      setSelectedLessonId(null)
      setActiveNav('program')
      writeStudentRoute('program', null, 'replace')
    }
  }, [loading, lessons, selectedLessonId])


  useEffect(() => {
    let cancelled = false

    async function loadSelectedLessonVideos() {
      setVideoUrls({})

      if (!selectedLesson) return

      const entries = await Promise.all(
        selectedLesson.exercises.map(async (exercise) => {
          if (!exercise.video_path) {
            return [exercise.id, exercise.video_url ?? ''] as const
          }

          try {
            const { data, error } = await supabase.functions.invoke('r2-video', {
              body: {
                action: 'play',
                exercise_id: exercise.id,
              },
            })

            if (error) throw error
            if (data?.error) throw new Error(String(data.error))

            return [exercise.id, String(data?.url ?? '')] as const
          } catch (error) {
            console.error(`Erro ao abrir vídeo do exercício ${exercise.id}:`, error)
            return [exercise.id, ''] as const
          }
        }),
      )

      if (!cancelled) {
        setVideoUrls(Object.fromEntries(entries.filter(([, url]) => Boolean(url))))
      }
    }

    loadSelectedLessonVideos()

    return () => {
      cancelled = true
    }
  }, [selectedLessonId])

  const completedLessonIds = useMemo(
    () => new Set(progress.filter((item) => item.completed).map((item) => item.lesson_id)),
    [progress],
  )

  const completedCount = lessons.filter((lesson) => completedLessonIds.has(lesson.id)).length
  const percentage = lessons.length ? Math.round((completedCount / lessons.length) * 100) : 0
  const nextLesson =
    lessons.find((lesson) => !completedLessonIds.has(lesson.id)) ?? null

  const selectedIndex = selectedLesson
    ? lessons.findIndex((lesson) => lesson.id === selectedLesson.id)
    : -1

  const previousLesson = selectedIndex > 0 ? lessons[selectedIndex - 1] : null
  const followingLesson =
    selectedIndex >= 0 && selectedIndex < lessons.length - 1
      ? lessons[selectedIndex + 1]
      : null

  async function completeLesson(lesson: Lesson) {
    const { error } = await supabase
      .from('lesson_progress')
      .upsert(
        {
          student_id: profile.id,
          lesson_id: lesson.id,
          completed: true,
          completed_at: new Date().toISOString(),
        },
        { onConflict: 'student_id,lesson_id' },
      )

    if (error) {
      setMessage(`Não foi possível concluir a aula: ${error.message}`)
      return
    }

    await loadStudentData()

    if (followingLesson) {
      openLesson(followingLesson.id, 'replace')
    } else {
      setMessage('Aula concluída.')
    }
  }

  function changeTab(tab: StudentNav, mode: 'push' | 'replace' = 'push') {
    setSelectedLessonId(null)
    setActiveNav(tab)
    writeStudentRoute(tab, null, mode)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function openLesson(
    lessonId: number,
    mode: 'push' | 'replace' = 'push',
  ) {
    setActiveNav('program')
    setSelectedLessonId(lessonId)
    writeStudentRoute('program', lessonId, mode)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (loading) return <div className="center">Carregando seu programa...</div>

  if (!program) {
    return (
      <main className="studentPage">
        <header className="studentHeader">
          <div className="studentBrand">
            <img src="/logo-rv-app.png" className="headerLogo" alt="RV Fisiologia" />
          </div>
          <button className="iconButton" onClick={() => supabase.auth.signOut()} aria-label="Sair">
            <LogOut size={18} />
          </button>
        </header>

        <section className="noProgramCard">
          <p className="eyebrow">ACESSO ATIVO</p>
          <h1>Seu programa ainda não foi vinculado.</h1>
          <p className="muted">
            Entre em contato com a equipe RV para verificar sua metodologia.
          </p>
        </section>
      </main>
    )
  }

  const activeProgram: Program = program

  if (selectedLesson) {
    return (
      <main className="studentPage lessonPage">
        <header className="studentHeader">
          <button
            className="lessonBack"
            onClick={() => {
              setSelectedLessonId(null)
              setActiveNav('program')
            }}
          >
            <ChevronLeft size={18} /> Programa
          </button>
          <img src="/logo-rv-app.png" className="headerLogo" alt="RV Fisiologia" />
        </header>

        <section className="lessonHero">
          <span className="miniLabel">
            {program.title} · Aula {String(selectedLesson.lesson_number).padStart(2, '0')}
          </span>
          <h1>{selectedLesson.title}</h1>
          {selectedLesson.description && (
            <p className="muted">{selectedLesson.description}</p>
          )}
        </section>

        {message && <div className="studentMessage">{message}</div>}

        <div className="lessonNavigator">
          <button
            className="secondary"
            onClick={() => previousLesson && openLesson(previousLesson.id)}
            disabled={!previousLesson}
          >
            <ChevronLeft size={17} /> Aula anterior
          </button>

          <span>
            {selectedLesson.lesson_number} de {lessons.length}
          </span>

          <button
            className="secondary"
            onClick={() => followingLesson && openLesson(followingLesson.id)}
            disabled={!followingLesson}
          >
            Próxima aula <ChevronRight size={17} />
          </button>
        </div>

        <section className="exerciseList">
          {selectedLesson.exercises.length === 0 && (
            <div className="emptyExercise">
              <strong>Conteúdo em preparação.</strong>
              <span>Esta aula ainda não possui exercícios cadastrados.</span>
            </div>
          )}

          {selectedLesson.exercises.map((exercise, index) => (
            <article className="exerciseCard" key={exercise.id}>
              <div className="exerciseHeader">
                <span>{String(index + 1).padStart(2, '0')}</span>
                <div>
                  <small>EXERCÍCIO</small>
                  <h2>{exercise.title}</h2>
                </div>
              </div>

              {(videoUrls[exercise.id] || exercise.video_url) ? (
                <div
                  className={`videoFrame standardizedVideo ratio-${(exercise.video_ratio || '9:16').replace(':', '')} fit-${exercise.video_fit || 'cover'}`}
                >
                  <video
                    controls
                    playsInline
                    preload="metadata"
                    src={videoUrls[exercise.id] || exercise.video_url || undefined}
                  />
                </div>
              ) : (
                <div className="videoPlaceholder">
                  <Play size={28} />
                  <span>
                    {exercise.video_path
                      ? 'Carregando vídeo...'
                      : 'Vídeo ainda não disponível'}
                  </span>
                </div>
              )}

              <div className="exerciseMeta">
                <div>
                  <span>Séries</span>
                  <strong>{exercise.sets || '—'}</strong>
                </div>
                <div>
                  <span>Repetições / tempo</span>
                  <strong>{exercise.repetitions || '—'}</strong>
                </div>
                <div>
                  <span>Descanso</span>
                  <strong>
                    {exercise.rest_seconds ? `${exercise.rest_seconds}s` : '—'}
                  </strong>
                </div>
              </div>

              {exercise.instructions && (
                <div className="exerciseInstructions">
                  <span>Orientação</span>
                  <p>{exercise.instructions}</p>
                </div>
              )}
            </article>
          ))}
        </section>

        <div className="lessonActions">
          <button
            className="primary finishLesson"
            onClick={() => completeLesson(selectedLesson)}
            disabled={
              completedLessonIds.has(selectedLesson.id) ||
              selectedLesson.exercises.length === 0
            }
          >
            <CheckCircle2 size={18} />
            {completedLessonIds.has(selectedLesson.id)
              ? 'Aula concluída'
              : selectedLesson.exercises.length === 0
                ? 'Conteúdo em preparação'
                : 'Concluir e avançar'}
          </button>

          {followingLesson && (
            <button
              className="secondary"
              onClick={() => openLesson(followingLesson.id)}
            >
              Pular para próxima aula <ChevronRight size={17} />
            </button>
          )}
        </div>
      </main>
    )
  }

  const startDate = assignment?.starts_at
    ? new Intl.DateTimeFormat('pt-BR').format(
        new Date(`${assignment.starts_at}T12:00:00`),
      )
    : '—'

  function renderHome() {
    return (
      <>
        <section className="studentHero studentTabHero">
          <div>
            <p className="eyebrow">SEU ACOMPANHAMENTO</p>
            <h1>Olá, {firstName}.</h1>
            <p className="muted">Acesse suas aulas e acompanhe seu progresso.</p>
          </div>
        </section>

        <section className="studentGrid">
          <article className="programMainCard">
            <div className="programCardTop">
              <div>
                <span className="miniLabel">METODOLOGIA</span>
                <h2>{activeProgram.title}</h2>
              </div>
              <strong>{percentage}%</strong>
            </div>

            <div className="progressBar">
              <span style={{ width: `${percentage}%` }} />
            </div>

            <p className="muted smallText">
              {completedCount} de {lessons.length} aulas concluídas
            </p>

            {nextLesson && (
              <button className="primary programAction" onClick={() => openLesson(nextLesson.id)}>
                Continuar na aula {String(nextLesson.lesson_number).padStart(2, '0')}
                <ChevronRight size={18} />
              </button>
            )}
          </article>

          <article className="nextLessonCard">
            <span className="miniLabel">PRÓXIMA NÃO CONCLUÍDA</span>
            {nextLesson ? (
              <>
                <div className="nextLessonInfo">
                  <div>
                    <h2>{nextLesson.title}</h2>
                    <p className="muted">{nextLesson.exercises.length} exercício(s)</p>
                  </div>
                  <span className="lessonNumber">
                    {String(nextLesson.lesson_number).padStart(2, '0')}
                  </span>
                </div>

                <button className="secondary wideButton" onClick={() => openLesson(nextLesson.id)}>
                  Abrir aula
                </button>
              </>
            ) : (
              <p className="muted">Programa concluído.</p>
            )}
          </article>
        </section>

        <section className="homeProgramShortcut">
          <div>
            <span className="miniLabel">SEU PLANO</span>
            <h2>Veja todas as semanas e aulas</h2>
            <p className="muted">Acesse a estrutura completa da metodologia {activeProgram.title}.</p>
          </div>
          <button className="secondary" onClick={() => changeTab('program')}>
            Ver programa <ChevronRight size={17} />
          </button>
        </section>
      </>
    )
  }

  function renderProgram() {
    return (
      <>
        <section className="studentTabIntro">
          <div>
            <p className="eyebrow">PROGRAMA</p>
            <h1>{activeProgram.title}</h1>
            <p className="muted">
              {activeProgram.description || 'Todas as aulas da sua metodologia, organizadas por semana.'}
            </p>
          </div>
          <div className="programSummaryPill">
            <strong>{percentage}%</strong>
            <span>{completedCount}/{lessons.length} aulas</span>
          </div>
        </section>

        {activeProgram.weeks.map((week) => (
          <section className="lessonsSection" key={week.id}>
            <div className="sectionHeading">
              <div>
                <span className="miniLabel">SEMANA {week.week_number}</span>
                <h2>{week.title || `Semana ${week.week_number}`}</h2>
              </div>
            </div>

            <div className="lessonList">
              {week.lessons.map((lesson) => {
                const completed = completedLessonIds.has(lesson.id)

                return (
                  <button
                    key={lesson.id}
                    className={`lessonItem ${completed ? 'done' : ''}`}
                    onClick={() => openLesson(lesson.id)}
                  >
                    <div className="lessonIndex">
                      {String(lesson.lesson_number).padStart(2, '0')}
                    </div>
                    <div className="lessonCopy">
                      <strong>{lesson.title}</strong>
                      <span>
                        {completed
                          ? 'Concluída'
                          : lesson.exercises.length > 0
                            ? `${lesson.exercises.length} exercício(s)`
                            : 'Conteúdo em preparação'}
                      </span>
                    </div>
                    {completed ? <CheckCircle2 size={17} /> : <ChevronRight size={17} />}
                  </button>
                )
              })}
            </div>
          </section>
        ))}
      </>
    )
  }

  async function requestEmailChange(event: FormEvent) {
    event.preventDefault()
    setEmailMessage('')

    const nextEmail = newEmail.trim().toLowerCase()

    if (!nextEmail) {
      setEmailMessage('Digite o novo e-mail.')
      return
    }

    if (nextEmail === accountEmail.toLowerCase()) {
      setEmailMessage('Esse já é o e-mail atual da sua conta.')
      return
    }

    setEmailLoading(true)

    const { error } = await supabase.auth.updateUser({ email: nextEmail })

    if (error) {
      setEmailMessage(error.message)
      setEmailLoading(false)
      return
    }

    setNewEmail('')
    setEmailMessage(
      'Solicitação enviada. Confira seu e-mail para confirmar a alteração. Por segurança, o Supabase também pode pedir confirmação no endereço atual.',
    )
    setEmailLoading(false)
  }

  async function changePassword(event: FormEvent) {
    event.preventDefault()
    setPasswordMessage('')

    if (!currentPassword) {
      setPasswordMessage('Digite sua senha atual.')
      return
    }

    if (newPassword.length < 8) {
      setPasswordMessage('A nova senha precisa ter pelo menos 8 caracteres.')
      return
    }

    if (newPassword === currentPassword) {
      setPasswordMessage('A nova senha precisa ser diferente da senha atual.')
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordMessage('A confirmação da nova senha não confere.')
      return
    }

    const email = accountEmail.trim().toLowerCase()

    if (!email) {
      setPasswordMessage('Não foi possível identificar o e-mail da sua conta.')
      return
    }

    setPasswordLoading(true)

    const { error: reauthError } = await supabase.auth.signInWithPassword({
      email,
      password: currentPassword,
    })

    if (reauthError) {
      setPasswordMessage('Senha atual incorreta.')
      setPasswordLoading(false)
      return
    }

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    })

    if (error) {
      setPasswordMessage(error.message)
      setPasswordLoading(false)
      return
    }

    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setPasswordMessage('Senha alterada com sucesso.')
    setPasswordLoading(false)
  }

  function renderProfile() {
    return (
      <section className="studentProfileScreen">
        <div className="profileScreenHero">
          <div className="studentProfileAvatar studentProfileAvatarLarge">
            {(profile.name || 'A').charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="eyebrow">MEU PERFIL</p>
            <h1>{profile.name || 'Aluno RV'}</h1>
            <p className="muted">Informações da sua conta e do acompanhamento atual.</p>
          </div>
        </div>

        <div className="studentProfileGrid profileScreenGrid">
          <div>
            <span>E-mail</span>
            <strong>{accountEmail || profile.email}</strong>
          </div>
          <div>
            <span>Metodologia</span>
            <strong>{activeProgram.title}</strong>
          </div>
          <div>
            <span>Início do programa</span>
            <strong>{startDate}</strong>
          </div>
          <div>
            <span>Progresso</span>
            <strong>{percentage}% concluído</strong>
          </div>
          <div>
            <span>Aulas concluídas</span>
            <strong>{completedCount} de {lessons.length}</strong>
          </div>
          <div>
            <span>Status</span>
            <strong>Acesso ativo</strong>
          </div>
        </div>

        <section className="accountSettingsCard">
          <div className="accountSettingsHeader">
            <div>
              <span className="miniLabel">CONTA</span>
              <h2>Alterar e-mail</h2>
              <p className="muted">
                O novo endereço só passa a valer depois da confirmação por e-mail.
              </p>
            </div>
          </div>

          <form className="accountEmailForm" onSubmit={requestEmailChange}>
            <label>
              Novo e-mail
              <input
                type="email"
                value={newEmail}
                onChange={(event) => setNewEmail(event.target.value)}
                placeholder="novoemail@exemplo.com"
                autoComplete="email"
                required
              />
            </label>

            <button className="secondary" disabled={emailLoading}>
              {emailLoading ? 'Enviando...' : 'Solicitar alteração'}
            </button>
          </form>

          {emailMessage && (
            <div className="accountInlineMessage" role="status">
              {emailMessage}
            </div>
          )}
        </section>

        <section className="accountSettingsCard passwordSettingsCard">
          <div className="accountSettingsHeader">
            <div>
              <span className="miniLabel">SEGURANÇA</span>
              <h2>Alterar senha</h2>
              <p className="muted">
                Confirme sua senha atual e escolha uma nova senha para sua conta.
              </p>
            </div>
            <KeyRound size={20} />
          </div>

          <form className="accountPasswordForm" onSubmit={changePassword}>
            <label>
              Senha atual
              <input
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                placeholder="Digite sua senha atual"
                autoComplete="current-password"
                required
              />
            </label>

            <label>
              Nova senha
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="Mínimo de 8 caracteres"
                minLength={8}
                autoComplete="new-password"
                required
              />
            </label>

            <label>
              Confirmar nova senha
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Digite novamente"
                minLength={8}
                autoComplete="new-password"
                required
              />
            </label>

            <button className="secondary passwordSaveButton" disabled={passwordLoading}>
              {passwordLoading ? 'Alterando...' : 'Alterar senha'}
            </button>
          </form>

          {passwordMessage && (
            <div
              className={
                passwordMessage === 'Senha alterada com sucesso.'
                  ? 'accountInlineMessage success'
                  : 'accountInlineMessage'
              }
              role="status"
            >
              {passwordMessage}
            </div>
          )}
        </section>

        <div className="profileActions">
          <button className="secondary" onClick={() => changeTab('program')}>
            <BookOpen size={17} /> Ver meu programa
          </button>
          <button className="studentProfileLogout" onClick={() => supabase.auth.signOut()}>
            <LogOut size={17} /> Sair da conta
          </button>
        </div>
      </section>
    )
  }

  return (
    <main className={`studentPage studentTabbedPage tab-${activeNav}`}>
      <header className="studentHeader studentHeaderMain">
        <div className="studentBrand">
          <img src="/logo-rv-app.png" className="headerLogo" alt="RV Fisiologia" />
        </div>

        <nav className="studentDesktopNav" aria-label="Navegação do aluno">
          <button
            className={activeNav === 'home' ? 'active' : ''}
            onClick={() => changeTab('home')}
          >
            <Home size={16} /> <span>Início</span>
          </button>
          <button
            className={activeNav === 'program' ? 'active' : ''}
            onClick={() => changeTab('program')}
          >
            <BookOpen size={16} /> <span>Programa</span>
          </button>
          <button
            className={activeNav === 'profile' ? 'active' : ''}
            onClick={() => changeTab('profile')}
          >
            <UserRound size={16} /> <span>Perfil</span>
          </button>
        </nav>

        <button className="iconButton" onClick={() => supabase.auth.signOut()} aria-label="Sair">
          <LogOut size={18} />
        </button>
      </header>

      {message && <div className="studentMessage studentPageMessage">{message}</div>}

      <div className="studentTabContent" key={activeNav}>
        {activeNav === 'home' && renderHome()}
        {activeNav === 'program' && renderProgram()}
        {activeNav === 'profile' && renderProfile()}
      </div>

      <nav className="bottomNav mobileStudentNav" aria-label="Navegação do aluno">
        <button
          className={activeNav === 'home' ? 'active' : ''}
          onClick={() => changeTab('home')}
          aria-current={activeNav === 'home' ? 'page' : undefined}
        >
          <Home size={20} />
          <span>Início</span>
        </button>

        <button
          className={activeNav === 'program' ? 'active' : ''}
          onClick={() => changeTab('program')}
          aria-current={activeNav === 'program' ? 'page' : undefined}
        >
          <BookOpen size={20} />
          <span>Programa</span>
        </button>

        <button
          className={activeNav === 'profile' ? 'active' : ''}
          onClick={() => changeTab('profile')}
          aria-current={activeNav === 'profile' ? 'page' : undefined}
        >
          <UserRound size={20} />
          <span>Perfil</span>
        </button>
      </nav>
    </main>
  )
}
