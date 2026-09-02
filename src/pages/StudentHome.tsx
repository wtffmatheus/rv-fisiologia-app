import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Home,
  LogOut,
  Play,
  UserRound,
} from 'lucide-react'
import type { Profile } from '../types'
import { supabase } from '../lib/supabase'

const VIDEO_BUCKET = 'exercise-videos'

type StudentNav = 'home' | 'program' | 'profile'

type Exercise = {
  id: number
  title: string
  instructions: string | null
  video_url: string | null
  video_path: string | null
  resolved_video_url?: string | null
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
  const [selectedLessonId, setSelectedLessonId] = useState<number | null>(null)
  const [activeNav, setActiveNav] = useState<StudentNav>('home')
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  const programSectionRef = useRef<HTMLElement | null>(null)
  const profileSectionRef = useRef<HTMLElement | null>(null)

  async function resolveExerciseVideos(program: Program) {
    const nextWeeks = await Promise.all(
      program.weeks.map(async (week) => ({
        ...week,
        lessons: await Promise.all(
          week.lessons.map(async (lesson) => ({
            ...lesson,
            exercises: await Promise.all(
              lesson.exercises.map(async (exercise) => {
                if (!exercise.video_path) {
                  return { ...exercise, resolved_video_url: exercise.video_url }
                }

                const { data } = await supabase.storage
                  .from(VIDEO_BUCKET)
                  .createSignedUrl(exercise.video_path, 60 * 60)

                return {
                  ...exercise,
                  resolved_video_url: data?.signedUrl ?? null,
                }
              }),
            ),
          })),
        ),
      })),
    )

    return { ...program, weeks: nextWeeks }
  }

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

      const programWithUrls = await resolveExerciseVideos(sortedProgram)
      normalized = { ...normalized, programs: programWithUrls }
    }

    setAssignment(normalized)
    setProgress((progressData as Progress[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    loadStudentData()
  }, [])

  const program = assignment?.programs ?? null

  const lessons = useMemo(
    () => program?.weeks.flatMap((week) => week.lessons) ?? [],
    [program],
  )

  const selectedLesson = useMemo(
    () => lessons.find((lesson) => lesson.id === selectedLessonId) ?? null,
    [lessons, selectedLessonId],
  )

  const completedLessonIds = useMemo(
    () => new Set(progress.filter((item) => item.completed).map((item) => item.lesson_id)),
    [progress],
  )

  const completedCount = lessons.filter((lesson) => completedLessonIds.has(lesson.id)).length
  const percentage = lessons.length ? Math.round((completedCount / lessons.length) * 100) : 0
  const nextLesson =
    lessons.find((lesson) => !completedLessonIds.has(lesson.id)) ?? lessons[0] ?? null

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
      setSelectedLessonId(followingLesson.id)
    } else {
      setMessage('Aula concluída.')
    }
  }

  function goHome() {
    setActiveNav('home')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function goProgram() {
    setActiveNav('program')
    programSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function goProfile() {
    setActiveNav('profile')
    profileSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function openLesson(lessonId: number) {
    setActiveNav('program')
    setSelectedLessonId(lessonId)
    window.scrollTo({ top: 0 })
  }

  if (loading) return <div className="center">Carregando seu programa...</div>

  if (!program) {
    return (
      <main className="studentPage">
        <header className="studentHeader">
          <div className="studentBrand">
            <img src="/logo-rv.png" className="headerLogo" alt="RV Fisiologia" />
            <span>RV Fisiologia</span>
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
          <img src="/logo-rv.png" className="headerLogo" alt="RV Fisiologia" />
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
            onClick={() => previousLesson && setSelectedLessonId(previousLesson.id)}
            disabled={!previousLesson}
          >
            <ChevronLeft size={17} /> Aula anterior
          </button>

          <span>
            {selectedLesson.lesson_number} de {lessons.length}
          </span>

          <button
            className="secondary"
            onClick={() => followingLesson && setSelectedLessonId(followingLesson.id)}
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

              {exercise.resolved_video_url ? (
                <div className="videoFrame">
                  <video
                    controls
                    playsInline
                    preload="metadata"
                    src={exercise.resolved_video_url}
                  />
                </div>
              ) : (
                <div className="videoPlaceholder">
                  <Play size={28} />
                  <span>Vídeo ainda não disponível</span>
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
            disabled={completedLessonIds.has(selectedLesson.id)}
          >
            <CheckCircle2 size={18} />
            {completedLessonIds.has(selectedLesson.id)
              ? 'Aula concluída'
              : 'Concluir e avançar'}
          </button>

          {followingLesson && (
            <button
              className="secondary"
              onClick={() => setSelectedLessonId(followingLesson.id)}
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

  return (
    <main className="studentPage">
      <header className="studentHeader">
        <div className="studentBrand">
          <img src="/logo-rv.png" className="headerLogo" alt="RV Fisiologia" />
          <span>RV Fisiologia</span>
        </div>
        <button className="iconButton" onClick={() => supabase.auth.signOut()} aria-label="Sair">
          <LogOut size={18} />
        </button>
      </header>

      <section className="studentHero">
        <div>
          <p className="eyebrow">SEU ACOMPANHAMENTO</p>
          <h1>Olá, {firstName}.</h1>
          <p className="muted">Acesse suas aulas e acompanhe seu progresso.</p>
        </div>
      </section>

      {message && <div className="studentMessage">{message}</div>}

      <section className="studentGrid">
        <article className="programMainCard">
          <div className="programCardTop">
            <div>
              <span className="miniLabel">METODOLOGIA</span>
              <h2>{program.title}</h2>
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

      <div ref={programSectionRef}>
        {program.weeks.map((week) => (
          <section className="lessonsSection studentScrollTarget" key={week.id}>
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
                    {completed ? (
                      <CheckCircle2 size={17} />
                    ) : (
                      <ChevronRight size={17} />
                    )}
                  </button>
                )
              })}
            </div>
          </section>
        ))}
      </div>

      <section
        className="studentProfileSection studentScrollTarget"
        ref={profileSectionRef}
      >
        <div className="studentProfileHeading">
          <div>
            <span className="miniLabel">SEU PERFIL</span>
            <h2>{profile.name || 'Aluno RV'}</h2>
          </div>
          <div className="studentProfileAvatar">
            {(profile.name || 'A').charAt(0).toUpperCase()}
          </div>
        </div>

        <div className="studentProfileGrid">
          <div>
            <span>E-mail</span>
            <strong>{profile.email}</strong>
          </div>
          <div>
            <span>Metodologia</span>
            <strong>{program.title}</strong>
          </div>
          <div>
            <span>Início</span>
            <strong>{startDate}</strong>
          </div>
          <div>
            <span>Progresso</span>
            <strong>{percentage}% concluído</strong>
          </div>
        </div>

        <button className="studentProfileLogout" onClick={() => supabase.auth.signOut()}>
          <LogOut size={17} />
          Sair da conta
        </button>
      </section>

      <nav className="bottomNav" aria-label="Navegação do aluno">
        <button
          className={activeNav === 'home' ? 'active' : ''}
          onClick={goHome}
          aria-current={activeNav === 'home' ? 'page' : undefined}
        >
          <Home size={19} />
          <span>Início</span>
        </button>

        <button
          className={activeNav === 'program' ? 'active' : ''}
          onClick={goProgram}
          aria-current={activeNav === 'program' ? 'page' : undefined}
        >
          <BookOpen size={19} />
          <span>Programa</span>
        </button>

        <button
          className={activeNav === 'profile' ? 'active' : ''}
          onClick={goProfile}
          aria-current={activeNav === 'profile' ? 'page' : undefined}
        >
          <UserRound size={19} />
          <span>Perfil</span>
        </button>
      </nav>
    </main>
  )
}
