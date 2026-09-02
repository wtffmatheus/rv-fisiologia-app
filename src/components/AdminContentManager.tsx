import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react'
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
  video_ratio: '9:16' | '4:5' | '1:1' | '16:9'
  video_fit: 'cover' | 'contain'
  sets: string | null
  repetitions: string | null
  rest_seconds: number | null
  sort_order: number
}

type Feedback = {
  type: 'success' | 'error'
  text: string
} | null

type UploadStatus = {
  status: 'uploading' | 'success' | 'error'
  progress: number
  message: string
}

const MAX_VIDEO_BYTES = 500 * 1024 * 1024



function getVideoMeta(file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
  const allowedExtensions = ['mp4', 'mov', 'webm']
  const allowedMimeTypes = ['video/mp4', 'video/quicktime', 'video/webm']

  if (!allowedMimeTypes.includes(file.type) && !allowedExtensions.includes(extension)) {
    throw new Error(
      `Formato não aceito (${file.type || extension || 'desconhecido'}). Use MP4, MOV ou WebM.`,
    )
  }

  if (file.size > MAX_VIDEO_BYTES) {
    throw new Error(
      `O vídeo tem ${(file.size / 1024 / 1024).toFixed(1)} MB. O limite atual é 500 MB.`,
    )
  }

  const fallbackMime =
    extension === 'mov'
      ? 'video/quicktime'
      : extension === 'webm'
        ? 'video/webm'
        : 'video/mp4'

  return {
    extension,
    contentType: file.type || fallbackMime,
  }
}

async function invokeR2(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('r2-video', { body })

  if (error) {
    console.error('r2-video invoke error:', error)
    throw new Error(error.message || 'Falha ao acessar o serviço de vídeos.')
  }

  if (data?.error) {
    throw new Error(String(data.error))
  }

  return data
}


