import { ChangeEvent, useEffect, useMemo, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronRight,
  FileVideo,
  FolderPlus,
  Pencil,
  Plus,
  Save,
  Trash2,
  Upload,
  Video,
  X,
} from 'lucide-react'
import { supabase } from '../lib/supabase'

type Program = {
  id: number
  title: string
  description: string | null
  is_active: boolean
}

type Week = {
  id: number
  program_id: number
  week_number: number
  title: string | null
}

type Lesson = {
  id: number
  week_id: number
  lesson_number: number
  title: string
  description: string | null
}

type Exercise = {
  id: number
  lesson_id: number
  title: string
  instructions: string | null
  video_url: string | null
  video_path: string | null
  sets: string | null
  repetitions: string | null
  rest_seconds: number | null
  sort_order: number
}

type Feedback = {
  type: 'success' | 'error'
  text: string
} | null

const VIDEO_BUCKET = 'exercise-videos'
const MAX_VIDEO_BYTES = 200 * 1024 * 1024

function safeFileName(name: string) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export default function AdminContentManager() {
  const [programs, setPrograms] = useState<Program[]>([])
  const [weeks, setWeeks] = useState<Week[]>([])
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [videoPreviews, setVideoPreviews] = useState<Record<number, string>>({})

  const [selectedProgramId, setSelectedProgramId] = useState<number | null>(null)
  const [selectedLessonId, setSelectedLessonId] = useState<number | null>(null)

  const [programTitle, setProgramTitle] = useState('')
  const [programDescription, setProgramDescription] = useState('')
  const [programActive, setProgramActive] = useState(true)

  const [lessonTitle, setLessonTitle] = useState('')
  const [lessonDescription, setLessonDescription] = useState('')

  const [newProgramTitle, setNewProgramTitle] = useState('')
  const [newProgramDescription, setNewProgramDescription] = useState('')
  const [showNewProgram, setShowNewProgram] = useState(false)

  const [newExerciseTitle, setNewExerciseTitle] = useState('')
  const [newExerciseInstructions, setNewExerciseInstructions] = useState('')
  const [newExerciseSets, setNewExerciseSets] = useState('3')
  const [newExerciseRepetitions, setNewExerciseRepetitions] = useState('12')
  const [newExerciseRest, setNewExerciseRest] = useState('45')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingExerciseId, setUploadingExerciseId] = useState<number | null>(null)
  const [feedback, setFeedback] = useState<Feedback>(null)

  const selectedProgram = useMemo(
    () => programs.find((program) => program.id === selectedProgramId) ?? null,
    [programs, selectedProgramId],
  )

  const selectedLesson = useMemo(
    () => lessons.find((lesson) => lesson.id === selectedLessonId) ?? null,
    [lessons, selectedLessonId],
  )

  const weeksWithLessons = useMemo(
    () =>
      weeks.map((week) => ({
        ...week,
        lessons: lessons
          .filter((lesson) => lesson.week_id === week.id)
          .sort((a, b) => a.lesson_number - b.lesson_number),
      })),
    [weeks, lessons],
  )

  async function loadPrograms(preferredProgramId?: number | null) {
    setLoading(true)

    const { data, error } = await supabase
      .from('programs')
      .select('id,title,description,is_active')
      .order('created_at', { ascending: true })

    if (error) {
      setFeedback({ type: 'error', text: `Erro ao carregar metodologias: ${error.message}` })
      setLoading(false)
      return
    }

    const nextPrograms = (data as Program[]) ?? []
    setPrograms(nextPrograms)

    const nextProgramId =
      preferredProgramId && nextPrograms.some((program) => program.id === preferredProgramId)
        ? preferredProgramId
        : selectedProgramId && nextPrograms.some((program) => program.id === selectedProgramId)
          ? selectedProgramId
          : nextPrograms[0]?.id ?? null

    setSelectedProgramId(nextProgramId)

    if (nextProgramId) {
      await loadProgramStructure(nextProgramId)
    } else {
      setWeeks([])
      setLessons([])
      setSelectedLessonId(null)
      setExercises([])
    }

    setLoading(false)
  }

  async function loadProgramStructure(programId: number, preferredLessonId?: number | null) {
    const { data: weekData, error: weekError } = await supabase
      .from('weeks')
      .select('id,program_id,week_number,title')
      .eq('program_id', programId)
      .order('week_number')

    if (weekError) {
      setFeedback({ type: 'error', text: `Erro ao carregar semanas: ${weekError.message}` })
      return
    }

    const nextWeeks = (weekData as Week[]) ?? []
    setWeeks(nextWeeks)

    const weekIds = nextWeeks.map((week) => week.id)
    let nextLessons: Lesson[] = []

    if (weekIds.length > 0) {
      const { data: lessonData, error: lessonError } = await supabase
        .from('lessons')
        .select('id,week_id,lesson_number,title,description')
        .in('week_id', weekIds)
        .order('lesson_number')

      if (lessonError) {
        setFeedback({ type: 'error', text: `Erro ao carregar aulas: ${lessonError.message}` })
        return
      }

      nextLessons = (lessonData as Lesson[]) ?? []
    }

    setLessons(nextLessons)

    const nextLessonId =
      preferredLessonId && nextLessons.some((lesson) => lesson.id === preferredLessonId)
        ? preferredLessonId
        : selectedLessonId && nextLessons.some((lesson) => lesson.id === selectedLessonId)
          ? selectedLessonId
          : nextLessons[0]?.id ?? null

    setSelectedLessonId(nextLessonId)

    if (nextLessonId) {
      await loadExercises(nextLessonId)
    } else {
      setExercises([])
      setVideoPreviews({})
    }
  }

  async function loadExercises(lessonId: number) {
    const { data, error } = await supabase
      .from('exercises')
      .select('id,lesson_id,title,instructions,video_url,video_path,sets,repetitions,rest_seconds,sort_order')
      .eq('lesson_id', lessonId)
      .order('sort_order')
      .order('id')

    if (error) {
      setFeedback({ type: 'error', text: `Erro ao carregar exercícios: ${error.message}` })
      return
    }

    const nextExercises = (data as Exercise[]) ?? []
    setExercises(nextExercises)

    const previewEntries = await Promise.all(
      nextExercises.map(async (exercise) => {
        if (exercise.video_path) {
          const { data: signedData } = await supabase.storage
            .from(VIDEO_BUCKET)
            .createSignedUrl(exercise.video_path, 60 * 60)

          return [exercise.id, signedData?.signedUrl ?? ''] as const
        }

        return [exercise.id, exercise.video_url ?? ''] as const
      }),
    )

    setVideoPreviews(Object.fromEntries(previewEntries.filter(([, url]) => Boolean(url))))
  }

  useEffect(() => {
    loadPrograms()
  }, [])

  useEffect(() => {
    if (!selectedProgram) return
    setProgramTitle(selectedProgram.title)
    setProgramDescription(selectedProgram.description ?? '')
    setProgramActive(selectedProgram.is_active)
  }, [selectedProgram])

  useEffect(() => {
    if (!selectedLesson) {
      setLessonTitle('')
      setLessonDescription('')
      return
    }

    setLessonTitle(selectedLesson.title)
    setLessonDescription(selectedLesson.description ?? '')
  }, [selectedLesson])

  async function chooseProgram(programId: number) {
    setSelectedProgramId(programId)
    setSelectedLessonId(null)
    setExercises([])
    setFeedback(null)
    await loadProgramStructure(programId, null)
  }

  async function chooseLesson(lessonId: number) {
    setSelectedLessonId(lessonId)
    setFeedback(null)
    await loadExercises(lessonId)
  }

  async function createProgram() {
    const title = newProgramTitle.trim()
    if (!title) {
      setFeedback({ type: 'error', text: 'Digite o nome da metodologia.' })
      return
    }

    setSaving(true)
    setFeedback(null)

    const { data: createdProgram, error: programError } = await supabase
      .from('programs')
      .insert({
        title,
        description: newProgramDescription.trim() || null,
        is_active: true,
      })
      .select('id')
      .single()

    if (programError || !createdProgram) {
      setFeedback({ type: 'error', text: `Erro ao criar metodologia: ${programError?.message ?? 'erro desconhecido'}` })
      setSaving(false)
      return
    }

    const { data: createdWeeks, error: weeksError } = await supabase
      .from('weeks')
      .insert([
        { program_id: createdProgram.id, week_number: 1, title: 'Semana 1' },
        { program_id: createdProgram.id, week_number: 2, title: 'Semana 2' },
      ])
      .select('id,week_number')

    if (weeksError || !createdWeeks) {
      setFeedback({ type: 'error', text: 'Metodologia criada, mas não foi possível criar as semanas.' })
      setSaving(false)
      await loadPrograms(createdProgram.id)
      return
    }

    const week1 = createdWeeks.find((week) => week.week_number === 1)
    const week2 = createdWeeks.find((week) => week.week_number === 2)

    if (week1 && week2) {
      const initialLessons = Array.from({ length: 14 }, (_, index) => {
        const number = index + 1
        return {
          week_id: number <= 7 ? week1.id : week2.id,
          lesson_number: number,
          title: `Aula ${String(number).padStart(2, '0')}`,
          description: null,
        }
      })

      await supabase.from('lessons').insert(initialLessons)
    }

    setNewProgramTitle('')
    setNewProgramDescription('')
    setShowNewProgram(false)
    setFeedback({ type: 'success', text: 'Metodologia criada com 2 semanas e 14 aulas.' })
    setSaving(false)
    await loadPrograms(createdProgram.id)
  }

  async function saveProgram() {
    if (!selectedProgramId || !programTitle.trim()) return

    setSaving(true)
    setFeedback(null)

    const { error } = await supabase
      .from('programs')
      .update({
        title: programTitle.trim(),
        description: programDescription.trim() || null,
        is_active: programActive,
      })
      .eq('id', selectedProgramId)

    if (error) {
      setFeedback({ type: 'error', text: `Erro ao salvar metodologia: ${error.message}` })
    } else {
      setFeedback({ type: 'success', text: 'Metodologia atualizada.' })
      await loadPrograms(selectedProgramId)
    }

    setSaving(false)
  }

  async function addWeek() {
    if (!selectedProgramId) return

    const nextWeekNumber = Math.max(0, ...weeks.map((week) => week.week_number)) + 1

    const { error } = await supabase.from('weeks').insert({
      program_id: selectedProgramId,
      week_number: nextWeekNumber,
      title: `Semana ${nextWeekNumber}`,
    })

    if (error) {
      setFeedback({ type: 'error', text: `Erro ao criar semana: ${error.message}` })
      return
    }

    setFeedback({ type: 'success', text: `Semana ${nextWeekNumber} adicionada.` })
    await loadProgramStructure(selectedProgramId)
  }

  async function addLesson(weekId: number) {
    if (!selectedProgramId) return

    const nextLessonNumber = Math.max(0, ...lessons.map((lesson) => lesson.lesson_number)) + 1

    const { data, error } = await supabase
      .from('lessons')
      .insert({
        week_id: weekId,
        lesson_number: nextLessonNumber,
        title: `Aula ${String(nextLessonNumber).padStart(2, '0')}`,
        description: null,
      })
      .select('id')
      .single()

    if (error || !data) {
      setFeedback({ type: 'error', text: `Erro ao criar aula: ${error?.message ?? 'erro desconhecido'}` })
      return
    }

    setFeedback({ type: 'success', text: 'Nova aula adicionada.' })
    await loadProgramStructure(selectedProgramId, data.id)
  }

  async function saveLesson() {
    if (!selectedProgramId || !selectedLessonId || !lessonTitle.trim()) return

    setSaving(true)

    const { error } = await supabase
      .from('lessons')
      .update({
        title: lessonTitle.trim(),
        description: lessonDescription.trim() || null,
      })
      .eq('id', selectedLessonId)

    if (error) {
      setFeedback({ type: 'error', text: `Erro ao salvar aula: ${error.message}` })
    } else {
      setFeedback({ type: 'success', text: 'Aula atualizada.' })
      await loadProgramStructure(selectedProgramId, selectedLessonId)
    }

    setSaving(false)
  }

  async function deleteLesson() {
    if (!selectedProgramId || !selectedLessonId || !selectedLesson) return

    const accepted = window.confirm(`Excluir "${selectedLesson.title}" e todos os exercícios dela?`)
    if (!accepted) return

    setSaving(true)

    const paths = exercises.map((exercise) => exercise.video_path).filter(Boolean) as string[]
    if (paths.length > 0) {
      await supabase.storage.from(VIDEO_BUCKET).remove(paths)
    }

    const { error } = await supabase.from('lessons').delete().eq('id', selectedLessonId)

    if (error) {
      setFeedback({ type: 'error', text: `Erro ao excluir aula: ${error.message}` })
    } else {
      setFeedback({ type: 'success', text: 'Aula excluída.' })
      setSelectedLessonId(null)
      await loadProgramStructure(selectedProgramId, null)
    }

    setSaving(false)
  }

  async function addExercise() {
    if (!selectedLessonId || !newExerciseTitle.trim()) {
      setFeedback({ type: 'error', text: 'Digite o nome do exercício.' })
      return
    }

    const nextSort = Math.max(0, ...exercises.map((exercise) => exercise.sort_order)) + 1
    const rest = Number(newExerciseRest)

    const { data, error } = await supabase
      .from('exercises')
      .insert({
        lesson_id: selectedLessonId,
        title: newExerciseTitle.trim(),
        instructions: newExerciseInstructions.trim() || null,
        sets: newExerciseSets.trim() || null,
        repetitions: newExerciseRepetitions.trim() || null,
        rest_seconds: Number.isFinite(rest) ? rest : null,
        sort_order: nextSort,
      })
      .select('id')
      .single()

    if (error || !data) {
      setFeedback({ type: 'error', text: `Erro ao adicionar exercício: ${error?.message ?? 'erro desconhecido'}` })
      return
    }

    setNewExerciseTitle('')
    setNewExerciseInstructions('')
    setNewExerciseSets('3')
    setNewExerciseRepetitions('12')
    setNewExerciseRest('45')
    setFeedback({ type: 'success', text: 'Exercício adicionado.' })
    await loadExercises(selectedLessonId)
  }

  function updateExerciseLocal(id: number, patch: Partial<Exercise>) {
    setExercises((current) =>
      current.map((exercise) => (exercise.id === id ? { ...exercise, ...patch } : exercise)),
    )
  }

  async function saveExercise(exercise: Exercise) {
    const { error } = await supabase
      .from('exercises')
      .update({
        title: exercise.title.trim(),
        instructions: exercise.instructions?.trim() || null,
        sets: exercise.sets?.trim() || null,
        repetitions: exercise.repetitions?.trim() || null,
        rest_seconds: exercise.rest_seconds,
      })
      .eq('id', exercise.id)

    if (error) {
      setFeedback({ type: 'error', text: `Erro ao salvar exercício: ${error.message}` })
    } else {
      setFeedback({ type: 'success', text: `Exercício "${exercise.title}" atualizado.` })
      if (selectedLessonId) await loadExercises(selectedLessonId)
    }
  }

  async function deleteExercise(exercise: Exercise) {
    const accepted = window.confirm(`Excluir o exercício "${exercise.title}"?`)
    if (!accepted) return

    if (exercise.video_path) {
      await supabase.storage.from(VIDEO_BUCKET).remove([exercise.video_path])
    }

    const { error } = await supabase.from('exercises').delete().eq('id', exercise.id)

    if (error) {
      setFeedback({ type: 'error', text: `Erro ao excluir exercício: ${error.message}` })
      return
    }

    setFeedback({ type: 'success', text: 'Exercício excluído.' })
    if (selectedLessonId) await loadExercises(selectedLessonId)
  }

  async function moveExercise(index: number, direction: -1 | 1) {
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= exercises.length || !selectedLessonId) return

    const reordered = [...exercises]
    const [item] = reordered.splice(index, 1)
    reordered.splice(targetIndex, 0, item)

    setExercises(reordered.map((exercise, order) => ({ ...exercise, sort_order: order + 1 })))

    const updates = reordered.map((exercise, order) =>
      supabase.from('exercises').update({ sort_order: order + 1 }).eq('id', exercise.id),
    )

    await Promise.all(updates)
    await loadExercises(selectedLessonId)
  }

  async function uploadVideo(exercise: Exercise, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file || !selectedProgramId || !selectedLessonId) return

    if (!['video/mp4', 'video/quicktime', 'video/webm'].includes(file.type)) {
      setFeedback({ type: 'error', text: 'Use vídeo MP4, MOV ou WebM.' })
      return
    }

    if (file.size > MAX_VIDEO_BYTES) {
      setFeedback({ type: 'error', text: 'O vídeo precisa ter até 200 MB.' })
      return
    }

    setUploadingExerciseId(exercise.id)
    setFeedback(null)

    const fileName = safeFileName(file.name || 'video.mp4') || 'video.mp4'
    const path = `programs/${selectedProgramId}/lessons/${selectedLessonId}/${exercise.id}-${Date.now()}-${fileName}`

    const { error: uploadError } = await supabase.storage
      .from(VIDEO_BUCKET)
      .upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type,
      })

    if (uploadError) {
      setFeedback({ type: 'error', text: `Erro no upload: ${uploadError.message}` })
      setUploadingExerciseId(null)
      return
    }

    const { error: updateError } = await supabase
      .from('exercises')
      .update({ video_path: path, video_url: null })
      .eq('id', exercise.id)

    if (updateError) {
      await supabase.storage.from(VIDEO_BUCKET).remove([path])
      setFeedback({ type: 'error', text: `Vídeo enviado, mas não foi possível vincular: ${updateError.message}` })
      setUploadingExerciseId(null)
      return
    }

    if (exercise.video_path) {
      await supabase.storage.from(VIDEO_BUCKET).remove([exercise.video_path])
    }

    setFeedback({ type: 'success', text: `Vídeo de "${exercise.title}" atualizado.` })
    setUploadingExerciseId(null)
    await loadExercises(selectedLessonId)
  }

  async function removeVideo(exercise: Exercise) {
    const accepted = window.confirm(`Remover o vídeo de "${exercise.title}"?`)
    if (!accepted) return

    if (exercise.video_path) {
      await supabase.storage.from(VIDEO_BUCKET).remove([exercise.video_path])
    }

    const { error } = await supabase
      .from('exercises')
      .update({ video_path: null, video_url: null })
      .eq('id', exercise.id)

    if (error) {
      setFeedback({ type: 'error', text: `Erro ao remover vídeo: ${error.message}` })
      return
    }

    setFeedback({ type: 'success', text: 'Vídeo removido.' })
    if (selectedLessonId) await loadExercises(selectedLessonId)
  }

  if (loading) {
    return <div className="contentLoading">Carregando conteúdo...</div>
  }

  return (
    <div className="contentManager">
      {feedback && (
        <div className={`contentFeedback ${feedback.type}`}>
          <span>{feedback.text}</span>
          <button onClick={() => setFeedback(null)} aria-label="Fechar aviso"><X size={16} /></button>
        </div>
      )}

      <aside className="contentSidebar">
        <div className="contentSidebarHeader">
          <div>
            <span>METODOLOGIAS</span>
            <strong>{programs.length}</strong>
          </div>
          <button className="squareAction" onClick={() => setShowNewProgram((current) => !current)} title="Nova metodologia">
            <Plus size={18} />
          </button>
        </div>

        {showNewProgram && (
          <div className="newProgramBox">
            <input
              value={newProgramTitle}
              onChange={(event) => setNewProgramTitle(event.target.value)}
              placeholder="Nome da metodologia"
            />
            <textarea
              value={newProgramDescription}
              onChange={(event) => setNewProgramDescription(event.target.value)}
              placeholder="Descrição opcional"
            />
            <button className="solidAction" onClick={createProgram} disabled={saving}>
              <Check size={16} /> Criar
            </button>
          </div>
        )}

        <div className="programNavList">
          {programs.map((program) => (
            <button
              key={program.id}
              className={program.id === selectedProgramId ? 'active' : ''}
              onClick={() => chooseProgram(program.id)}
            >
              <div>
                <strong>{program.title}</strong>
                <span>{program.is_active ? 'Ativa' : 'Inativa'}</span>
              </div>
              <ChevronRight size={16} />
            </button>
          ))}
        </div>
      </aside>

      <section className="contentWorkspace">
        {!selectedProgram ? (
          <div className="emptyContentState">
            <FolderPlus size={32} />
            <h2>Crie sua primeira metodologia</h2>
            <p>Depois você poderá montar semanas, aulas, exercícios e vídeos.</p>
          </div>
        ) : (
          <>
            <div className="programEditorHeader">
              <div className="programEditorFields">
                <label>
                  Nome da metodologia
                  <input value={programTitle} onChange={(event) => setProgramTitle(event.target.value)} />
                </label>
                <label>
                  Descrição
                  <input value={programDescription} onChange={(event) => setProgramDescription(event.target.value)} />
                </label>
              </div>

              <div className="programEditorActions">
                <label className="activeSwitch">
                  <input
                    type="checkbox"
                    checked={programActive}
                    onChange={(event) => setProgramActive(event.target.checked)}
                  />
                  <span>{programActive ? 'Metodologia ativa' : 'Metodologia inativa'}</span>
                </label>
                <button className="outlineAction" onClick={saveProgram} disabled={saving}>
                  <Save size={16} /> Salvar metodologia
                </button>
              </div>
            </div>

            <div className="contentColumns">
              <aside className="lessonNavigatorAdmin">
                <div className="lessonNavigatorTitle">
                  <div>
                    <span>CONTEÚDO</span>
                    <strong>{lessons.length} aulas</strong>
                  </div>
                  <button className="tinyAction" onClick={addWeek} title="Adicionar semana">
                    <FolderPlus size={16} />
                  </button>
                </div>

                {weeksWithLessons.map((week) => (
                  <div className="weekGroup" key={week.id}>
                    <div className="weekGroupHeader">
                      <strong>{week.title || `Semana ${week.week_number}`}</strong>
                      <button onClick={() => addLesson(week.id)} title="Adicionar aula">
                        <Plus size={15} />
                      </button>
                    </div>

                    <div className="adminLessonList">
                      {week.lessons.map((lesson) => (
                        <button
                          key={lesson.id}
                          className={lesson.id === selectedLessonId ? 'active' : ''}
                          onClick={() => chooseLesson(lesson.id)}
                        >
                          <span>{String(lesson.lesson_number).padStart(2, '0')}</span>
                          <strong>{lesson.title}</strong>
                          <ChevronRight size={14} />
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </aside>

              <div className="lessonEditorPane">
                {!selectedLesson ? (
                  <div className="emptyContentState compact">
                    <Pencil size={28} />
                    <h2>Selecione ou crie uma aula</h2>
                  </div>
                ) : (
                  <>
                    <div className="lessonEditorTop">
                      <div>
                        <span className="editorEyebrow">AULA {String(selectedLesson.lesson_number).padStart(2, '0')}</span>
                        <h2>Editar aula</h2>
                      </div>
                      <button className="dangerTextAction" onClick={deleteLesson} disabled={saving}>
                        <Trash2 size={15} /> Excluir aula
                      </button>
                    </div>

                    <div className="lessonFormGrid">
                      <label>
                        Título
                        <input value={lessonTitle} onChange={(event) => setLessonTitle(event.target.value)} />
                      </label>
                      <label className="fullField">
                        Orientação da aula
                        <textarea
                          value={lessonDescription}
                          onChange={(event) => setLessonDescription(event.target.value)}
                          placeholder="Ex.: execute em ritmo controlado, respeitando os intervalos."
                        />
                      </label>
                      <button className="outlineAction lessonSave" onClick={saveLesson} disabled={saving}>
                        <Save size={16} /> Salvar aula
                      </button>
                    </div>

                    <div className="exerciseSectionHeader">
                      <div>
                        <span className="editorEyebrow">EXERCÍCIOS</span>
                        <h2>{exercises.length} cadastrado(s)</h2>
                      </div>
                    </div>

                    <div className="exerciseAdminList">
                      {exercises.map((exercise, index) => (
                        <article className="exerciseAdminCard" key={exercise.id}>
                          <div className="exerciseOrderControls">
                            <span>{String(index + 1).padStart(2, '0')}</span>
                            <button onClick={() => moveExercise(index, -1)} disabled={index === 0} title="Subir">
                              <ArrowUp size={14} />
                            </button>
                            <button onClick={() => moveExercise(index, 1)} disabled={index === exercises.length - 1} title="Descer">
                              <ArrowDown size={14} />
                            </button>
                          </div>

                          <div className="exerciseAdminBody">
                            <div className="exerciseFieldsGrid">
                              <label className="fullField">
                                Nome do exercício
                                <input
                                  value={exercise.title}
                                  onChange={(event) => updateExerciseLocal(exercise.id, { title: event.target.value })}
                                />
                              </label>
                              <label>
                                Séries
                                <input
                                  value={exercise.sets ?? ''}
                                  onChange={(event) => updateExerciseLocal(exercise.id, { sets: event.target.value })}
                                />
                              </label>
                              <label>
                                Repetições / tempo
                                <input
                                  value={exercise.repetitions ?? ''}
                                  onChange={(event) => updateExerciseLocal(exercise.id, { repetitions: event.target.value })}
                                />
                              </label>
                              <label>
                                Descanso (segundos)
                                <input
                                  type="number"
                                  min="0"
                                  value={exercise.rest_seconds ?? ''}
                                  onChange={(event) =>
                                    updateExerciseLocal(exercise.id, {
                                      rest_seconds: event.target.value ? Number(event.target.value) : null,
                                    })
                                  }
                                />
                              </label>
                              <label className="fullField">
                                Instruções
                                <textarea
                                  value={exercise.instructions ?? ''}
                                  onChange={(event) => updateExerciseLocal(exercise.id, { instructions: event.target.value })}
                                  placeholder="Postura, execução, observações..."
                                />
                              </label>
                            </div>

                            <div className="videoAdminArea">
                              {videoPreviews[exercise.id] ? (
                                <video controls playsInline preload="metadata" src={videoPreviews[exercise.id]} />
                              ) : (
                                <div className="videoEmptyAdmin">
                                  <FileVideo size={24} />
                                  <span>Sem vídeo</span>
                                </div>
                              )}

                              <div className="videoAdminButtons">
                                <label className="uploadVideoButton">
                                  <Upload size={15} />
                                  {uploadingExerciseId === exercise.id ? 'Enviando...' : videoPreviews[exercise.id] ? 'Trocar vídeo' : 'Adicionar vídeo'}
                                  <input
                                    type="file"
                                    accept="video/mp4,video/quicktime,video/webm"
                                    disabled={uploadingExerciseId === exercise.id}
                                    onChange={(event) => uploadVideo(exercise, event)}
                                  />
                                </label>

                                {videoPreviews[exercise.id] && (
                                  <button className="removeVideoButton" onClick={() => removeVideo(exercise)}>
                                    <X size={14} /> Remover
                                  </button>
                                )}
                              </div>
                            </div>

                            <div className="exerciseAdminActions">
                              <button className="outlineAction" onClick={() => saveExercise(exercise)}>
                                <Save size={15} /> Salvar exercício
                              </button>
                              <button className="dangerTextAction" onClick={() => deleteExercise(exercise)}>
                                <Trash2 size={15} /> Excluir
                              </button>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>

                    <div className="newExerciseCard">
                      <div className="newExerciseHeading">
                        <Plus size={18} />
                        <div>
                          <strong>Novo exercício</strong>
                          <span>Depois de criar, você poderá enviar o vídeo.</span>
                        </div>
                      </div>

                      <div className="exerciseFieldsGrid">
                        <label className="fullField">
                          Nome do exercício
                          <input
                            value={newExerciseTitle}
                            onChange={(event) => setNewExerciseTitle(event.target.value)}
                            placeholder="Ex.: Agachamento livre"
                          />
                        </label>
                        <label>
                          Séries
                          <input value={newExerciseSets} onChange={(event) => setNewExerciseSets(event.target.value)} />
                        </label>
                        <label>
                          Repetições / tempo
                          <input
                            value={newExerciseRepetitions}
                            onChange={(event) => setNewExerciseRepetitions(event.target.value)}
                          />
                        </label>
                        <label>
                          Descanso (s)
                          <input
                            type="number"
                            min="0"
                            value={newExerciseRest}
                            onChange={(event) => setNewExerciseRest(event.target.value)}
                          />
                        </label>
                        <label className="fullField">
                          Instruções
                          <textarea
                            value={newExerciseInstructions}
                            onChange={(event) => setNewExerciseInstructions(event.target.value)}
                            placeholder="Orientações de execução"
                          />
                        </label>
                      </div>

                      <button className="solidAction addExerciseButton" onClick={addExercise}>
                        <Plus size={16} /> Adicionar exercício
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
