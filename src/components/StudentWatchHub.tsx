import { HeartPulse, Watch } from 'lucide-react'
import { useI18n } from '../i18n'
import StudentHealthData from './StudentHealthData'

type StudentWatchHubProps = {
  studentId: string
  studentName: string
  programTitle: string
  progress: number
  completedLessons: number
  totalLessons: number
  nextLesson: {
    number: number
    title: string
    exercises: number
  } | null
}

export default function StudentWatchHub({
  studentId,
}: StudentWatchHubProps) {
  const { language } = useI18n()

  const labels = {
    'pt-BR': {
      title: 'Apple Watch',
      subtitle: 'Seus dados de treino em um só lugar.',
      badge: 'Dados pelo Apple Saúde',
    },
    en: {
      title: 'Apple Watch',
      subtitle: 'Your workout data in one place.',
      badge: 'Data via Apple Health',
    },
    es: {
      title: 'Apple Watch',
      subtitle: 'Tus datos de entrenamiento en un solo lugar.',
      badge: 'Datos vía Apple Salud',
    },
    'zh-CN': {
      title: 'Apple Watch',
      subtitle: '训练数据集中显示。',
      badge: '通过 Apple 健康',
    },
    de: {
      title: 'Apple Watch',
      subtitle: 'Deine Trainingsdaten an einem Ort.',
      badge: 'Daten über Apple Health',
    },
  } as const

  const t = labels[language]

  return (
    <section className="rvWatchSimplePage" data-rv-watch-hub="simple-v20">
      <header className="rvWatchSimpleHeader">
        <div>
          <span className="rvWatchSimpleEyebrow">
            <Watch size={14} />
            {t.title}
          </span>
          <h1>{t.subtitle}</h1>
        </div>

        <span className="rvWatchSimpleBadge">
          <HeartPulse size={14} />
          {t.badge}
        </span>
      </header>

      <StudentHealthData studentId={studentId} />
    </section>
  )
}
