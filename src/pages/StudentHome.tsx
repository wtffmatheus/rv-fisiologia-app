import { useEffect, useMemo, useState } from 'react'
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

type Exercise = {
  id: number
  title: string
  video_url: string | null
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
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  async function loadStudentData() {
    setLoading(true)
    setMessage('')

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
                video_url,
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
      console.error(assignmentError)
      setMessage(`Erro ao carregar programa: ${assignmentError.message}`)
    }

    if (progressError) {
      console.error(progressError)
    }

    const normalized = assignmentData as unknown as Assignment | null

    if (normalized?.programs) {
      normalized.programs.weeks = [...(normalized.programs.weeks ?? [])]
        .sort((a, b) => a.week_number - b.week_number)
        .map((week) => ({
          ...week,
          lessons: [...(week.lessons ?? [])]
            .sort((a, b) => a.lesson_number - b.lesson_number)
            .map((lesson) => ({
              ...lesson,
              exercises: [...(lesson.exercises ?? [])].sort((a, b) => a.sort_order - b.sort_order),
            })),
        }))
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

  const completedLessonIds = useMemo(
    () => new Set(progress.filter((item) => item.completed).map((item) => item.lesson_id)),
    [progress],
  )

  const completedCount = lessons.filter((lesson) => completedLessonIds.has(lesson.id)).length
  const percentage = lessons.length ? Math.round((completedCount / lessons.length) * 100) : 0
  const nextLesson = lessons.find((lesson) => !completedLessonIds.has(lesson.id)) ?? lessons[0] ?? null

  const selectedLessonIndex = selectedLesson
    ? lessons.findIndex((lesson) => lesson.id === selectedLesson.id)
    : -1

  const previousLesson = selectedLessonIndex > 0 ? lessons[selectedLessonIndex - 1] : null
  const followingLesson =
    selectedLessonIndex >= 0 && selectedLessonIndex < lessons.length - 1
      ? lessons[selectedLessonIndex + 1]
      : null

  async function completeLesson(lesson: Lesson) {
    setMessage('')

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
      console.error(error)
      setMessage(`Erro ao concluir aula: ${error.message}`)
      return
    }

    setMessage('Aula concluída.')
    await loadStudentData()

    if (followingLesson) {
      setSelectedLesson(followingLesson)
    }
  }

  if (loading) {
    return <div className="center">Carregando seu programa...</div>
  }

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
          <p className="muted">Entre em contato com a equipe RV para verificar sua metodologia.</p>
        </section>
      </main>
    )
  }

  if (selectedLesson) {
    return (
      <main className="studentPage lessonPage">
        <header className="studentHeader">
          <button className="lessonBack" onClick={() => setSelectedLesson(null)}>
            <ChevronLeft size={18} />
            Programa
          </button>
          <img src="/logo-rv.png" className="headerLogo" alt="RV Fisiologia" />
        </header>

        <section className="lessonHero">
          <span className="miniLabel">
            {program.title} · Aula {String(selectedLesson.lesson_number).padStart(2, '0')}
          </span>
          <h1>{selectedLesson.title}</h1>
          {selectedLesson.description && <p className="muted">{selectedLesson.description}</p>}
        </section>

        {message && <div className="studentMessage">{message}</div>}

        <div className="lessonNavigator">
          <button
            className="secondary"
            onClick={() => previousLesson && setSelectedLesson(previousLesson)}
            disabled={!previousLesson}
          >
            <ChevronLeft size={17} />
            Aula anterior
          </button>

          <span>
            {selectedLesson.lesson_number} de {lessons.length}
          </span>

          <button
            className="secondary"
            onClick={() => followingLesson && setSelectedLesson(followingLesson)}
            disabled={!followingLesson}
          >
            Próxima aula
            <ChevronRight size={17} />
          </button>
        </div>

        <section className="exerciseList">
          {selectedLesson.exercises.length === 0 && (
            <div className="emptyExercise">
              <strong>Esta aula ainda não possui exercícios cadastrados.</strong>
              <span>Você pode navegar normalmente para as outras aulas.</span>
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

              {exercise.video_url ? (
                <div className="videoFrame">
                  <video controls playsInline preload="metadata">
                    <source src={exercise.video_url} type="video/mp4" />
                    Seu navegador não conseguiu reproduzir o vídeo.
                  </video>
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
                  <span>Repetições</span>
                  <strong>{exercise.repetitions || '—'}</strong>
                </div>
                <div>
                  <span>Descanso</span>
                  <strong>{exercise.rest_seconds ? `${exercise.rest_seconds}s` : '—'}</strong>
                </div>
              </div>
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
            {completedLessonIds.has(selectedLesson.id) ? 'Aula concluída' : 'Concluir e avançar'}
          </button>

          {followingLesson && (
            <button className="secondary" onClick={() => setSelectedLesson(followingLesson)}>
              Pular para próxima aula
              <ChevronRight size={17} />
            </button>
          )}
        </div>
      </main>
    )
  }

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
          <p className="muted">Abra qualquer aula abaixo. Nesta fase de teste, nenhuma aula fica bloqueada.</p>
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

          <div className="progressBar" aria-label={`${percentage}% concluído`}>
            <span style={{ width: `${percentage}%` }} />
          </div>

          <p className="muted smallText">
            {completedCount} de {lessons.length} aulas concluídas
          </p>

          {nextLesson && (
            <button className="primary programAction" onClick={() => setSelectedLesson(nextLesson)}>
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

              <button className="secondary wideButton" onClick={() => setSelectedLesson(nextLesson)}>
                Abrir aula
              </button>
            </>
          ) : (
            <p className="muted">Programa concluído.</p>
          )}
        </article>
      </section>

      {program.weeks.map((week) => (
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
                  onClick={() => setSelectedLesson(lesson)}
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

      <nav className="bottomNav" aria-label="Navegação do aluno">
        <button className="active" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <Home size={18} /><span>Início</span>
        </button>
        <button onClick={() => document.querySelector('.lessonsSection')?.scrollIntoView({ behavior: 'smooth' })}>
          <BookOpen size={18} /><span>Programa</span>
        </button>
        <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <UserRound size={18} /><span>Perfil</span>
        </button>
      </nav>
    </main>
  )
}
