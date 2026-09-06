import {
  ArrowLeft,
  ChevronRight,
  FileVideo,
  Play,
  Plus,
  Save,
  Trash2,
  Upload,
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
import RvConfirmModal from './RvConfirmModal'

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


const flowCopy = {
  'pt-BR': {
    content: 'Conteúdo',
    activeMethods: 'Metodologias ativas',
    activeMethodsHelp: 'Escolha uma metodologia para ver e editar as aulas.',
    lessons: 'Aulas',
    lessonsHelp: 'Abra uma aula para editar. Uma coisa por vez.',
    exercises: 'Exercícios',
    exercisesHelp: 'Abra um exercício para editar séries, repetições e vídeo.',
    addMethod: 'Nova metodologia',
    addLesson: 'Adicionar aula',
    addExercise: 'Adicionar exercício',
    backMethods: 'Metodologias',
    backLessons: 'Aulas',
    backLesson: 'Aula',
    noActiveMethods: 'Nenhuma metodologia ativa',
    noActiveMethodsHelp: 'Crie uma metodologia para começar a publicar treinos.',
    noLessons: 'Nenhuma aula nesta metodologia',
    noLessonsHelp: 'Adicione a primeira aula.',
    noExercises: 'Nenhum exercício nesta aula',
    noExercisesHelp: 'Adicione o primeiro exercício e, se quiser, já envie o vídeo.',
    methodName: 'Nome da metodologia',
    methodDescription: 'Descrição',
    createMethod: 'Criar metodologia',
    lessonName: 'Nome da aula',
    lessonGuidance: 'Orientação da aula',
    createLesson: 'Criar aula',
    saveLesson: 'Salvar aula',
    exerciseName: 'Nome do exercício',
    sets: 'Séries',
    reps: 'Repetições / tempo',
    rest: 'Descanso (s)',
    instructions: 'Instruções',
    video: 'Vídeo',
    noVideo: 'Sem vídeo',
    videoReady: 'Vídeo adicionado',
    selectVideo: 'Selecionar vídeo',
    changeVideo: 'Trocar vídeo',
    previewVideo: 'Ver vídeo',
    closeVideo: 'Fechar vídeo',
    saveExercise: 'Salvar exercício',
    createExercise: 'Adicionar exercício',
    advanced: 'Opções avançadas',
    videoFormat: 'Formato do vídeo',
    videoFit: 'Enquadramento',
    fill: 'Preencher sem bordas',
    full: 'Mostrar inteiro',
    organization: 'Organização',
    week: 'Semana',
    deleteLesson: 'Excluir aula',
    deleteExercise: 'Excluir exercício',
    confirmDeleteLesson: 'Excluir esta aula e todos os exercícios?',
    confirmDeleteExercise: 'Excluir este exercício?',
    upload: 'Enviando vídeo...',
    saved: 'Alterações salvas.',
    created: 'Criado com sucesso.',
    error: 'Não foi possível concluir esta ação.',
    videoError: 'Não foi possível enviar o vídeo.',
    active: 'Ativa',
    lessonCount: 'aula(s)',
    exerciseCount: 'exercício(s)',
    optional: 'Opcional',
    required: 'Obrigatório',
    chooseWeek: 'Escolher semana',
    newLessonTitle: 'Nova aula',
    newExerciseTitle: 'Novo exercício',
  },
  en: {
    content: 'Content',
    activeMethods: 'Active methodologies',
    activeMethodsHelp: 'Choose a methodology to view and edit its lessons.',
    lessons: 'Lessons',
    lessonsHelp: 'Open one lesson to edit it. One thing at a time.',
    exercises: 'Exercises',
    exercisesHelp: 'Open an exercise to edit sets, repetitions and video.',
    addMethod: 'New methodology',
    addLesson: 'Add lesson',
    addExercise: 'Add exercise',
    backMethods: 'Methodologies',
    backLessons: 'Lessons',
    backLesson: 'Lesson',
    noActiveMethods: 'No active methodologies',
    noActiveMethodsHelp: 'Create a methodology to start publishing training.',
    noLessons: 'No lessons in this methodology',
    noLessonsHelp: 'Add the first lesson.',
    noExercises: 'No exercises in this lesson',
    noExercisesHelp: 'Add the first exercise and upload a video if you want.',
    methodName: 'Methodology name',
    methodDescription: 'Description',
    createMethod: 'Create methodology',
    lessonName: 'Lesson name',
    lessonGuidance: 'Lesson guidance',
    createLesson: 'Create lesson',
    saveLesson: 'Save lesson',
    exerciseName: 'Exercise name',
    sets: 'Sets',
    reps: 'Repetitions / time',
    rest: 'Rest (s)',
    instructions: 'Instructions',
    video: 'Video',
    noVideo: 'No video',
    videoReady: 'Video added',
    selectVideo: 'Select video',
    changeVideo: 'Change video',
    previewVideo: 'View video',
    closeVideo: 'Close video',
    saveExercise: 'Save exercise',
    createExercise: 'Add exercise',
    advanced: 'Advanced options',
    videoFormat: 'Video format',
    videoFit: 'Framing',
    fill: 'Fill without borders',
    full: 'Show full video',
    organization: 'Organization',
    week: 'Week',
    deleteLesson: 'Delete lesson',
    deleteExercise: 'Delete exercise',
    confirmDeleteLesson: 'Delete this lesson and all exercises?',
    confirmDeleteExercise: 'Delete this exercise?',
    upload: 'Uploading video...',
    saved: 'Changes saved.',
    created: 'Created successfully.',
    error: 'Could not complete this action.',
    videoError: 'Could not upload the video.',
    active: 'Active',
    lessonCount: 'lesson(s)',
    exerciseCount: 'exercise(s)',
    optional: 'Optional',
    required: 'Required',
    chooseWeek: 'Choose week',
    newLessonTitle: 'New lesson',
    newExerciseTitle: 'New exercise',
  },
  es: {
    content: 'Contenido',
    activeMethods: 'Metodologías activas',
    activeMethodsHelp: 'Elige una metodología para ver y editar sus clases.',
    lessons: 'Clases',
    lessonsHelp: 'Abre una clase para editarla. Una cosa a la vez.',
    exercises: 'Ejercicios',
    exercisesHelp: 'Abre un ejercicio para editar series, repeticiones y video.',
    addMethod: 'Nueva metodología',
    addLesson: 'Agregar clase',
    addExercise: 'Agregar ejercicio',
    backMethods: 'Metodologías',
    backLessons: 'Clases',
    backLesson: 'Clase',
    noActiveMethods: 'No hay metodologías activas',
    noActiveMethodsHelp: 'Crea una metodología para comenzar a publicar entrenamientos.',
    noLessons: 'No hay clases en esta metodología',
    noLessonsHelp: 'Agrega la primera clase.',
    noExercises: 'No hay ejercicios en esta clase',
    noExercisesHelp: 'Agrega el primer ejercicio y, si quieres, sube el video.',
    methodName: 'Nombre de la metodología',
    methodDescription: 'Descripción',
    createMethod: 'Crear metodología',
    lessonName: 'Nombre de la clase',
    lessonGuidance: 'Orientación de la clase',
    createLesson: 'Crear clase',
    saveLesson: 'Guardar clase',
    exerciseName: 'Nombre del ejercicio',
    sets: 'Series',
    reps: 'Repeticiones / tiempo',
    rest: 'Descanso (s)',
    instructions: 'Instrucciones',
    video: 'Video',
    noVideo: 'Sin video',
    videoReady: 'Video agregado',
    selectVideo: 'Seleccionar video',
    changeVideo: 'Cambiar video',
    previewVideo: 'Ver video',
    closeVideo: 'Cerrar video',
    saveExercise: 'Guardar ejercicio',
    createExercise: 'Agregar ejercicio',
    advanced: 'Opciones avanzadas',
    videoFormat: 'Formato del video',
    videoFit: 'Encuadre',
    fill: 'Rellenar sin bordes',
    full: 'Mostrar completo',
    organization: 'Organización',
    week: 'Semana',
    deleteLesson: 'Eliminar clase',
    deleteExercise: 'Eliminar ejercicio',
    confirmDeleteLesson: '¿Eliminar esta clase y todos sus ejercicios?',
    confirmDeleteExercise: '¿Eliminar este ejercicio?',
    upload: 'Subiendo video...',
    saved: 'Cambios guardados.',
    created: 'Creado correctamente.',
    error: 'No se pudo completar esta acción.',
    videoError: 'No se pudo subir el video.',
    active: 'Activa',
    lessonCount: 'clase(s)',
    exerciseCount: 'ejercicio(s)',
    optional: 'Opcional',
    required: 'Obligatorio',
    chooseWeek: 'Elegir semana',
    newLessonTitle: 'Nueva clase',
    newExerciseTitle: 'Nuevo ejercicio',
  },
  'zh-CN': {
    content: '内容',
    activeMethods: '启用的训练方案',
    activeMethodsHelp: '选择训练方案后查看和编辑课程。',
    lessons: '课程',
    lessonsHelp: '打开一节课程进行编辑，一次只处理一项。',
    exercises: '练习',
    exercisesHelp: '打开练习后编辑组数、次数和视频。',
    addMethod: '新建训练方案',
    addLesson: '添加课程',
    addExercise: '添加练习',
    backMethods: '训练方案',
    backLessons: '课程',
    backLesson: '课程',
    noActiveMethods: '暂无启用的训练方案',
    noActiveMethodsHelp: '创建训练方案后即可开始发布训练。',
    noLessons: '此训练方案暂无课程',
    noLessonsHelp: '添加第一节课程。',
    noExercises: '此课程暂无练习',
    noExercisesHelp: '添加第一个练习，也可以直接上传视频。',
    methodName: '训练方案名称',
    methodDescription: '描述',
    createMethod: '创建训练方案',
    lessonName: '课程名称',
    lessonGuidance: '课程说明',
    createLesson: '创建课程',
    saveLesson: '保存课程',
    exerciseName: '练习名称',
    sets: '组数',
    reps: '次数 / 时间',
    rest: '休息（秒）',
    instructions: '说明',
    video: '视频',
    noVideo: '无视频',
    videoReady: '已添加视频',
    selectVideo: '选择视频',
    changeVideo: '更换视频',
    previewVideo: '查看视频',
    closeVideo: '关闭视频',
    saveExercise: '保存练习',
    createExercise: '添加练习',
    advanced: '高级选项',
    videoFormat: '视频格式',
    videoFit: '画面适配',
    fill: '填充无边框',
    full: '完整显示',
    organization: '组织',
    week: '周',
    deleteLesson: '删除课程',
    deleteExercise: '删除练习',
    confirmDeleteLesson: '删除此课程及所有练习？',
    confirmDeleteExercise: '删除此练习？',
    upload: '视频上传中...',
    saved: '已保存修改。',
    created: '创建成功。',
    error: '无法完成此操作。',
    videoError: '无法上传视频。',
    active: '启用',
    lessonCount: '节课',
    exerciseCount: '个练习',
    optional: '可选',
    required: '必填',
    chooseWeek: '选择周次',
    newLessonTitle: '新课程',
    newExerciseTitle: '新练习',
  },
  de: {
    content: 'Inhalte',
    activeMethods: 'Aktive Methoden',
    activeMethodsHelp: 'Wähle eine Methode, um ihre Lektionen anzusehen und zu bearbeiten.',
    lessons: 'Lektionen',
    lessonsHelp: 'Öffne eine Lektion zum Bearbeiten. Eine Sache nach der anderen.',
    exercises: 'Übungen',
    exercisesHelp: 'Öffne eine Übung, um Sätze, Wiederholungen und Video zu bearbeiten.',
    addMethod: 'Neue Methode',
    addLesson: 'Lektion hinzufügen',
    addExercise: 'Übung hinzufügen',
    backMethods: 'Methoden',
    backLessons: 'Lektionen',
    backLesson: 'Lektion',
    noActiveMethods: 'Keine aktiven Methoden',
    noActiveMethodsHelp: 'Erstelle eine Methode, um Trainings zu veröffentlichen.',
    noLessons: 'Keine Lektionen in dieser Methode',
    noLessonsHelp: 'Füge die erste Lektion hinzu.',
    noExercises: 'Keine Übungen in dieser Lektion',
    noExercisesHelp: 'Füge die erste Übung hinzu und lade optional ein Video hoch.',
    methodName: 'Methodenname',
    methodDescription: 'Beschreibung',
    createMethod: 'Methode erstellen',
    lessonName: 'Lektionsname',
    lessonGuidance: 'Lektionshinweise',
    createLesson: 'Lektion erstellen',
    saveLesson: 'Lektion speichern',
    exerciseName: 'Übungsname',
    sets: 'Sätze',
    reps: 'Wiederholungen / Zeit',
    rest: 'Pause (s)',
    instructions: 'Anweisungen',
    video: 'Video',
    noVideo: 'Kein Video',
    videoReady: 'Video hinzugefügt',
    selectVideo: 'Video auswählen',
    changeVideo: 'Video wechseln',
    previewVideo: 'Video ansehen',
    closeVideo: 'Video schließen',
    saveExercise: 'Übung speichern',
    createExercise: 'Übung hinzufügen',
    advanced: 'Erweiterte Optionen',
    videoFormat: 'Videoformat',
    videoFit: 'Darstellung',
    fill: 'Ohne Ränder ausfüllen',
    full: 'Ganzes Video anzeigen',
    organization: 'Organisation',
    week: 'Woche',
    deleteLesson: 'Lektion löschen',
    deleteExercise: 'Übung löschen',
    confirmDeleteLesson: 'Diese Lektion und alle Übungen löschen?',
    confirmDeleteExercise: 'Diese Übung löschen?',
    upload: 'Video wird hochgeladen...',
    saved: 'Änderungen gespeichert.',
    created: 'Erfolgreich erstellt.',
    error: 'Aktion konnte nicht abgeschlossen werden.',
    videoError: 'Video konnte nicht hochgeladen werden.',
    active: 'Aktiv',
    lessonCount: 'Lektion(en)',
    exerciseCount: 'Übung(en)',
    optional: 'Optional',
    required: 'Erforderlich',
    chooseWeek: 'Woche auswählen',
    newLessonTitle: 'Neue Lektion',
    newExerciseTitle: 'Neue Übung',
  },
} as const

type FlowView =
  | 'programs'
  | 'new-program'
  | 'lessons'
  | 'new-lesson'
  | 'lesson'
  | 'new-exercise'
  | 'exercise'

export default function AdminContentMobile() {
  const { language } = useI18n()
  const text = {
    ...copy[language],
    ...flowCopy[language],
  }

  const [view, setView] =
    useState<FlowView>('programs')

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
    selectedLessonId,
    setSelectedLessonId,
  ] = useState<number | null>(null)

  const [
    selectedExerciseId,
    setSelectedExerciseId,
  ] = useState<number | null>(null)

  const [loading, setLoading] =
    useState(true)
  const [saving, setSaving] =
    useState(false)
  const [feedback, setFeedback] =
    useState('')

  const [newProgramTitle, setNewProgramTitle] =
    useState('')
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
    newLessonWeekId,
    setNewLessonWeekId,
  ] = useState<number | null>(null)

  const [
    exerciseTitle,
    setExerciseTitle,
  ] = useState('')
  const [exerciseSets, setExerciseSets] =
    useState('3')
  const [exerciseReps, setExerciseReps] =
    useState('12')
  const [exerciseRest, setExerciseRest] =
    useState('45')
  const [
    exerciseInstructions,
    setExerciseInstructions,
  ] = useState('')
  const [
    exerciseRatio,
    setExerciseRatio,
  ] = useState<
    '9:16' | '4:5' | '1:1' | '16:9'
  >('9:16')
  const [
    exerciseFit,
    setExerciseFit,
  ] = useState<'cover' | 'contain'>(
    'cover',
  )
  const [
    exerciseVideo,
    setExerciseVideo,
  ] = useState<File | null>(null)

  const [
    uploadState,
    setUploadState,
  ] = useState<UploadState>(null)

  const [
    previewUrl,
    setPreviewUrl,
  ] = useState('')

  const [deleteRequest, setDeleteRequest] =
    useState<'lesson' | 'exercise' | null>(null)

  const videoInputRef =
    useRef<HTMLInputElement | null>(null)

  const selectedProgram = useMemo(
    () =>
      programs.find(
        (item) =>
          item.id === selectedProgramId,
      ) ?? null,
    [programs, selectedProgramId],
  )

  const selectedLesson = useMemo(
    () =>
      lessons.find(
        (item) =>
          item.id === selectedLessonId,
      ) ?? null,
    [lessons, selectedLessonId],
  )

  const selectedExercise = useMemo(
    () =>
      exercises.find(
        (item) =>
          item.id === selectedExerciseId,
      ) ?? null,
    [exercises, selectedExerciseId],
  )

  const weekById = useMemo(
    () =>
      new Map(
        weeks.map((week) => [
          week.id,
          week,
        ]),
      ),
    [weeks],
  )

  function resetExerciseForm() {
    setExerciseTitle('')
    setExerciseSets('3')
    setExerciseReps('12')
    setExerciseRest('45')
    setExerciseInstructions('')
    setExerciseRatio('9:16')
    setExerciseFit('cover')
    setExerciseVideo(null)
    setPreviewUrl('')

    if (videoInputRef.current) {
      videoInputRef.current.value = ''
    }
  }

  async function loadPrograms() {
    setLoading(true)

    const { data, error } =
      await supabase
        .from('programs')
        .select(
          'id,title,description,is_active',
        )
        .eq('is_active', true)
        .order('created_at', {
          ascending: true,
        })

    if (error) {
      setFeedback(text.error)
      setLoading(false)
      return
    }

    setPrograms(
      (data as Program[]) ?? [],
    )
    setLoading(false)
  }

  async function loadProgramContent(
    programId: number,
  ) {
    setLoading(true)
    setFeedback('')

    const { data: weekData, error: weekError } =
      await supabase
        .from('weeks')
        .select(
          'id,program_id,week_number,title',
        )
        .eq('program_id', programId)
        .order('week_number')

    if (weekError) {
      setFeedback(text.error)
      setLoading(false)
      return
    }

    const nextWeeks =
      (weekData as Week[]) ?? []

    setWeeks(nextWeeks)

    if (!nextWeeks.length) {
      setLessons([])
      setLoading(false)
      return
    }

    const { data: lessonData, error: lessonError } =
      await supabase
        .from('lessons')
        .select(
          'id,week_id,lesson_number,title,description',
        )
        .in(
          'week_id',
          nextWeeks.map(
            (item) => item.id,
          ),
        )

    if (lessonError) {
      setFeedback(text.error)
      setLoading(false)
      return
    }

    const order = new Map(
      nextWeeks.map((week) => [
        week.id,
        week.week_number,
      ]),
    )

    const nextLessons =
      ((lessonData as Lesson[]) ?? [])
        .sort((a, b) => {
          const weekDiff =
            (order.get(a.week_id) ?? 0) -
            (order.get(b.week_id) ?? 0)

          if (weekDiff !== 0) {
            return weekDiff
          }

          return (
            a.lesson_number -
            b.lesson_number
          )
        })

    setLessons(nextLessons)
    setLoading(false)
  }

  async function loadExercises(
    lessonId: number,
  ) {
    setLoading(true)

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
      setLoading(false)
      return
    }

    setExercises(
      (data as Exercise[]) ?? [],
    )
    setLoading(false)
  }

  useEffect(() => {
    void loadPrograms()
  }, [])

  async function openProgram(
    programId: number,
  ) {
    setSelectedProgramId(programId)
    setSelectedLessonId(null)
    setSelectedExerciseId(null)
    setView('lessons')

    await loadProgramContent(
      programId,
    )
  }

  async function openLesson(
    lesson: Lesson,
  ) {
    setSelectedLessonId(lesson.id)
    setSelectedExerciseId(null)
    setLessonTitle(lesson.title)
    setLessonDescription(
      lesson.description ?? '',
    )
    setView('lesson')

    await loadExercises(lesson.id)
  }

  function openExercise(
    exercise: Exercise,
  ) {
    setSelectedExerciseId(exercise.id)
    setExerciseTitle(exercise.title)
    setExerciseSets(
      exercise.sets ?? '',
    )
    setExerciseReps(
      exercise.repetitions ?? '',
    )
    setExerciseRest(
      exercise.rest_seconds == null
        ? ''
        : String(
            exercise.rest_seconds,
          ),
    )
    setExerciseInstructions(
      exercise.instructions ?? '',
    )
    setExerciseRatio(
      exercise.video_ratio || '9:16',
    )
    setExerciseFit(
      exercise.video_fit || 'cover',
    )
    setExerciseVideo(null)
    setPreviewUrl('')
    setView('exercise')
  }

  function goPrograms() {
    setView('programs')
    setSelectedProgramId(null)
    setSelectedLessonId(null)
    setSelectedExerciseId(null)
    setWeeks([])
    setLessons([])
    setExercises([])
    setFeedback('')
  }

  function goLessons() {
    setView('lessons')
    setSelectedLessonId(null)
    setSelectedExerciseId(null)
    setExercises([])
    setFeedback('')
  }

  function goLesson() {
    setView('lesson')
    setSelectedExerciseId(null)
    resetExerciseForm()
    setFeedback('')
  }

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
    setFeedback(text.created)

    await loadPrograms()
    await openProgram(data.id)
  }

  async function ensureWeek() {
    if (newLessonWeekId) {
      return newLessonWeekId
    }

    if (weeks.length) {
      return weeks[0].id
    }

    if (!selectedProgramId) {
      throw new Error(
        'missing_program',
      )
    }

    const { data, error } =
      await supabase
        .from('weeks')
        .insert({
          program_id:
            selectedProgramId,
          week_number: 1,
          title: 'Semana 1',
        })
        .select('id')
        .single()

    if (error || !data) {
      throw error ||
        new Error('week_create_failed')
    }

    setWeeks([
      {
        id: data.id,
        program_id:
          selectedProgramId,
        week_number: 1,
        title: 'Semana 1',
      },
    ])

    return data.id
  }

  async function createLesson() {
    if (
      !selectedProgramId ||
      !lessonTitle.trim()
    ) {
      return
    }

    setSaving(true)
    setFeedback('')

    try {
      const weekId =
        await ensureWeek()

      const weekLessons =
        lessons.filter(
          (item) =>
            item.week_id === weekId,
        )

      const nextNumber =
        Math.max(
          0,
          ...weekLessons.map(
            (item) =>
              item.lesson_number,
          ),
        ) + 1

      const { data, error } =
        await supabase
          .from('lessons')
          .insert({
            week_id: weekId,
            lesson_number:
              nextNumber,
            title:
              lessonTitle.trim(),
            description:
              lessonDescription.trim() ||
              null,
          })
          .select(
            'id,week_id,lesson_number,title,description',
          )
          .single()

      if (error || !data) {
        throw error ||
          new Error(
            'lesson_create_failed',
          )
      }

      setFeedback(text.created)
      await loadProgramContent(
        selectedProgramId,
      )
      await openLesson(
        data as Lesson,
      )
    } catch (error) {
      console.error(
        'create lesson:',
        error,
      )
      setFeedback(text.error)
    } finally {
      setSaving(false)
    }
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
          title:
            lessonTitle.trim(),
          description:
            lessonDescription.trim() ||
            null,
        })
        .eq(
          'id',
          selectedLessonId,
        )

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
              title:
                lessonTitle.trim(),
              description:
                lessonDescription.trim() ||
                null,
            }
          : item,
      ),
    )

    setFeedback(text.saved)
  }

  async function persistExercise(
    exerciseId: number,
    oldVideoPath?: string | null,
  ) {
    const rest =
      Number(exerciseRest)

    const { error } =
      await supabase
        .from('exercises')
        .update({
          title:
            exerciseTitle.trim(),
          sets:
            exerciseSets.trim() ||
            null,
          repetitions:
            exerciseReps.trim() ||
            null,
          rest_seconds:
            exerciseRest === ''
              ? null
              : Number.isFinite(rest)
                ? rest
                : null,
          instructions:
            exerciseInstructions.trim() ||
            null,
          video_ratio:
            exerciseRatio,
          video_fit:
            exerciseFit,
        })
        .eq('id', exerciseId)

    if (error) {
      throw error
    }

    if (
      exerciseVideo &&
      selectedProgramId &&
      selectedLessonId
    ) {
      setUploadState({
        id: exerciseId,
        progress: 0,
        message: text.upload,
      })

      await uploadMultipart({
        exerciseId,
        programId:
          selectedProgramId,
        lessonId:
          selectedLessonId,
        file: exerciseVideo,
        oldKey:
          oldVideoPath || null,
        onProgress: (progress) =>
          setUploadState({
            id: exerciseId,
            progress,
            message:
              text.upload,
          }),
      })

      setUploadState(null)
    }
  }

  async function createExercise() {
    if (
      !selectedLessonId ||
      !selectedProgramId ||
      !exerciseTitle.trim()
    ) {
      return
    }

    setSaving(true)
    setFeedback('')

    try {
      const sortOrder =
        Math.max(
          0,
          ...exercises.map(
            (item) =>
              item.sort_order,
          ),
        ) + 1

      const rest =
        Number(exerciseRest)

      const { data, error } =
        await supabase
          .from('exercises')
          .insert({
            lesson_id:
              selectedLessonId,
            title:
              exerciseTitle.trim(),
            sets:
              exerciseSets.trim() ||
              null,
            repetitions:
              exerciseReps.trim() ||
              null,
            rest_seconds:
              exerciseRest === ''
                ? null
                : Number.isFinite(rest)
                  ? rest
                  : null,
            instructions:
              exerciseInstructions.trim() ||
              null,
            video_ratio:
              exerciseRatio,
            video_fit:
              exerciseFit,
            sort_order:
              sortOrder,
          })
          .select(
            'id,video_path',
          )
          .single()

      if (error || !data) {
        throw error ||
          new Error(
            'exercise_create_failed',
          )
      }

      if (exerciseVideo) {
        setUploadState({
          id: 'new',
          progress: 0,
          message: text.upload,
        })

        await uploadMultipart({
          exerciseId: data.id,
          programId:
            selectedProgramId,
          lessonId:
            selectedLessonId,
          file: exerciseVideo,
          onProgress: (progress) =>
            setUploadState({
              id: 'new',
              progress,
              message:
                text.upload,
            }),
        })

        setUploadState(null)
      }

      setFeedback(text.created)
      await loadExercises(
        selectedLessonId,
      )
      resetExerciseForm()
      setView('lesson')
    } catch (error) {
      console.error(
        'create exercise:',
        error,
      )
      setUploadState(null)
      setFeedback(
        exerciseVideo
          ? text.videoError
          : text.error,
      )
    } finally {
      setSaving(false)
    }
  }

  async function saveExercise() {
    if (
      !selectedExercise ||
      !exerciseTitle.trim()
    ) {
      return
    }

    setSaving(true)
    setFeedback('')

    try {
      await persistExercise(
        selectedExercise.id,
        selectedExercise.video_path,
      )

      await loadExercises(
        selectedExercise.lesson_id,
      )

      setFeedback(text.saved)
      setExerciseVideo(null)

      if (
        videoInputRef.current
      ) {
        videoInputRef.current.value = ''
      }
    } catch (error) {
      console.error(
        'save exercise:',
        error,
      )
      setUploadState(null)
      setFeedback(
        exerciseVideo
          ? text.videoError
          : text.error,
      )
    } finally {
      setSaving(false)
    }
  }

  async function togglePreview() {
    if (!selectedExercise) return

    if (previewUrl) {
      setPreviewUrl('')
      return
    }

    if (selectedExercise.video_url) {
      setPreviewUrl(
        selectedExercise.video_url,
      )
      return
    }

    if (!selectedExercise.video_path) {
      return
    }

    try {
      const data =
        await invokeR2({
          action: 'play',
          exercise_id:
            selectedExercise.id,
        })

      const url =
        String(data?.url || '')

      if (url) {
        setPreviewUrl(url)
      }
    } catch (error) {
      console.error(
        'preview:',
        error,
      )
      setFeedback(text.error)
    }
  }

  function chooseVideo(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file =
      event.currentTarget.files?.[0] ??
      null

    if (!file) {
      setExerciseVideo(null)
      return
    }

    try {
      getVideoMeta(file)
      setExerciseVideo(file)
    } catch {
      setExerciseVideo(null)
      event.currentTarget.value = ''
      setFeedback(text.videoError)
    }
  }

  async function deleteExercise() {
    if (!selectedExercise) return

    setSaving(true)

    if (
      selectedExercise.video_path
    ) {
      await invokeR2({
        action: 'delete',
        key:
          selectedExercise.video_path,
      }).catch(() => null)
    }

    const { error } =
      await supabase
        .from('exercises')
        .delete()
        .eq(
          'id',
          selectedExercise.id,
        )

    setSaving(false)

    if (error) {
      setFeedback(text.error)
      return
    }

    if (selectedLessonId) {
      await loadExercises(
        selectedLessonId,
      )
    }

    resetExerciseForm()
    setSelectedExerciseId(null)
    setView('lesson')
    setFeedback(text.saved)
  }

  async function deleteLesson() {
    if (!selectedLesson) return

    setSaving(true)

    await Promise.all(
      exercises
        .filter(
          (item) =>
            item.video_path,
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
        .eq(
          'id',
          selectedLesson.id,
        )

    setSaving(false)

    if (error) {
      setFeedback(text.error)
      return
    }

    if (selectedProgramId) {
      await loadProgramContent(
        selectedProgramId,
      )
    }

    setSelectedLessonId(null)
    setExercises([])
    setView('lessons')
    setFeedback(text.saved)
  }

  function flowStepIndex() {
    if (
      view === 'programs' ||
      view === 'new-program'
    ) {
      return 0
    }

    if (
      view === 'lessons' ||
      view === 'new-lesson'
    ) {
      return 1
    }

    if (view === 'lesson') {
      return 2
    }

    return 3
  }

  function header(
    backLabel?: string,
    onBack?: () => void,
    title?: string,
    subtitle?: string,
  ) {
    const currentStep =
      flowStepIndex()

    const steps = [
      text.activeMethods,
      text.lessons,
      text.exercises,
      text.video,
    ]

    return (
      <header className="rvFlowHeader">
        <div className="rvFlowHeaderTop">
          <div className="rvFlowHeaderCopy">
            <span>{text.content}</span>
            <h2>{title}</h2>
            {subtitle && (
              <p>{subtitle}</p>
            )}
          </div>

          {onBack && (
            <button
              type="button"
              className="rvFlowBack"
              onClick={onBack}
            >
              <ArrowLeft size={16} />
              {backLabel}
            </button>
          )}
        </div>

        <div
          className="rvFlowStepper"
          aria-label={text.stepHelp}
        >
          {steps.map(
            (step, index) => (
              <div
                className={[
                  'rvFlowStep',
                  index < currentStep
                    ? 'done'
                    : '',
                  index === currentStep
                    ? 'active'
                    : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                key={step}
              >
                <b>{index + 1}</b>
                <span>{step}</span>
              </div>
            ),
          )}
        </div>

        {(selectedProgram ||
          selectedLesson) && (
          <div className="rvFlowContextPath">
            {selectedProgram && (
              <span>
                {selectedProgram.title}
              </span>
            )}

            {selectedProgram &&
              selectedLesson && (
                <ChevronRight size={13} />
              )}

            {selectedLesson && (
              <span>
                {selectedLesson.title}
              </span>
            )}
          </div>
        )}
      </header>
    )
  }

  function feedbackBox() {
    if (!feedback) return null

    return (
      <div
        className="rvFlowFeedback"
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
    )
  }

  function uploadProgress() {
    if (!uploadState) return null

    return (
      <div className="rvFlowUpload">
        <div>
          <span>
            {uploadState.message}
          </span>
          <strong>
            {uploadState.progress}%
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
    )
  }

  function videoField(
    existingVideo: boolean,
  ) {
    return (
      <section className="rvFlowVideoBox">
        <div className="rvFlowVideoTitle">
          <FileVideo size={21} />
          <span>
            <strong>
              {text.video}
            </strong>
            <small>
              {exerciseVideo
                ? exerciseVideo.name
                : existingVideo
                  ? text.videoReady
                  : text.noVideo}
            </small>
          </span>
        </div>

        {previewUrl && (
          <video
            controls
            playsInline
            preload="metadata"
            src={previewUrl}
          />
        )}

        <div className="rvFlowVideoActions">
          {existingVideo &&
            selectedExercise && (
              <button
                type="button"
                onClick={() =>
                  void togglePreview()
                }
              >
                <Play size={16} />
                {previewUrl
                  ? text.closeVideo
                  : text.previewVideo}
              </button>
            )}

          <label>
            <Upload size={16} />
            {existingVideo ||
            exerciseVideo
              ? text.changeVideo
              : text.selectVideo}
            <input
              ref={videoInputRef}
              type="file"
              accept=".mp4,.mov,.webm,video/mp4,video/quicktime,video/webm"
              onChange={chooseVideo}
            />
          </label>
        </div>

        {uploadProgress()}
      </section>
    )
  }

  async function confirmDeleteRequest() {
    const request = deleteRequest

    if (!request) return

    if (request === 'lesson') {
      await deleteLesson()
    } else {
      await deleteExercise()
    }

    setDeleteRequest(null)
  }

  function deleteConfirmModal() {
    if (!deleteRequest) return null

    const lessonDelete =
      deleteRequest === 'lesson'

    return (
      <RvConfirmModal
        eyebrow={text.advanced}
        title={
          lessonDelete
            ? text.deleteLesson
            : text.deleteExercise
        }
        text={
          lessonDelete
            ? text.confirmDeleteLesson
            : text.confirmDeleteExercise
        }
        confirmLabel={
          lessonDelete
            ? text.deleteLesson
            : text.deleteExercise
        }
        cancelLabel="Cancelar"
        danger
        busy={saving}
        onCancel={() =>
          setDeleteRequest(null)
        }
        onConfirm={() =>
          void confirmDeleteRequest()
        }
      />
    )
  }

  if (loading) {
    return (
      <RvLoadingState
        title={text.content}
        text={text.activeMethodsHelp}
      />
    )
  }

  if (view === 'programs') {
    return (
      <div className="rvFlowEditor">
        {header(
          undefined,
          undefined,
          text.activeMethods,
          text.activeMethodsHelp,
        )}

        {feedbackBox()}
        {deleteConfirmModal()}

        {programs.length === 0 ? (
          <RvEmptyState
            compact
            kind="program"
            title={
              text.noActiveMethods
            }
            text={
              text.noActiveMethodsHelp
            }
          />
        ) : (
          <div className="rvFlowList">
            {programs.map(
              (program) => (
                <button
                  type="button"
                  className="rvFlowListItem"
                  key={program.id}
                  onClick={() =>
                    void openProgram(
                      program.id,
                    )
                  }
                >
                  <span className="rvFlowListIcon">
                    {program.title
                      .charAt(0)
                      .toUpperCase()}
                  </span>

                  <span className="rvFlowListCopy">
                    <strong>
                      {program.title}
                    </strong>
                    <small>
                      {program.description ||
                        text.active}
                    </small>
                  </span>

                  <ChevronRight
                    size={20}
                  />
                </button>
              ),
            )}
          </div>
        )}

        <button
          type="button"
          className="rvFlowAdd"
          onClick={() => {
            setNewProgramTitle('')
            setNewProgramDescription('')
            setView('new-program')
          }}
        >
          <Plus size={19} />
          {text.addMethod}
        </button>
      </div>
    )
  }

  if (view === 'new-program') {
    return (
      <div className="rvFlowEditor">
        {header(
          text.backMethods,
          goPrograms,
          text.addMethod,
        )}

        {feedbackBox()}
        {deleteConfirmModal()}

        <section className="rvFlowForm">
          <label>
            {text.methodName}
            <input
              autoFocus
              value={newProgramTitle}
              onChange={(event) =>
                setNewProgramTitle(
                  event.target.value,
                )
              }
            />
          </label>

          <label>
            {text.methodDescription}
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
            className="rvFlowPrimary"
            disabled={
              saving ||
              !newProgramTitle.trim()
            }
            onClick={() =>
              void createProgram()
            }
          >
            <Save size={17} />
            {saving
              ? text.saving
              : text.createMethod}
          </button>
        </section>
      </div>
    )
  }

  if (view === 'lessons') {
    return (
      <div className="rvFlowEditor">
        {header(
          text.backMethods,
          goPrograms,
          selectedProgram?.title ||
            text.lessons,
          text.lessonsHelp,
        )}

        {feedbackBox()}
        {deleteConfirmModal()}

        {lessons.length === 0 ? (
          <div className="rvFlowEmpty">
            <strong>
              {text.noLessons}
            </strong>
            <span>
              {text.noLessonsHelp}
            </span>
          </div>
        ) : (
          <div className="rvFlowList">
            {lessons.map(
              (lesson) => {
                const week =
                  weekById.get(
                    lesson.week_id,
                  )

                return (
                  <button
                    type="button"
                    className="rvFlowListItem"
                    key={lesson.id}
                    onClick={() =>
                      void openLesson(
                        lesson,
                      )
                    }
                  >
                    <span className="rvFlowListNumber">
                      {String(
                        lesson.lesson_number,
                      ).padStart(2, '0')}
                    </span>

                    <span className="rvFlowListCopy">
                      <strong>
                        {lesson.title}
                      </strong>
                      <small>
                        {week?.title ||
                          `${text.week} ${week?.week_number ?? ''}`}
                      </small>
                    </span>

                    <ChevronRight
                      size={20}
                    />
                  </button>
                )
              },
            )}
          </div>
        )}

        <button
          type="button"
          className="rvFlowAdd"
          onClick={() => {
            setLessonTitle('')
            setLessonDescription('')
            setNewLessonWeekId(
              weeks[0]?.id ??
                null,
            )
            setView('new-lesson')
          }}
        >
          <Plus size={19} />
          {text.addLesson}
        </button>
      </div>
    )
  }

  if (view === 'new-lesson') {
    return (
      <div className="rvFlowEditor">
        {header(
          text.backLessons,
          goLessons,
          text.newLessonTitle,
        )}

        {feedbackBox()}
        {deleteConfirmModal()}

        <section className="rvFlowForm">
          <label>
            {text.lessonName}
            <input
              autoFocus
              value={lessonTitle}
              onChange={(event) =>
                setLessonTitle(
                  event.target.value,
                )
              }
            />
          </label>

          <label>
            {text.lessonGuidance}
            <textarea
              value={
                lessonDescription
              }
              onChange={(event) =>
                setLessonDescription(
                  event.target.value,
                )
              }
            />
          </label>

          {weeks.length > 1 && (
            <details className="rvFlowAdvanced">
              <summary>
                {text.organization}
              </summary>

              <label>
                {text.week}
                <select
                  value={
                    newLessonWeekId ??
                    ''
                  }
                  onChange={(event) =>
                    setNewLessonWeekId(
                      Number(
                        event.target
                          .value,
                      ),
                    )
                  }
                >
                  {weeks.map(
                    (week) => (
                      <option
                        key={week.id}
                        value={week.id}
                      >
                        {week.title ||
                          `${text.week} ${week.week_number}`}
                      </option>
                    ),
                  )}
                </select>
              </label>
            </details>
          )}

          <button
            type="button"
            className="rvFlowPrimary"
            disabled={
              saving ||
              !lessonTitle.trim()
            }
            onClick={() =>
              void createLesson()
            }
          >
            <Plus size={17} />
            {saving
              ? text.saving
              : text.createLesson}
          </button>
        </section>
      </div>
    )
  }

  if (view === 'lesson') {
    return (
      <div className="rvFlowEditor">
        {header(
          text.backLessons,
          goLessons,
          selectedLesson?.title ||
            text.backLesson,
          text.exercisesHelp,
        )}

        {feedbackBox()}
        {deleteConfirmModal()}

        <section className="rvFlowForm rvFlowLessonInfo">
          <label>
            {text.lessonName}
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
            {text.lessonGuidance}
            <textarea
              value={
                lessonDescription
              }
              onChange={(event) =>
                setLessonDescription(
                  event.target.value,
                )
              }
            />
          </label>

          <button
            type="button"
            className="rvFlowSecondary"
            disabled={
              saving ||
              !lessonTitle.trim()
            }
            onClick={() =>
              void saveLesson()
            }
          >
            <Save size={16} />
            {text.saveLesson}
          </button>
        </section>

        <section className="rvFlowSection">
          <div className="rvFlowSectionHead">
            <div>
              <span>
                {text.exercises}
              </span>
              <strong>
                {exercises.length}{' '}
                {text.exerciseCount}
              </strong>
            </div>
          </div>

          {exercises.length === 0 ? (
            <div className="rvFlowEmpty compact">
              <strong>
                {text.noExercises}
              </strong>
              <span>
                {text.noExercisesHelp}
              </span>
            </div>
          ) : (
            <div className="rvFlowList">
              {exercises.map(
                (exercise, index) => (
                  <button
                    type="button"
                    className="rvFlowListItem"
                    key={exercise.id}
                    onClick={() =>
                      openExercise(
                        exercise,
                      )
                    }
                  >
                    <span className="rvFlowListNumber">
                      {String(
                        index + 1,
                      ).padStart(2, '0')}
                    </span>

                    <span className="rvFlowListCopy">
                      <strong>
                        {exercise.title}
                      </strong>
                      <small>
                        {exercise.sets ||
                          '—'}
                        {' × '}
                        {exercise.repetitions ||
                          '—'}
                        {' · '}
                        {exercise.video_path ||
                        exercise.video_url
                          ? text.videoReady
                          : text.noVideo}
                      </small>
                    </span>

                    <ChevronRight
                      size={20}
                    />
                  </button>
                ),
              )}
            </div>
          )}

          <button
            type="button"
            className="rvFlowAdd"
            onClick={() => {
              resetExerciseForm()
              setView(
                'new-exercise',
              )
            }}
          >
            <Plus size={19} />
            {text.addExercise}
          </button>
        </section>

        <details className="rvFlowAdvanced danger">
          <summary>
            {text.advanced}
          </summary>

          <button
            type="button"
            className="rvFlowDanger"
            disabled={saving}
            onClick={() =>
              setDeleteRequest('lesson')
            }
          >
            <Trash2 size={16} />
            {text.deleteLesson}
          </button>
        </details>
      </div>
    )
  }

  const isNewExercise =
    view === 'new-exercise'

  if (
    view === 'exercise' ||
    isNewExercise
  ) {
    const hasExistingVideo =
      Boolean(
        selectedExercise?.video_path ||
        selectedExercise?.video_url,
      )

    return (
      <div className="rvFlowEditor">
        {header(
          text.backLesson,
          goLesson,
          isNewExercise
            ? text.newExerciseTitle
            : selectedExercise?.title ||
              text.exerciseName,
          undefined,
        )}

        {feedbackBox()}
        {deleteConfirmModal()}

        <section className="rvFlowForm">
          <label>
            {text.exerciseName}
            <input
              autoFocus={
                isNewExercise
              }
              value={exerciseTitle}
              onChange={(event) =>
                setExerciseTitle(
                  event.target.value,
                )
              }
            />
          </label>

          <div className="rvFlowTwo">
            <label>
              {text.sets}
              <input
                value={exerciseSets}
                onChange={(event) =>
                  setExerciseSets(
                    event.target.value,
                  )
                }
              />
            </label>

            <label>
              {text.reps}
              <input
                value={exerciseReps}
                onChange={(event) =>
                  setExerciseReps(
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
              value={exerciseRest}
              onChange={(event) =>
                setExerciseRest(
                  event.target.value,
                )
              }
            />
          </label>

          <label>
            {text.instructions}
            <textarea
              value={
                exerciseInstructions
              }
              onChange={(event) =>
                setExerciseInstructions(
                  event.target.value,
                )
              }
            />
          </label>

          {videoField(
            hasExistingVideo,
          )}

          <details className="rvFlowAdvanced">
            <summary>
              {text.advanced}
            </summary>

            <div className="rvFlowAdvancedBody">
              <div className="rvFlowTwo">
                <label>
                  {text.videoFormat}
                  <select
                    value={
                      exerciseRatio
                    }
                    onChange={(event) =>
                      setExerciseRatio(
                        event.target
                          .value as typeof exerciseRatio,
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
                  {text.videoFit}
                  <select
                    value={
                      exerciseFit
                    }
                    onChange={(event) =>
                      setExerciseFit(
                        event.target
                          .value as typeof exerciseFit,
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

              {!isNewExercise && (
                <button
                  type="button"
                  className="rvFlowDanger"
                  disabled={saving}
                  onClick={() =>
                    setDeleteRequest('exercise')
                  }
                >
                  <Trash2 size={16} />
                  {text.deleteExercise}
                </button>
              )}
            </div>
          </details>

          <button
            type="button"
            className="rvFlowPrimary"
            disabled={
              saving ||
              !exerciseTitle.trim()
            }
            onClick={() =>
              isNewExercise
                ? void createExercise()
                : void saveExercise()
            }
          >
            <Save size={17} />
            {saving
              ? text.saving
              : isNewExercise
                ? text.createExercise
                : text.saveExercise}
          </button>
        </section>
      </div>
    )
  }

  return null
}
