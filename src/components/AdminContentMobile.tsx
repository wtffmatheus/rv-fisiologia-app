import {
  BookOpen,
  Check,
  ChevronDown,
  FileVideo,
  FolderPlus,
  Pencil,
  Play,
  Plus,
  Save,
  Trash2,
  Upload,
  Video,
  X,
} from 'lucide-react'
import {
  ChangeEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { supabase } from '../lib/supabase'
import { useI18n } from '../i18n'
import {
  RvEmptyState,
  RvLoadingState,
} from './PlatformState'

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

type UploadState = {
  id: number | 'new'
  progress: number
  message: string
} | null

const MAX_VIDEO_BYTES =
  500 * 1024 * 1024

const copy = {
  'pt-BR': {
    eyebrow: 'EDITOR SIMPLES',
    title: 'Monte o conteúdo em poucos passos',
    subtitle: 'Escolha a metodologia, semana e aula. Depois adicione os exercícios e vídeos.',
    methodology: '1. Metodologia',
    week: '2. Semana',
    lesson: '3. Aula',
    exercises: '4. Exercícios e vídeos',
    chooseMethodology: 'Escolha uma metodologia',
    chooseWeek: 'Escolha uma semana',
    chooseLesson: 'Escolha uma aula',
    newMethodology: 'Nova metodologia',
    methodologyName: 'Nome da metodologia',
    optionalDescription: 'Descrição opcional',
    createMethodology: 'Criar metodologia',
    newWeek: 'Adicionar semana',
    newLesson: 'Adicionar aula',
    lessonTitle: 'Título da aula',
    lessonDescription: 'Orientação da aula',
    saveLesson: 'Salvar aula',
    noMethodology: 'Crie ou selecione uma metodologia para continuar.',
    noWeek: 'Adicione uma semana para começar a organizar as aulas.',
    noLesson: 'Adicione uma aula para começar.',
    addedExercises: 'Exercícios cadastrados',
    noExercises: 'Nenhum exercício ainda',
    noExercisesHelp: 'Toque em “Adicionar exercício” e preencha só o necessário.',
    addExercise: 'Adicionar exercício',
    exerciseName: 'Nome do exercício',
    sets: 'Séries',
    reps: 'Repetições / tempo',
    rest: 'Descanso (s)',
    instructions: 'Instruções',
    video: 'Vídeo',
    videoOptional: 'Opcional · MP4, MOV ou WebM · até 500 MB',
    selectVideo: 'Selecionar vídeo',
    changeVideo: 'Trocar vídeo',
    videoReady: 'Vídeo adicionado',
    noVideo: 'Sem vídeo',
    videoOptions: 'Opções do vídeo',
    ratio: 'Formato',
    fit: 'Enquadramento',
    fill: 'Preencher sem bordas',
    full: 'Mostrar inteiro',
    add: 'Adicionar',
    saving: 'Salvando...',
    uploading: 'Enviando vídeo...',
    saveExercise: 'Salvar alterações',
    preview: 'Ver vídeo',
    closePreview: 'Fechar vídeo',
    deleteExercise: 'Excluir exercício',
    advanced: 'Opções avançadas',
    deleteLesson: 'Excluir esta aula',
    confirmDeleteExercise: 'Excluir este exercício?',
    confirmDeleteLesson: 'Excluir esta aula e todos os exercícios dela?',
    saved: 'Alterações salvas.',
    created: 'Criado com sucesso.',
    error: 'Não foi possível concluir esta ação agora.',
    videoError: 'Não foi possível enviar o vídeo.',
    empty: 'Nada cadastrado ainda.',
    stepHelp: 'Você pode voltar e trocar qualquer opção acima quando quiser.',
    current: 'Atual',
    active: 'Ativa',
    inactive: 'Inativa',
  },
  en: {
    eyebrow: 'SIMPLE EDITOR',
    title: 'Build content in a few steps',
    subtitle: 'Choose the methodology, week and lesson. Then add exercises and videos.',
    methodology: '1. Methodology',
    week: '2. Week',
    lesson: '3. Lesson',
    exercises: '4. Exercises and videos',
    chooseMethodology: 'Choose a methodology',
    chooseWeek: 'Choose a week',
    chooseLesson: 'Choose a lesson',
    newMethodology: 'New methodology',
    methodologyName: 'Methodology name',
    optionalDescription: 'Optional description',
    createMethodology: 'Create methodology',
    newWeek: 'Add week',
    newLesson: 'Add lesson',
    lessonTitle: 'Lesson title',
    lessonDescription: 'Lesson guidance',
    saveLesson: 'Save lesson',
    noMethodology: 'Create or select a methodology to continue.',
    noWeek: 'Add a week to start organizing lessons.',
    noLesson: 'Add a lesson to get started.',
    addedExercises: 'Registered exercises',
    noExercises: 'No exercises yet',
    noExercisesHelp: 'Tap “Add exercise” and fill only what is needed.',
    addExercise: 'Add exercise',
    exerciseName: 'Exercise name',
    sets: 'Sets',
    reps: 'Repetitions / time',
    rest: 'Rest (s)',
    instructions: 'Instructions',
    video: 'Video',
    videoOptional: 'Optional · MP4, MOV or WebM · up to 500 MB',
    selectVideo: 'Select video',
    changeVideo: 'Change video',
    videoReady: 'Video added',
    noVideo: 'No video',
    videoOptions: 'Video options',
    ratio: 'Format',
    fit: 'Framing',
    fill: 'Fill without borders',
    full: 'Show full video',
    add: 'Add',
    saving: 'Saving...',
    uploading: 'Uploading video...',
    saveExercise: 'Save changes',
    preview: 'View video',
    closePreview: 'Close video',
    deleteExercise: 'Delete exercise',
    advanced: 'Advanced options',
    deleteLesson: 'Delete this lesson',
    confirmDeleteExercise: 'Delete this exercise?',
    confirmDeleteLesson: 'Delete this lesson and all its exercises?',
    saved: 'Changes saved.',
    created: 'Created successfully.',
    error: 'Could not complete this action right now.',
    videoError: 'Could not upload the video.',
    empty: 'Nothing registered yet.',
    stepHelp: 'You can go back and change any option above at any time.',
    current: 'Current',
    active: 'Active',
    inactive: 'Inactive',
  },
  es: {
    eyebrow: 'EDITOR SIMPLE',
    title: 'Monta el contenido en pocos pasos',
    subtitle: 'Elige metodología, semana y clase. Luego agrega ejercicios y videos.',
    methodology: '1. Metodología',
    week: '2. Semana',
    lesson: '3. Clase',
    exercises: '4. Ejercicios y videos',
    chooseMethodology: 'Elige una metodología',
    chooseWeek: 'Elige una semana',
    chooseLesson: 'Elige una clase',
    newMethodology: 'Nueva metodología',
    methodologyName: 'Nombre de la metodología',
    optionalDescription: 'Descripción opcional',
    createMethodology: 'Crear metodología',
    newWeek: 'Agregar semana',
    newLesson: 'Agregar clase',
    lessonTitle: 'Título de la clase',
    lessonDescription: 'Orientación de la clase',
    saveLesson: 'Guardar clase',
    noMethodology: 'Crea o selecciona una metodología para continuar.',
    noWeek: 'Agrega una semana para organizar las clases.',
    noLesson: 'Agrega una clase para comenzar.',
    addedExercises: 'Ejercicios registrados',
    noExercises: 'Aún no hay ejercicios',
    noExercisesHelp: 'Toca “Agregar ejercicio” y completa solo lo necesario.',
    addExercise: 'Agregar ejercicio',
    exerciseName: 'Nombre del ejercicio',
    sets: 'Series',
    reps: 'Repeticiones / tiempo',
    rest: 'Descanso (s)',
    instructions: 'Instrucciones',
    video: 'Video',
    videoOptional: 'Opcional · MP4, MOV o WebM · hasta 500 MB',
    selectVideo: 'Seleccionar video',
    changeVideo: 'Cambiar video',
    videoReady: 'Video agregado',
    noVideo: 'Sin video',
    videoOptions: 'Opciones del video',
    ratio: 'Formato',
    fit: 'Encuadre',
    fill: 'Rellenar sin bordes',
    full: 'Mostrar completo',
    add: 'Agregar',
    saving: 'Guardando...',
    uploading: 'Subiendo video...',
    saveExercise: 'Guardar cambios',
    preview: 'Ver video',
    closePreview: 'Cerrar video',
    deleteExercise: 'Eliminar ejercicio',
    advanced: 'Opciones avanzadas',
    deleteLesson: 'Eliminar esta clase',
    confirmDeleteExercise: '¿Eliminar este ejercicio?',
    confirmDeleteLesson: '¿Eliminar esta clase y todos sus ejercicios?',
    saved: 'Cambios guardados.',
    created: 'Creado correctamente.',
    error: 'No se pudo completar esta acción.',
    videoError: 'No se pudo subir el video.',
    empty: 'Aún no hay contenido.',
    stepHelp: 'Puedes volver y cambiar cualquier opción cuando quieras.',
    current: 'Actual',
    active: 'Activa',
    inactive: 'Inactiva',
  },
  'zh-CN': {
    eyebrow: '简易编辑器',
    title: '几步完成课程内容',
    subtitle: '选择训练方案、周次和课程，然后添加练习与视频。',
    methodology: '1. 训练方案',
    week: '2. 周次',
    lesson: '3. 课程',
    exercises: '4. 练习与视频',
    chooseMethodology: '选择训练方案',
    chooseWeek: '选择周次',
    chooseLesson: '选择课程',
    newMethodology: '新建训练方案',
    methodologyName: '训练方案名称',
    optionalDescription: '可选描述',
    createMethodology: '创建训练方案',
    newWeek: '添加周次',
    newLesson: '添加课程',
    lessonTitle: '课程标题',
    lessonDescription: '课程说明',
    saveLesson: '保存课程',
    noMethodology: '请先创建或选择训练方案。',
    noWeek: '添加周次后即可开始组织课程。',
    noLesson: '添加课程后即可开始。',
    addedExercises: '已添加练习',
    noExercises: '暂无练习',
    noExercisesHelp: '点击“添加练习”，只填写必要信息。',
    addExercise: '添加练习',
    exerciseName: '练习名称',
    sets: '组数',
    reps: '次数 / 时间',
    rest: '休息（秒）',
    instructions: '说明',
    video: '视频',
    videoOptional: '可选 · MP4、MOV 或 WebM · 最大 500 MB',
    selectVideo: '选择视频',
    changeVideo: '更换视频',
    videoReady: '已添加视频',
    noVideo: '无视频',
    videoOptions: '视频选项',
    ratio: '格式',
    fit: '画面适配',
    fill: '填充无边框',
    full: '完整显示',
    add: '添加',
    saving: '保存中...',
    uploading: '视频上传中...',
    saveExercise: '保存修改',
    preview: '查看视频',
    closePreview: '关闭视频',
    deleteExercise: '删除练习',
    advanced: '高级选项',
    deleteLesson: '删除此课程',
    confirmDeleteExercise: '删除此练习？',
    confirmDeleteLesson: '删除此课程及其中所有练习？',
    saved: '已保存修改。',
    created: '创建成功。',
    error: '暂时无法完成此操作。',
    videoError: '视频上传失败。',
    empty: '暂无内容。',
    stepHelp: '你可以随时返回并修改上面的选择。',
    current: '当前',
    active: '启用',
    inactive: '未启用',
  },
  de: {
    eyebrow: 'EINFACHER EDITOR',
    title: 'Inhalte in wenigen Schritten erstellen',
    subtitle: 'Methode, Woche und Lektion auswählen. Danach Übungen und Videos hinzufügen.',
    methodology: '1. Methode',
    week: '2. Woche',
    lesson: '3. Lektion',
    exercises: '4. Übungen und Videos',
    chooseMethodology: 'Methode auswählen',
    chooseWeek: 'Woche auswählen',
    chooseLesson: 'Lektion auswählen',
    newMethodology: 'Neue Methode',
    methodologyName: 'Methodenname',
    optionalDescription: 'Optionale Beschreibung',
    createMethodology: 'Methode erstellen',
    newWeek: 'Woche hinzufügen',
    newLesson: 'Lektion hinzufügen',
    lessonTitle: 'Lektionstitel',
    lessonDescription: 'Lektionshinweise',
    saveLesson: 'Lektion speichern',
    noMethodology: 'Erstelle oder wähle eine Methode aus.',
    noWeek: 'Füge eine Woche hinzu, um Lektionen zu organisieren.',
    noLesson: 'Füge eine Lektion hinzu.',
    addedExercises: 'Gespeicherte Übungen',
    noExercises: 'Noch keine Übungen',
    noExercisesHelp: 'Tippe auf „Übung hinzufügen“ und fülle nur das Nötige aus.',
    addExercise: 'Übung hinzufügen',
    exerciseName: 'Übungsname',
    sets: 'Sätze',
    reps: 'Wiederholungen / Zeit',
    rest: 'Pause (s)',
    instructions: 'Anweisungen',
    video: 'Video',
    videoOptional: 'Optional · MP4, MOV oder WebM · bis 500 MB',
    selectVideo: 'Video auswählen',
    changeVideo: 'Video wechseln',
    videoReady: 'Video hinzugefügt',
    noVideo: 'Kein Video',
    videoOptions: 'Videooptionen',
    ratio: 'Format',
    fit: 'Darstellung',
    fill: 'Ohne Ränder ausfüllen',
    full: 'Ganzes Video anzeigen',
    add: 'Hinzufügen',
    saving: 'Wird gespeichert...',
    uploading: 'Video wird hochgeladen...',
    saveExercise: 'Änderungen speichern',
    preview: 'Video ansehen',
    closePreview: 'Video schließen',
    deleteExercise: 'Übung löschen',
    advanced: 'Erweiterte Optionen',
    deleteLesson: 'Diese Lektion löschen',
    confirmDeleteExercise: 'Diese Übung löschen?',
    confirmDeleteLesson: 'Diese Lektion und alle Übungen löschen?',
    saved: 'Änderungen gespeichert.',
    created: 'Erfolgreich erstellt.',
    error: 'Diese Aktion konnte nicht abgeschlossen werden.',
    videoError: 'Video konnte nicht hochgeladen werden.',
    empty: 'Noch nichts vorhanden.',
    stepHelp: 'Du kannst die Auswahl oben jederzeit ändern.',
    current: 'Aktuell',
    active: 'Aktiv',
    inactive: 'Inaktiv',
  },
} as const

function getVideoMeta(file: File) {
  const extension =
    file.name.split('.').pop()?.toLowerCase() ?? ''

  const allowedExtensions = [
    'mp4',
    'mov',
    'webm',
  ]

  const allowedMimeTypes = [
    'video/mp4',
    'video/quicktime',
    'video/webm',
  ]

  if (
    !allowedMimeTypes.includes(file.type) &&
    !allowedExtensions.includes(extension)
  ) {
    throw new Error('invalid_video_format')
  }

  if (file.size > MAX_VIDEO_BYTES) {
    throw new Error('video_too_large')
  }

  const fallbackMime =
    extension === 'mov'
      ? 'video/quicktime'
      : extension === 'webm'
        ? 'video/webm'
        : 'video/mp4'

  return {
    contentType:
      file.type || fallbackMime,
  }
}

async function invokeR2(
  body: Record<string, unknown>,
) {
  const { data, error } =
    await supabase.functions.invoke(
      'r2-video',
      { body },
    )

  if (error) throw error

  if (data?.error) {
    throw new Error(String(data.error))
  }

  return data
}

async function uploadMultipart({
  exerciseId,
  programId,
  lessonId,
  file,
  oldKey,
  onProgress,
}: {
  exerciseId: number
  programId: number
  lessonId: number
  file: File
  oldKey?: string | null
  onProgress: (value: number) => void
}) {
  const { contentType } =
    getVideoMeta(file)

  const started = await invokeR2({
    action: 'multipart_start',
    exercise_id: exerciseId,
    program_id: programId,
    lesson_id: lessonId,
    file_name: file.name,
    content_type: contentType,
  })

  const uploadId =
    String(started?.upload_id || '')

  const key =
    String(started?.key || '')

  const partSize =
    Number(
      started?.part_size ||
        6 * 1024 * 1024,
    )

  if (!uploadId || !key || !partSize) {
    throw new Error('upload_not_started')
  }

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.access_token) {
    await invokeR2({
      action: 'multipart_abort',
      upload_id: uploadId,
      key,
    }).catch(() => null)

    throw new Error('session_expired')
  }

  const supabaseUrl = String(
    import.meta.env.VITE_SUPABASE_URL || '',
  ).replace(/\/$/, '')

  const publishableKey = String(
    import.meta.env
      .VITE_SUPABASE_PUBLISHABLE_KEY || '',
  )

  if (!supabaseUrl || !publishableKey) {
    throw new Error('missing_public_config')
  }

  const functionUrl =
    `${supabaseUrl}/functions/v1/r2-video`

  const parts: Array<{
    etag: string
    part_number: number
  }> = []

  try {
    const totalParts =
      Math.ceil(file.size / partSize)

    for (
      let index = 0;
      index < totalParts;
      index += 1
    ) {
      const partNumber = index + 1
      const start = index * partSize
      const end = Math.min(
        start + partSize,
        file.size,
      )

      const query =
        new URLSearchParams({
          action: 'multipart_part',
          upload_id: uploadId,
          key,
          part_number: String(partNumber),
        })

      const response = await fetch(
        `${functionUrl}?${query.toString()}`,
        {
          method: 'POST',
          headers: {
            Authorization:
              `Bearer ${session.access_token}`,
            apikey: publishableKey,
            'Content-Type':
              'application/octet-stream',
          },
          body: file.slice(start, end),
        },
      )

      const raw = await response.text()

      let payload: {
        etag?: string
        error?: string
      } | null = null

      try {
        payload = raw
          ? JSON.parse(raw)
          : null
      } catch {
        payload = null
      }

      if (!response.ok) {
        throw new Error(
          payload?.error ||
            'multipart_part_failed',
        )
      }

      const etag =
        String(payload?.etag || '')

      if (!etag) {
        throw new Error('missing_etag')
      }

      parts.push({
        etag,
        part_number: partNumber,
      })

      onProgress(
        Math.round(
          (partNumber / totalParts) * 100,
        ),
      )
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
      throw new Error(
        'multipart_complete_failed',
      )
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

export default function AdminContentMobile() {
  const { language } = useI18n()
  const text = copy[language]

  const [programs, setPrograms] =
    useState<Program[]>([])
  const [weeks, setWeeks] =
    useState<Week[]>([])
  const [lessons, setLessons] =
    useState<Lesson[]>([])
  const [exercises, setExercises] =
    useState<Exercise[]>([])

  const [
    selectedProgramId,
    setSelectedProgramId,
  ] = useState<number | null>(null)

  const [
    selectedWeekId,
    setSelectedWeekId,
  ] = useState<number | null>(null)

  const [
    selectedLessonId,
    setSelectedLessonId,
  ] = useState<number | null>(null)

  const [loading, setLoading] =
    useState(true)

  const [saving, setSaving] =
    useState(false)

  const [feedback, setFeedback] =
    useState('')

  const [
    showNewProgram,
    setShowNewProgram,
  ] = useState(false)

  const [
    newProgramTitle,
    setNewProgramTitle,
  ] = useState('')

  const [
    newProgramDescription,
    setNewProgramDescription,
  ] = useState('')

  const [lessonTitle, setLessonTitle] =
    useState('')

  const [
    lessonDescription,
    setLessonDescription,
  ] = useState('')

  const [
    showNewExercise,
    setShowNewExercise,
  ] = useState(false)

  const [
    newExerciseTitle,
    setNewExerciseTitle,
  ] = useState('')

  const [
    newExerciseSets,
    setNewExerciseSets,
  ] = useState('3')

  const [
    newExerciseReps,
    setNewExerciseReps,
  ] = useState('12')

  const [
    newExerciseRest,
    setNewExerciseRest,
  ] = useState('45')

  const [
    newExerciseInstructions,
    setNewExerciseInstructions,
  ] = useState('')

  const [
    newExerciseRatio,
    setNewExerciseRatio,
  ] = useState<
    '9:16' | '4:5' | '1:1' | '16:9'
  >('9:16')

  const [
    newExerciseFit,
    setNewExerciseFit,
  ] = useState<'cover' | 'contain'>(
    'cover',
  )

  const [
    newExerciseVideo,
    setNewExerciseVideo,
  ] = useState<File | null>(null)

  const [
    uploadState,
    setUploadState,
  ] = useState<UploadState>(null)

  const [
    previewUrls,
    setPreviewUrls,
  ] = useState<Record<number, string>>(
    {},
  )

  const newVideoInput =
    useRef<HTMLInputElement | null>(null)

  const selectedProgram = useMemo(
    () =>
      programs.find(
        (item) =>
          item.id === selectedProgramId,
      ) ?? null,
    [programs, selectedProgramId],
  )

  const selectedWeek = useMemo(
    () =>
      weeks.find(
        (item) =>
          item.id === selectedWeekId,
      ) ?? null,
    [weeks, selectedWeekId],
  )

  const selectedLesson = useMemo(
    () =>
      lessons.find(
        (item) =>
          item.id === selectedLessonId,
      ) ?? null,
    [lessons, selectedLessonId],
  )

  async function loadPrograms(
    preferred?: number | null,
  ) {
    const { data, error } =
      await supabase
        .from('programs')
        .select(
          'id,title,description,is_active',
        )
        .order('created_at', {
          ascending: true,
        })

    if (error) {
      setFeedback(text.error)
      setLoading(false)
      return
    }

    const rows =
      (data as Program[]) ?? []

    setPrograms(rows)

    const next =
      preferred &&
      rows.some(
        (item) => item.id === preferred,
      )
        ? preferred
        : selectedProgramId &&
            rows.some(
              (item) =>
                item.id === selectedProgramId,
            )
          ? selectedProgramId
          : rows[0]?.id ?? null

    setSelectedProgramId(next)
    setLoading(false)
  }

  async function loadWeeks(
    programId: number,
    preferred?: number | null,
  ) {
    const { data, error } =
      await supabase
        .from('weeks')
        .select(
          'id,program_id,week_number,title',
        )
        .eq('program_id', programId)
        .order('week_number')

    if (error) {
      setFeedback(text.error)
      return
    }

    const rows =
      (data as Week[]) ?? []

    setWeeks(rows)

    const next =
      preferred &&
      rows.some(
        (item) => item.id === preferred,
      )
        ? preferred
        : rows.some(
              (item) =>
                item.id === selectedWeekId,
            )
          ? selectedWeekId
          : rows[0]?.id ?? null

    setSelectedWeekId(next ?? null)

    if (!next) {
      setLessons([])
      setSelectedLessonId(null)
      setExercises([])
    }
  }

  async function loadLessons(
    weekId: number,
    preferred?: number | null,
  ) {
    const { data, error } =
      await supabase
        .from('lessons')
        .select(
          'id,week_id,lesson_number,title,description',
        )
        .eq('week_id', weekId)
        .order('lesson_number')

    if (error) {
      setFeedback(text.error)
      return
    }

    const rows =
      (data as Lesson[]) ?? []

    setLessons(rows)

    const next =
      preferred &&
      rows.some(
        (item) => item.id === preferred,
      )
        ? preferred
        : rows.some(
              (item) =>
                item.id === selectedLessonId,
            )
          ? selectedLessonId
          : rows[0]?.id ?? null

    setSelectedLessonId(next ?? null)

    if (!next) {
      setExercises([])
    }
  }

  async function loadExercises(
    lessonId: number,
  ) {
    const { data, error } =
      await supabase
        .from('exercises')
        .select(
          'id,lesson_id,title,instructions,video_url,video_path,video_ratio,video_fit,sets,repetitions,rest_seconds,sort_order',
        )
        .eq('lesson_id', lessonId)
        .order('sort_order')
        .order('id')

    if (error) {
      setFeedback(text.error)
      return
    }

    setExercises(
      (data as Exercise[]) ?? [],
    )
  }

  useEffect(() => {
    void loadPrograms()
  }, [])

  useEffect(() => {
    if (!selectedProgramId) {
      setWeeks([])
      setSelectedWeekId(null)
      return
    }

    void loadWeeks(selectedProgramId)
  }, [selectedProgramId])

  useEffect(() => {
    if (!selectedWeekId) {
      setLessons([])
      setSelectedLessonId(null)
      return
    }

    void loadLessons(selectedWeekId)
  }, [selectedWeekId])

  useEffect(() => {
    if (!selectedLesson) {
      setLessonTitle('')
      setLessonDescription('')
      setExercises([])
      return
    }

    setLessonTitle(selectedLesson.title)
    setLessonDescription(
      selectedLesson.description ?? '',
    )

    void loadExercises(
      selectedLesson.id,
    )
  }, [selectedLessonId])

  async function createProgram() {
    const title =
      newProgramTitle.trim()

    if (!title) return

    setSaving(true)
    setFeedback('')

    const { data, error } =
      await supabase
        .from('programs')
        .insert({
          title,
          description:
            newProgramDescription.trim() ||
            null,
          is_active: true,
        })
        .select('id')
        .single()

    setSaving(false)

    if (error || !data) {
      setFeedback(text.error)
      return
    }

    setNewProgramTitle('')
    setNewProgramDescription('')
    setShowNewProgram(false)
    setFeedback(text.created)

    await loadPrograms(data.id)
  }

  async function createWeek() {
    if (!selectedProgramId) return

    const nextNumber =
      Math.max(
        0,
        ...weeks.map(
          (item) => item.week_number,
        ),
      ) + 1

    setSaving(true)

    const { data, error } =
      await supabase
        .from('weeks')
        .insert({
          program_id: selectedProgramId,
          week_number: nextNumber,
          title: `Semana ${nextNumber}`,
        })
        .select('id')
        .single()

    setSaving(false)

    if (error || !data) {
      setFeedback(text.error)
      return
    }

    setFeedback(text.created)

    await loadWeeks(
      selectedProgramId,
      data.id,
    )
  }

  async function createLesson() {
    if (!selectedWeekId) return

    const nextNumber =
      Math.max(
        0,
        ...lessons.map(
          (item) => item.lesson_number,
        ),
      ) + 1

    setSaving(true)

    const { data, error } =
      await supabase
        .from('lessons')
        .insert({
          week_id: selectedWeekId,
          lesson_number: nextNumber,
          title: `Aula ${String(
            nextNumber,
          ).padStart(2, '0')}`,
          description: null,
        })
        .select('id')
        .single()

    setSaving(false)

    if (error || !data) {
      setFeedback(text.error)
      return
    }

    setFeedback(text.created)

    await loadLessons(
      selectedWeekId,
      data.id,
    )
  }

  async function saveLesson() {
    if (
      !selectedLessonId ||
      !lessonTitle.trim()
    ) {
      return
    }

    setSaving(true)

    const { error } =
      await supabase
        .from('lessons')
        .update({
          title: lessonTitle.trim(),
          description:
            lessonDescription.trim() ||
            null,
        })
        .eq('id', selectedLessonId)

    setSaving(false)

    if (error) {
      setFeedback(text.error)
      return
    }

    setLessons((current) =>
      current.map((item) =>
        item.id === selectedLessonId
          ? {
              ...item,
              title: lessonTitle.trim(),
              description:
                lessonDescription.trim() ||
                null,
            }
          : item,
      ),
    )

    setFeedback(text.saved)
  }

  function updateExercise(
    id: number,
    patch: Partial<Exercise>,
  ) {
    setExercises((current) =>
      current.map((item) =>
        item.id === id
          ? { ...item, ...patch }
          : item,
      ),
    )
  }

  async function saveExercise(
    exercise: Exercise,
  ) {
    setSaving(true)

    const { error } =
      await supabase
        .from('exercises')
        .update({
          title: exercise.title.trim(),
          sets:
            exercise.sets?.trim() || null,
          repetitions:
            exercise.repetitions?.trim() ||
            null,
          rest_seconds:
            exercise.rest_seconds,
          instructions:
            exercise.instructions?.trim() ||
            null,
          video_ratio:
            exercise.video_ratio,
          video_fit:
            exercise.video_fit,
        })
        .eq('id', exercise.id)

    setSaving(false)

    setFeedback(
      error ? text.error : text.saved,
    )
  }

  async function addExercise() {
    if (
      !selectedLessonId ||
      !selectedProgramId ||
      !newExerciseTitle.trim()
    ) {
      return
    }

    const rest =
      Number(newExerciseRest)

    const sortOrder =
      Math.max(
        0,
        ...exercises.map(
          (item) => item.sort_order,
        ),
      ) + 1

    setSaving(true)
    setFeedback('')

    const { data, error } =
      await supabase
        .from('exercises')
        .insert({
          lesson_id: selectedLessonId,
          title:
            newExerciseTitle.trim(),
          sets:
            newExerciseSets.trim() ||
            null,
          repetitions:
            newExerciseReps.trim() ||
            null,
          rest_seconds:
            Number.isFinite(rest)
              ? rest
              : null,
          instructions:
            newExerciseInstructions.trim() ||
            null,
          video_ratio:
            newExerciseRatio,
          video_fit:
            newExerciseFit,
          sort_order: sortOrder,
        })
        .select(
          'id,video_path',
        )
        .single()

    if (error || !data) {
      setSaving(false)
      setFeedback(text.error)
      return
    }

    if (newExerciseVideo) {
      try {
        setUploadState({
          id: 'new',
          progress: 0,
          message: text.uploading,
        })

        await uploadMultipart({
          exerciseId: data.id,
          programId: selectedProgramId,
          lessonId: selectedLessonId,
          file: newExerciseVideo,
          onProgress: (progress) =>
            setUploadState({
              id: 'new',
              progress,
              message: text.uploading,
            }),
        })
      } catch (error) {
        console.error(
          'RV mobile content upload:',
          error,
        )

        setFeedback(text.videoError)
      } finally {
        setUploadState(null)
      }
    }

    setNewExerciseTitle('')
    setNewExerciseSets('3')
    setNewExerciseReps('12')
    setNewExerciseRest('45')
    setNewExerciseInstructions('')
    setNewExerciseRatio('9:16')
    setNewExerciseFit('cover')
    setNewExerciseVideo(null)

    if (newVideoInput.current) {
      newVideoInput.current.value = ''
    }

    setShowNewExercise(false)
    setSaving(false)
    setFeedback(text.created)

    await loadExercises(
      selectedLessonId,
    )
  }

  async function uploadExerciseVideo(
    exercise: Exercise,
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const input = event.currentTarget
    const file = input.files?.[0]

    if (
      !file ||
      !selectedProgramId ||
      !selectedLessonId
    ) {
      return
    }

    try {
      getVideoMeta(file)

      setUploadState({
        id: exercise.id,
        progress: 0,
        message: text.uploading,
      })

      await uploadMultipart({
        exerciseId: exercise.id,
        programId: selectedProgramId,
        lessonId: selectedLessonId,
        file,
        oldKey: exercise.video_path,
        onProgress: (progress) =>
          setUploadState({
            id: exercise.id,
            progress,
            message: text.uploading,
          }),
      })

      setFeedback(text.saved)

      await loadExercises(
        selectedLessonId,
      )
    } catch (error) {
      console.error(
        'RV mobile content video:',
        error,
      )
      setFeedback(text.videoError)
    } finally {
      setUploadState(null)
      input.value = ''
    }
  }

  async function previewVideo(
    exercise: Exercise,
  ) {
    if (previewUrls[exercise.id]) {
      setPreviewUrls((current) => {
        const next = { ...current }
        delete next[exercise.id]
        return next
      })
      return
    }

    if (exercise.video_url) {
      setPreviewUrls((current) => ({
        ...current,
        [exercise.id]:
          exercise.video_url || '',
      }))
      return
    }

    if (!exercise.video_path) return

    try {
      const data = await invokeR2({
        action: 'play',
        exercise_id: exercise.id,
      })

      const url =
        String(data?.url || '')

      if (url) {
        setPreviewUrls((current) => ({
          ...current,
          [exercise.id]: url,
        }))
      }
    } catch (error) {
      console.error(
        'RV mobile preview:',
        error,
      )
      setFeedback(text.error)
    }
  }

  async function deleteExercise(
    exercise: Exercise,
  ) {
    if (
      !window.confirm(
        text.confirmDeleteExercise,
      )
    ) {
      return
    }

    setSaving(true)

    if (exercise.video_path) {
      await invokeR2({
        action: 'delete',
        key: exercise.video_path,
      }).catch(() => null)
    }

    const { error } =
      await supabase
        .from('exercises')
        .delete()
        .eq('id', exercise.id)

    setSaving(false)

    if (error) {
      setFeedback(text.error)
      return
    }

    setExercises((current) =>
      current.filter(
        (item) =>
          item.id !== exercise.id,
      ),
    )

    setFeedback(text.saved)
  }

  async function deleteLesson() {
    if (
      !selectedLessonId ||
      !selectedWeekId ||
      !window.confirm(
        text.confirmDeleteLesson,
      )
    ) {
      return
    }

    setSaving(true)

    await Promise.all(
      exercises
        .filter(
          (item) => item.video_path,
        )
        .map((item) =>
          invokeR2({
            action: 'delete',
            key: item.video_path,
          }).catch(() => null),
        ),
    )

    const { error } =
      await supabase
        .from('lessons')
        .delete()
        .eq('id', selectedLessonId)

    setSaving(false)

    if (error) {
      setFeedback(text.error)
      return
    }

    setSelectedLessonId(null)
    setFeedback(text.saved)

    await loadLessons(selectedWeekId)
  }

  if (loading) {
    return (
      <RvLoadingState
        title={text.title}
        text={text.subtitle}
      />
    )
  }

  return (
    <div className="rvMobileContentEditor">
      <header className="rvMobileContentHero">
        <span>{text.eyebrow}</span>
        <h2>{text.title}</h2>
        <p>{text.subtitle}</p>
      </header>

      {feedback && (
        <div
          className="rvMobileContentFeedback"
          role="status"
        >
          <span>{feedback}</span>
          <button
            type="button"
            onClick={() =>
              setFeedback('')
            }
            aria-label="Fechar"
          >
            <X size={15} />
          </button>
        </div>
      )}

      <section className="rvMobileContentStep active">
        <header>
          <span className="rvMobileStepNumber">
            1
          </span>
          <div>
            <strong>{text.methodology}</strong>
            <small>
              {selectedProgram?.title ||
                text.chooseMethodology}
            </small>
          </div>
        </header>

        <select
          value={selectedProgramId ?? ''}
          onChange={(event) =>
            setSelectedProgramId(
              event.target.value
                ? Number(
                    event.target.value,
                  )
                : null,
            )
          }
        >
          <option value="">
            {text.chooseMethodology}
          </option>
          {programs.map((program) => (
            <option
              key={program.id}
              value={program.id}
            >
              {program.title}
              {' · '}
              {program.is_active
                ? text.active
                : text.inactive}
            </option>
          ))}
        </select>

        <button
          type="button"
          className="rvMobileSecondaryAction"
          onClick={() =>
            setShowNewProgram(
              (current) => !current,
            )
          }
        >
          <Plus size={17} />
          {text.newMethodology}
        </button>

        {showNewProgram && (
          <div className="rvMobileInlineForm">
            <label>
              {text.methodologyName}
              <input
                value={newProgramTitle}
                onChange={(event) =>
                  setNewProgramTitle(
                    event.target.value,
                  )
                }
              />
            </label>

            <label>
              {text.optionalDescription}
              <textarea
                value={
                  newProgramDescription
                }
                onChange={(event) =>
                  setNewProgramDescription(
                    event.target.value,
                  )
                }
              />
            </label>

            <button
              type="button"
              className="rvMobilePrimaryAction"
              onClick={() =>
                void createProgram()
              }
              disabled={
                saving ||
                !newProgramTitle.trim()
              }
            >
              <Check size={17} />
              {text.createMethodology}
            </button>
          </div>
        )}
      </section>

      {!selectedProgramId ? (
        <RvEmptyState
          compact
          kind="program"
          title={text.chooseMethodology}
          text={text.noMethodology}
        />
      ) : (
        <>
          <section className="rvMobileContentStep active">
            <header>
              <span className="rvMobileStepNumber">
                2
              </span>
              <div>
                <strong>{text.week}</strong>
                <small>
                  {selectedWeek?.title ||
                    text.chooseWeek}
                </small>
              </div>
            </header>

            <select
              value={selectedWeekId ?? ''}
              onChange={(event) =>
                setSelectedWeekId(
                  event.target.value
                    ? Number(
                        event.target.value,
                      )
                    : null,
                )
              }
            >
              <option value="">
                {text.chooseWeek}
              </option>
              {weeks.map((week) => (
                <option
                  key={week.id}
                  value={week.id}
                >
                  {week.title ||
                    `Semana ${week.week_number}`}
                </option>
              ))}
            </select>

            <button
              type="button"
              className="rvMobileSecondaryAction"
              onClick={() =>
                void createWeek()
              }
              disabled={saving}
            >
              <FolderPlus size={17} />
              {text.newWeek}
            </button>
          </section>

          {weeks.length === 0 ? (
            <RvEmptyState
              compact
              kind="program"
              title={text.week}
              text={text.noWeek}
            />
          ) : (
            <section className="rvMobileContentStep active">
              <header>
                <span className="rvMobileStepNumber">
                  3
                </span>
                <div>
                  <strong>{text.lesson}</strong>
                  <small>
                    {selectedLesson?.title ||
                      text.chooseLesson}
                  </small>
                </div>
              </header>

              <select
                value={
                  selectedLessonId ?? ''
                }
                onChange={(event) =>
                  setSelectedLessonId(
                    event.target.value
                      ? Number(
                          event.target.value,
                        )
                      : null,
                  )
                }
              >
                <option value="">
                  {text.chooseLesson}
                </option>
                {lessons.map((lesson) => (
                  <option
                    key={lesson.id}
                    value={lesson.id}
                  >
                    {String(
                      lesson.lesson_number,
                    ).padStart(2, '0')}
                    {' · '}
                    {lesson.title}
                  </option>
                ))}
              </select>

              <button
                type="button"
                className="rvMobileSecondaryAction"
                onClick={() =>
                  void createLesson()
                }
                disabled={saving}
              >
                <Plus size={17} />
                {text.newLesson}
              </button>
            </section>
          )}
        </>
      )}

      {selectedLesson ? (
        <>
          <section className="rvMobileLessonEditor">
            <div className="rvMobileSectionTitle">
              <span>
                <Pencil size={17} />
              </span>
              <div>
                <strong>
                  {text.lesson}
                </strong>
                <small>
                  {text.stepHelp}
                </small>
              </div>
            </div>

            <label>
              {text.lessonTitle}
              <input
                value={lessonTitle}
                onChange={(event) =>
                  setLessonTitle(
                    event.target.value,
                  )
                }
              />
            </label>

            <label>
              {text.lessonDescription}
              <textarea
                value={lessonDescription}
                onChange={(event) =>
                  setLessonDescription(
                    event.target.value,
                  )
                }
              />
            </label>

            <button
              type="button"
              className="rvMobilePrimaryAction"
              onClick={() =>
                void saveLesson()
              }
              disabled={
                saving ||
                !lessonTitle.trim()
              }
            >
              <Save size={17} />
              {saving
                ? text.saving
                : text.saveLesson}
            </button>
          </section>

          <section className="rvMobileExercisesSection">
            <header className="rvMobileExercisesHeader">
              <div>
                <span>
                  {text.exercises}
                </span>
                <h3>
                  {text.addedExercises}
                </h3>
              </div>
              <strong>
                {exercises.length}
              </strong>
            </header>

            {exercises.length === 0 && (
              <div className="rvMobileExercisesEmpty">
                <Video size={23} />
                <strong>
                  {text.noExercises}
                </strong>
                <span>
                  {text.noExercisesHelp}
                </span>
              </div>
            )}

            <div className="rvMobileExerciseList">
              {exercises.map(
                (exercise, index) => (
                  <details
                    className="rvMobileExerciseCard"
                    key={exercise.id}
                  >
                    <summary>
                      <span className="rvMobileExerciseIndex">
                        {String(
                          index + 1,
                        ).padStart(2, '0')}
                      </span>

                      <span className="rvMobileExerciseSummary">
                        <strong>
                          {exercise.title}
                        </strong>
                        <small>
                          {exercise.video_path ||
                          exercise.video_url
                            ? text.videoReady
                            : text.noVideo}
                          {' · '}
                          {exercise.sets ||
                            '—'}
                          {' × '}
                          {exercise.repetitions ||
                            '—'}
                        </small>
                      </span>

                      <ChevronDown
                        size={18}
                      />
                    </summary>

                    <div className="rvMobileExerciseBody">
                      <label>
                        {text.exerciseName}
                        <input
                          value={
                            exercise.title
                          }
                          onChange={(event) =>
                            updateExercise(
                              exercise.id,
                              {
                                title:
                                  event.target
                                    .value,
                              },
                            )
                          }
                        />
                      </label>

                      <div className="rvMobileTwoFields">
                        <label>
                          {text.sets}
                          <input
                            value={
                              exercise.sets ??
                              ''
                            }
                            onChange={(
                              event,
                            ) =>
                              updateExercise(
                                exercise.id,
                                {
                                  sets:
                                    event
                                      .target
                                      .value,
                                },
                              )
                            }
                          />
                        </label>

                        <label>
                          {text.reps}
                          <input
                            value={
                              exercise.repetitions ??
                              ''
                            }
                            onChange={(
                              event,
                            ) =>
                              updateExercise(
                                exercise.id,
                                {
                                  repetitions:
                                    event
                                      .target
                                      .value,
                                },
                              )
                            }
                          />
                        </label>
                      </div>

                      <label>
                        {text.rest}
                        <input
                          type="number"
                          min="0"
                          value={
                            exercise.rest_seconds ??
                            ''
                          }
                          onChange={(event) =>
                            updateExercise(
                              exercise.id,
                              {
                                rest_seconds:
                                  event.target
                                    .value
                                    ? Number(
                                        event
                                          .target
                                          .value,
                                      )
                                    : null,
                              },
                            )
                          }
                        />
                      </label>

                      <label>
                        {text.instructions}
                        <textarea
                          value={
                            exercise.instructions ??
                            ''
                          }
                          onChange={(event) =>
                            updateExercise(
                              exercise.id,
                              {
                                instructions:
                                  event.target
                                    .value,
                              },
                            )
                          }
                        />
                      </label>

                      <div className="rvMobileVideoBlock">
                        <div>
                          <FileVideo
                            size={19}
                          />
                          <span>
                            <strong>
                              {text.video}
                            </strong>
                            <small>
                              {exercise.video_path ||
                              exercise.video_url
                                ? text.videoReady
                                : text.noVideo}
                            </small>
                          </span>
                        </div>

                        {previewUrls[
                          exercise.id
                        ] && (
                          <video
                            controls
                            playsInline
                            preload="metadata"
                            src={
                              previewUrls[
                                exercise.id
                              ]
                            }
                          />
                        )}

                        <div className="rvMobileVideoActions">
                          {(exercise.video_path ||
                            exercise.video_url) && (
                            <button
                              type="button"
                              onClick={() =>
                                void previewVideo(
                                  exercise,
                                )
                              }
                            >
                              <Play
                                size={15}
                              />
                              {previewUrls[
                                exercise.id
                              ]
                                ? text.closePreview
                                : text.preview}
                            </button>
                          )}

                          <label>
                            <Upload
                              size={15}
                            />
                            {exercise.video_path ||
                            exercise.video_url
                              ? text.changeVideo
                              : text.selectVideo}
                            <input
                              type="file"
                              accept=".mp4,.mov,.webm,video/mp4,video/quicktime,video/webm"
                              onChange={(
                                event,
                              ) =>
                                void uploadExerciseVideo(
                                  exercise,
                                  event,
                                )
                              }
                            />
                          </label>
                        </div>

                        {uploadState?.id ===
                          exercise.id && (
                          <div className="rvMobileUploadProgress">
                            <div>
                              <span>
                                {
                                  uploadState.message
                                }
                              </span>
                              <strong>
                                {
                                  uploadState.progress
                                }
                                %
                              </strong>
                            </div>
                            <i>
                              <span
                                style={{
                                  width: `${uploadState.progress}%`,
                                }}
                              />
                            </i>
                          </div>
                        )}
                      </div>

                      <details className="rvMobileVideoAdvanced">
                        <summary>
                          {text.videoOptions}
                        </summary>

                        <div className="rvMobileTwoFields">
                          <label>
                            {text.ratio}
                            <select
                              value={
                                exercise.video_ratio ||
                                '9:16'
                              }
                              onChange={(
                                event,
                              ) =>
                                updateExercise(
                                  exercise.id,
                                  {
                                    video_ratio:
                                      event
                                        .target
                                        .value as Exercise['video_ratio'],
                                  },
                                )
                              }
                            >
                              <option value="9:16">
                                9:16
                              </option>
                              <option value="4:5">
                                4:5
                              </option>
                              <option value="1:1">
                                1:1
                              </option>
                              <option value="16:9">
                                16:9
                              </option>
                            </select>
                          </label>

                          <label>
                            {text.fit}
                            <select
                              value={
                                exercise.video_fit ||
                                'cover'
                              }
                              onChange={(
                                event,
                              ) =>
                                updateExercise(
                                  exercise.id,
                                  {
                                    video_fit:
                                      event
                                        .target
                                        .value as Exercise['video_fit'],
                                  },
                                )
                              }
                            >
                              <option value="cover">
                                {text.fill}
                              </option>
                              <option value="contain">
                                {text.full}
                              </option>
                            </select>
                          </label>
                        </div>
                      </details>

                      <button
                        type="button"
                        className="rvMobilePrimaryAction"
                        onClick={() =>
                          void saveExercise(
                            exercise,
                          )
                        }
                        disabled={saving}
                      >
                        <Save size={16} />
                        {text.saveExercise}
                      </button>

                      <button
                        type="button"
                        className="rvMobileDangerAction"
                        onClick={() =>
                          void deleteExercise(
                            exercise,
                          )
                        }
                        disabled={saving}
                      >
                        <Trash2
                          size={15}
                        />
                        {text.deleteExercise}
                      </button>
                    </div>
                  </details>
                ),
              )}
            </div>

            <button
              type="button"
              className="rvMobileAddExerciseButton"
              onClick={() =>
                setShowNewExercise(
                  (current) => !current,
                )
              }
            >
              <Plus size={19} />
              <span>
                <strong>
                  {text.addExercise}
                </strong>
                <small>
                  {text.videoOptional}
                </small>
              </span>
            </button>

            {showNewExercise && (
              <div className="rvMobileNewExercise">
                <label>
                  {text.exerciseName}
                  <input
                    value={
                      newExerciseTitle
                    }
                    onChange={(event) =>
                      setNewExerciseTitle(
                        event.target.value,
                      )
                    }
                  />
                </label>

                <div className="rvMobileTwoFields">
                  <label>
                    {text.sets}
                    <input
                      value={
                        newExerciseSets
                      }
                      onChange={(event) =>
                        setNewExerciseSets(
                          event.target.value,
                        )
                      }
                    />
                  </label>

                  <label>
                    {text.reps}
                    <input
                      value={
                        newExerciseReps
                      }
                      onChange={(event) =>
                        setNewExerciseReps(
                          event.target.value,
                        )
                      }
                    />
                  </label>
                </div>

                <label>
                  {text.rest}
                  <input
                    type="number"
                    min="0"
                    value={
                      newExerciseRest
                    }
                    onChange={(event) =>
                      setNewExerciseRest(
                        event.target.value,
                      )
                    }
                  />
                </label>

                <label>
                  {text.instructions}
                  <textarea
                    value={
                      newExerciseInstructions
                    }
                    onChange={(event) =>
                      setNewExerciseInstructions(
                        event.target.value,
                      )
                    }
                  />
                </label>

                <div className="rvMobileNewVideo">
                  <div>
                    <FileVideo
                      size={20}
                    />
                    <span>
                      <strong>
                        {text.video}
                      </strong>
                      <small>
                        {newExerciseVideo
                          ? newExerciseVideo.name
                          : text.videoOptional}
                      </small>
                    </span>
                  </div>

                  <label>
                    <Upload size={16} />
                    {newExerciseVideo
                      ? text.changeVideo
                      : text.selectVideo}
                    <input
                      ref={newVideoInput}
                      type="file"
                      accept=".mp4,.mov,.webm,video/mp4,video/quicktime,video/webm"
                      onChange={(event) => {
                        const file =
                          event.currentTarget
                            .files?.[0] ??
                          null

                        if (!file) {
                          setNewExerciseVideo(
                            null,
                          )
                          return
                        }

                        try {
                          getVideoMeta(file)
                          setNewExerciseVideo(
                            file,
                          )
                        } catch {
                          setNewExerciseVideo(
                            null,
                          )
                          event.currentTarget.value =
                            ''
                          setFeedback(
                            text.videoError,
                          )
                        }
                      }}
                    />
                  </label>
                </div>

                <details className="rvMobileVideoAdvanced">
                  <summary>
                    {text.videoOptions}
                  </summary>

                  <div className="rvMobileTwoFields">
                    <label>
                      {text.ratio}
                      <select
                        value={
                          newExerciseRatio
                        }
                        onChange={(event) =>
                          setNewExerciseRatio(
                            event.target
                              .value as typeof newExerciseRatio,
                          )
                        }
                      >
                        <option value="9:16">
                          9:16
                        </option>
                        <option value="4:5">
                          4:5
                        </option>
                        <option value="1:1">
                          1:1
                        </option>
                        <option value="16:9">
                          16:9
                        </option>
                      </select>
                    </label>

                    <label>
                      {text.fit}
                      <select
                        value={
                          newExerciseFit
                        }
                        onChange={(event) =>
                          setNewExerciseFit(
                            event.target
                              .value as typeof newExerciseFit,
                          )
                        }
                      >
                        <option value="cover">
                          {text.fill}
                        </option>
                        <option value="contain">
                          {text.full}
                        </option>
                      </select>
                    </label>
                  </div>
                </details>

                {uploadState?.id ===
                  'new' && (
                  <div className="rvMobileUploadProgress">
                    <div>
                      <span>
                        {
                          uploadState.message
                        }
                      </span>
                      <strong>
                        {
                          uploadState.progress
                        }
                        %
                      </strong>
                    </div>
                    <i>
                      <span
                        style={{
                          width: `${uploadState.progress}%`,
                        }}
                      />
                    </i>
                  </div>
                )}

                <button
                  type="button"
                  className="rvMobilePrimaryAction"
                  onClick={() =>
                    void addExercise()
                  }
                  disabled={
                    saving ||
                    !newExerciseTitle.trim()
                  }
                >
                  <Plus size={17} />
                  {saving
                    ? text.saving
                    : text.add}
                </button>
              </div>
            )}
          </section>

          <details className="rvMobileDangerZone">
            <summary>
              {text.advanced}
            </summary>
            <button
              type="button"
              onClick={() =>
                void deleteLesson()
              }
              disabled={saving}
            >
              <Trash2 size={15} />
              {text.deleteLesson}
            </button>
          </details>
        </>
      ) : selectedWeekId ? (
        <RvEmptyState
          compact
          kind="program"
          title={text.lesson}
          text={text.noLesson}
        />
      ) : null}
    </div>
  )
}