async function uploadFileViaEdgeMultipart(params: {
  exerciseId: number
  programId: number
  lessonId: number
  file: File
  contentType: string
  oldKey?: string | null
  onProgress?: (percentage: number) => void
}) {
  const {
    exerciseId,
    programId,
    lessonId,
    file,
    contentType,
    oldKey,
    onProgress,
  } = params

  const started = await invokeR2({
    action: 'multipart_start',
    exercise_id: exerciseId,
    program_id: programId,
    lesson_id: lessonId,
    file_name: file.name,
    content_type: contentType,
  })

  const uploadId = String(started?.upload_id || '')
  const key = String(started?.key || '')
  const partSize = Number(started?.part_size || 6 * 1024 * 1024)

  if (!uploadId || !key || !partSize) {
    throw new Error('O serviço de vídeos não iniciou o upload corretamente.')
  }

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.access_token) {
    await invokeR2({ action: 'multipart_abort', upload_id: uploadId, key }).catch(() => null)
    throw new Error('Sua sessão expirou. Entre novamente no painel.')
  }

  const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '')
  const publishableKey = String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '')

  if (!supabaseUrl || !publishableKey) {
    await invokeR2({ action: 'multipart_abort', upload_id: uploadId, key }).catch(() => null)
    throw new Error('Configuração pública do Supabase não encontrada no build.')
  }

  const functionUrl = `${supabaseUrl}/functions/v1/r2-video`
  const parts: Array<{ etag: string; part_number: number }> = []

  try {
    const totalParts = Math.ceil(file.size / partSize)

    for (let index = 0; index < totalParts; index += 1) {
      const partNumber = index + 1
      const start = index * partSize
      const end = Math.min(start + partSize, file.size)
      const chunk = file.slice(start, end)

      const query = new URLSearchParams({
        action: 'multipart_part',
        upload_id: uploadId,
        key,
        part_number: String(partNumber),
      })

      const response = await fetch(`${functionUrl}?${query.toString()}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: publishableKey,
          'Content-Type': 'application/octet-stream',
        },
        body: chunk,
      })

      const raw = await response.text()
      let payload: any = null

      try {
        payload = raw ? JSON.parse(raw) : null
      } catch {
        payload = null
      }

      if (!response.ok) {
        throw new Error(
          payload?.error ||
            `Falha ao enviar a parte ${partNumber} de ${totalParts} do vídeo.`,
        )
      }

      const etag = String(payload?.etag || '')
      if (!etag) {
        throw new Error(`O R2 não confirmou a parte ${partNumber} do vídeo.`)
      }

      parts.push({ etag, part_number: partNumber })
      onProgress?.(Math.round((partNumber / totalParts) * 100))
    }

    const completed = await invokeR2({
      action: 'multipart_complete',
      upload_id: uploadId,
      key,
      exercise_id: exerciseId,
      old_key: oldKey || null,
      parts,
    })

    if (!completed?.ok) {
      throw new Error('O serviço não confirmou a conclusão do upload.')
    }

    return key
  } catch (error) {
    await invokeR2({
      action: 'multipart_abort',
      upload_id: uploadId,
      key,
    }).catch(() => null)

    throw error
  }
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
  const [newExerciseVideoRatio, setNewExerciseVideoRatio] = useState<'9:16' | '4:5' | '1:1' | '16:9'>('9:16')
  const [newExerciseVideoFit, setNewExerciseVideoFit] = useState<'cover' | 'contain'>('cover')
  const [newExerciseVideo, setNewExerciseVideo] = useState<File | null>(null)
  const newExerciseVideoInputRef = useRef<HTMLInputElement | null>(null)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingExerciseId, setUploadingExerciseId] = useState<number | null>(null)
  const [feedback, setFeedback] = useState<Feedback>(null)
  const [uploadStatusByExercise, setUploadStatusByExercise] = useState<Record<number, UploadStatus>>({})
  const [newExerciseUploadStatus, setNewExerciseUploadStatus] = useState<UploadStatus | null>(null)

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
      .select('id,lesson_id,title,instructions,video_url,video_path,video_ratio,video_fit,sets,repetitions,rest_seconds,sort_order')
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
          try {
            const data = await invokeR2({
              action: 'play',
              exercise_id: exercise.id,
            })
            return [exercise.id, data?.url ?? ''] as const
          } catch (error) {
            console.warn(`Não foi possível gerar preview do exercício ${exercise.id}`, error)
            return [exercise.id, ''] as const
          }
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
      await Promise.all(
        paths.map((key) =>
          invokeR2({ action: 'delete', key }).catch((error) =>
            console.warn('Não foi possível remover vídeo antigo do R2:', error),
          ),
        ),
      )
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
    if (!selectedProgramId || !selectedLessonId || !newExerciseTitle.trim()) {
      setFeedback({ type: 'error', text: 'Digite o nome do exercício.' })
      return
    }

    let videoMeta: ReturnType<typeof getVideoMeta> | null = null

    if (newExerciseVideo) {
      try {
        videoMeta = getVideoMeta(newExerciseVideo)
      } catch (error) {
        setFeedback({
          type: 'error',
          text: error instanceof Error ? error.message : 'Vídeo inválido.',
        })
        return
      }
    }

    const nextSort = Math.max(0, ...exercises.map((exercise) => exercise.sort_order)) + 1
    const rest = Number(newExerciseRest)

    setSaving(true)
    setFeedback(null)

    const { data, error } = await supabase
      .from('exercises')
      .insert({
        lesson_id: selectedLessonId,
        title: newExerciseTitle.trim(),
        instructions: newExerciseInstructions.trim() || null,
        sets: newExerciseSets.trim() || null,
        repetitions: newExerciseRepetitions.trim() || null,
        rest_seconds: Number.isFinite(rest) ? rest : null,
        video_ratio: newExerciseVideoRatio,
        video_fit: newExerciseVideoFit,
        sort_order: nextSort,
      })
      .select('id,title,lesson_id,video_path')
      .single()

    if (error || !data) {
      setFeedback({
        type: 'error',
        text: `Erro ao adicionar exercício: ${error?.message ?? 'erro desconhecido'}`,
      })
      setSaving(false)
      return
    }

    let videoUploaded = false
    let videoErrorMessage = ''

    if (newExerciseVideo && videoMeta) {
      setUploadingExerciseId(data.id)
      setNewExerciseUploadStatus({
        status: 'uploading',
        progress: 0,
        message: `Preparando "${newExerciseVideo.name}"...`,
      })
      setFeedback({
        type: 'success',
        text: `Exercício criado. Enviando "${newExerciseVideo.name}" para o Cloudflare R2...`,
      })

      try {
        await uploadFileViaEdgeMultipart({
          exerciseId: data.id,
          programId: selectedProgramId,
          lessonId: selectedLessonId,
          file: newExerciseVideo,
          contentType: videoMeta.contentType,
          onProgress: (percentage) => {
            setNewExerciseUploadStatus({
              status: 'uploading',
              progress: percentage,
              message: `Enviando "${newExerciseVideo.name}"... ${percentage}%`,
            })
            setFeedback({
              type: 'success',
              text: `Enviando "${newExerciseVideo.name}"... ${percentage}%`,
            })
          },
        })

        videoUploaded = true
      } catch (error) {
        console.error('RV R2 new exercise upload error:', error)
        videoErrorMessage =
          error instanceof Error ? error.message : 'Erro inesperado ao enviar o vídeo.'

        setNewExerciseUploadStatus({
          status: 'error',
          progress: 0,
          message: videoErrorMessage,
        })
      } finally {
        setUploadingExerciseId(null)
      }
    }

    setNewExerciseTitle('')
    setNewExerciseInstructions('')
    setNewExerciseSets('3')
    setNewExerciseRepetitions('12')
    setNewExerciseRest('45')
    setNewExerciseVideoRatio('9:16')
    setNewExerciseVideoFit('cover')
    setNewExerciseVideo(null)

    if (newExerciseVideoInputRef.current) {
      newExerciseVideoInputRef.current.value = ''
    }

    if (videoErrorMessage) {
      setNewExerciseUploadStatus({
        status: 'error',
        progress: 0,
        message: `Exercício criado, mas o vídeo falhou: ${videoErrorMessage}`,
      })
      setFeedback({
        type: 'error',
        text: `Exercício criado, mas o vídeo não foi enviado: ${videoErrorMessage}`,
      })
    } else if (videoUploaded) {
      setNewExerciseUploadStatus({
        status: 'success',
        progress: 100,
        message: 'Vídeo upado com sucesso.',
      })
      setFeedback({
        type: 'success',
        text: 'Exercício e vídeo adicionados com sucesso.',
      })
    } else {
      setFeedback({ type: 'success', text: 'Exercício adicionado.' })
    }

    setSaving(false)
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
        video_ratio: exercise.video_ratio,
        video_fit: exercise.video_fit,
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
      await invokeR2({ action: 'delete', key: exercise.video_path }).catch((error) =>
        console.warn('Não foi possível remover vídeo do R2:', error),
      )
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
    const input = event.currentTarget
    const file = input.files?.[0]

    if (!file) {
      setFeedback({ type: 'error', text: 'Nenhum arquivo foi selecionado.' })
      return
    }

    if (!selectedProgramId || !selectedLessonId) {
      setFeedback({ type: 'error', text: 'Abra uma metodologia e uma aula antes de enviar o vídeo.' })
      input.value = ''
      return
    }

    let contentType = ''

    try {
      contentType = getVideoMeta(file).contentType
    } catch (error) {
      setFeedback({
        type: 'error',
        text: error instanceof Error ? error.message : 'Vídeo inválido.',
      })
      input.value = ''
      return
    }

    setUploadingExerciseId(exercise.id)
    setUploadStatusByExercise((current) => ({
      ...current,
      [exercise.id]: {
        status: 'uploading',
        progress: 0,
        message: `Preparando "${file.name}"...`,
      },
    }))
    setFeedback({
      type: 'success',
      text: `Preparando upload de "${file.name}" para o Cloudflare R2...`,
    })

    try {
      await uploadFileViaEdgeMultipart({
        exerciseId: exercise.id,
        programId: selectedProgramId,
        lessonId: selectedLessonId,
        file,
        contentType,
        oldKey: exercise.video_path,
        onProgress: (percentage) => {
          setUploadStatusByExercise((current) => ({
            ...current,
            [exercise.id]: {
              status: 'uploading',
              progress: percentage,
              message: `Enviando "${file.name}"... ${percentage}%`,
            },
          }))
          setFeedback({
            type: 'success',
            text: `Enviando "${file.name}"... ${percentage}%`,
          })
        },
      })

      setUploadStatusByExercise((current) => ({
        ...current,
        [exercise.id]: {
          status: 'success',
          progress: 100,
          message: 'Vídeo upado com sucesso.',
        },
      }))
      setFeedback({
        type: 'success',
        text: `Vídeo "${file.name}" upado com sucesso no exercício "${exercise.title}".`,
      })

      await loadExercises(selectedLessonId)
    } catch (error) {
      console.error('RV R2 upload error:', error)
      const errorMessage =
        error instanceof Error ? error.message : 'Erro inesperado ao enviar o vídeo.'

      setUploadStatusByExercise((current) => ({
        ...current,
        [exercise.id]: {
          status: 'error',
          progress: 0,
          message: errorMessage,
        },
      }))
      setFeedback({
        type: 'error',
        text: errorMessage,
      })
    } finally {
      setUploadingExerciseId(null)
      input.value = ''
    }
  }

  async function removeVideo(exercise: Exercise) {
    const accepted = window.confirm(`Remover o vídeo de "${exercise.title}"?`)
    if (!accepted) return

    if (exercise.video_path) {
      await invokeR2({ action: 'delete', key: exercise.video_path }).catch((error) =>
        console.warn('Não foi possível remover vídeo do R2:', error),
      )
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
                              <label>
                                Formato do vídeo
                                <select
                                  value={exercise.video_ratio || '9:16'}
                                  onChange={(event) =>
                                    updateExerciseLocal(exercise.id, {
                                      video_ratio: event.target.value as Exercise['video_ratio'],
                                    })
                                  }
                                >
                                  <option value="9:16">9:16 · Vertical</option>
                                  <option value="4:5">4:5 · Retrato</option>
                                  <option value="1:1">1:1 · Quadrado</option>
                                  <option value="16:9">16:9 · Horizontal</option>
                                </select>
                              </label>
                              <label>
                                Ajuste do vídeo
                                <select
                                  value={exercise.video_fit || 'cover'}
                                  onChange={(event) =>
                                    updateExerciseLocal(exercise.id, {
                                      video_fit: event.target.value as Exercise['video_fit'],
                                    })
                                  }
                                >
                                  <option value="cover">Preencher · sem bordas</option>
                                  <option value="contain">Mostrar inteiro</option>
                                </select>
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
                                <video
                                  className={`adminExerciseVideoPreview ratio-${(exercise.video_ratio || '9:16').replace(':', '')} fit-${exercise.video_fit || 'cover'}`}
                                  controls
                                  playsInline
                                  preload="metadata"
                                  src={videoPreviews[exercise.id]}
                                />
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
                                    accept=".mp4,.mov,.webm,video/mp4,video/quicktime,video/webm"
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

                              {uploadStatusByExercise[exercise.id] && (
                                <div
                                  className={`videoUploadStatus ${uploadStatusByExercise[exercise.id].status}`}
                                  role={uploadStatusByExercise[exercise.id].status === 'error' ? 'alert' : 'status'}
                                >
                                  <div className="videoUploadStatusTop">
                                    <strong>
                                      {uploadStatusByExercise[exercise.id].status === 'uploading'
                                        ? 'Upload em andamento'
                                        : uploadStatusByExercise[exercise.id].status === 'success'
                                          ? 'Vídeo upado com sucesso'
                                          : 'Erro no upload'}
                                    </strong>
                                    <span>
                                      {uploadStatusByExercise[exercise.id].status === 'uploading'
                                        ? `${uploadStatusByExercise[exercise.id].progress}%`
                                        : uploadStatusByExercise[exercise.id].status === 'success'
                                          ? '100%'
                                          : 'Falhou'}
                                    </span>
                                  </div>

                                  {uploadStatusByExercise[exercise.id].status !== 'error' && (
                                    <div className="videoUploadProgressTrack">
                                      <span
                                        style={{
                                          width: `${uploadStatusByExercise[exercise.id].progress}%`,
                                        }}
                                      />
                                    </div>
                                  )}

                                  <p>{uploadStatusByExercise[exercise.id].message}</p>
                                </div>
                              )}
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
                          <span>Configure o exercício, o formato e o vídeo antes de adicionar.</span>
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
                        <label>
                          Formato do vídeo
                          <select
                            value={newExerciseVideoRatio}
                            onChange={(event) =>
                              setNewExerciseVideoRatio(
                                event.target.value as '9:16' | '4:5' | '1:1' | '16:9',
                              )
                            }
                          >
                            <option value="9:16">9:16 · Vertical</option>
                            <option value="4:5">4:5 · Retrato</option>
                            <option value="1:1">1:1 · Quadrado</option>
                            <option value="16:9">16:9 · Horizontal</option>
                          </select>
                        </label>
                        <label>
                          Ajuste do vídeo
                          <select
                            value={newExerciseVideoFit}
                            onChange={(event) =>
                              setNewExerciseVideoFit(event.target.value as 'cover' | 'contain')
                            }
                          >
                            <option value="cover">Preencher · sem bordas</option>
                            <option value="contain">Mostrar inteiro</option>
                          </select>
                        </label>
                        <label className="fullField">
                          Instruções
                          <textarea
                            value={newExerciseInstructions}
                            onChange={(event) => setNewExerciseInstructions(event.target.value)}
                            placeholder="Orientações de execução"
                          />
                        </label>

                        <div className="newExerciseVideoField fullField">
                          <div className="newExerciseVideoLabel">
                            <span>Vídeo do exercício</span>
                            <small>Opcional · MP4, MOV ou WebM · até 500 MB</small>
                          </div>

                          <label className="uploadVideoButton newExerciseUploadButton">
                            <Upload size={16} />
                            {newExerciseVideo ? 'Trocar vídeo selecionado' : 'Selecionar vídeo'}
                            <input
                              ref={newExerciseVideoInputRef}
                              type="file"
                              accept=".mp4,.mov,.webm,video/mp4,video/quicktime,video/webm"
                              onChange={(event) => {
                                const file = event.currentTarget.files?.[0] ?? null

                                if (!file) {
                                  setNewExerciseVideo(null)
                                  return
                                }

                                try {
                                  getVideoMeta(file)
                                  setNewExerciseVideo(file)
                                  setFeedback(null)
                                } catch (error) {
                                  setNewExerciseVideo(null)
                                  event.currentTarget.value = ''
                                  setFeedback({
                                    type: 'error',
                                    text:
                                      error instanceof Error
                                        ? error.message
                                        : 'Vídeo inválido.',
                                  })
                                }
                              }}
                            />
                          </label>

                          {newExerciseVideo && (
                            <div className="newExerciseVideoSelected">
                              <FileVideo size={18} />
                              <div>
                                <strong>{newExerciseVideo.name}</strong>
                                <span>
                                  {(newExerciseVideo.size / 1024 / 1024).toFixed(1)} MB
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setNewExerciseVideo(null)
                                  if (newExerciseVideoInputRef.current) {
                                    newExerciseVideoInputRef.current.value = ''
                                  }
                                }}
                                aria-label="Remover vídeo selecionado"
                                title="Remover vídeo selecionado"
                              >
                                <X size={15} />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {newExerciseUploadStatus && (
                        <div
                          className={`videoUploadStatus ${newExerciseUploadStatus.status} newExerciseUploadStatus`}
                          role={newExerciseUploadStatus.status === 'error' ? 'alert' : 'status'}
                        >
                          <div className="videoUploadStatusTop">
                            <strong>
                              {newExerciseUploadStatus.status === 'uploading'
                                ? 'Upload em andamento'
                                : newExerciseUploadStatus.status === 'success'
                                  ? 'Vídeo upado com sucesso'
                                  : 'Erro no upload'}
                            </strong>
                            <span>
                              {newExerciseUploadStatus.status === 'uploading'
                                ? `${newExerciseUploadStatus.progress}%`
                                : newExerciseUploadStatus.status === 'success'
                                  ? '100%'
                                  : 'Falhou'}
                            </span>
                          </div>

                          {newExerciseUploadStatus.status !== 'error' && (
                            <div className="videoUploadProgressTrack">
                              <span style={{ width: `${newExerciseUploadStatus.progress}%` }} />
                            </div>
                          )}

                          <p>{newExerciseUploadStatus.message}</p>
                        </div>
                      )}

                      <button className="solidAction addExerciseButton" onClick={addExercise} disabled={saving || uploadingExerciseId !== null}>
                        <Plus size={16} /> {saving ? 'Adicionando...' : newExerciseVideo ? 'Adicionar exercício + vídeo' : 'Adicionar exercício'}
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
