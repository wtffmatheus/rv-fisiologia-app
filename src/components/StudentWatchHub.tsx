import {
  Activity,
  CheckCircle2,
  CloudUpload,
  HeartPulse,
  ShieldCheck,
  Smartphone,
  Watch,
} from 'lucide-react'
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
      eyebrow: 'APPLE WATCH + APPLE SAÚDE',
      title: 'Seus dados do Apple Watch no RV.',
      description:
        'Sem pareamento direto com o relógio. O Apple Watch registra, o Apple Saúde recebe no iPhone e o Atalho RV envia as informações autorizadas para sua conta.',
      status: 'Integração via Apple Saúde',
      routeLabel: 'FLUXO ATUAL',
      route: 'Watch → Apple Saúde → Atalho RV → RV App',
      flowTitle: 'Como os dados chegam ao RV',
      flowText:
        'Esse é o caminho usado de verdade hoje. Não dependemos de Bluetooth no navegador nem de um aplicativo próprio para watchOS.',
      watchStep: 'Apple Watch registra',
      watchStepText: 'O relógio mede e salva os dados de saúde normalmente.',
      healthStep: 'Apple Saúde recebe',
      healthStepText: 'As leituras ficam disponíveis no app Saúde do iPhone.',
      shortcutStep: 'Atalho RV envia',
      shortcutStepText: 'O atalho lê somente o que o aluno autorizou e envia ao RV.',
      rvStep: 'RV atualiza',
      rvStepText: 'Os dados aparecem abaixo e ficam vinculados ao aluno.',
      truthTitle: 'Sem conexão direta com o relógio',
      truthText:
        'O Safari/PWA do iPhone não oferece uma ponte direta com o Apple Watch. Por isso esta tela não tenta mais procurar Bluetooth, parear o Watch ou mostrar uma conexão que não existe.',
      privacyTitle: 'Privacidade sob controle',
      privacyText:
        'As permissões são escolhidas no Apple Saúde. A chave do RV pode ser revogada a qualquer momento.',
      readyTitle: 'Disponível agora',
      readyText:
        'Frequência cardíaca pelo Apple Saúde/Atalhos e registro manual da pressão OMRON.',
      noAppTitle: 'Sem app extra no Watch',
      noAppText:
        'Para este fluxo de dados não é necessário instalar um aplicativo RV no Apple Watch.',
    },
    en: {
      eyebrow: 'APPLE WATCH + APPLE HEALTH',
      title: 'Your Apple Watch data in RV.',
      description:
        'No direct watch pairing. Apple Watch records, Apple Health receives the data on iPhone and the RV Shortcut sends authorized information to your account.',
      status: 'Apple Health integration',
      routeLabel: 'CURRENT FLOW',
      route: 'Watch → Apple Health → RV Shortcut → RV App',
      flowTitle: 'How data reaches RV',
      flowText:
        'This is the flow used today. It does not rely on browser Bluetooth or a custom watchOS app.',
      watchStep: 'Apple Watch records',
      watchStepText: 'The watch measures and stores health data normally.',
      healthStep: 'Apple Health receives',
      healthStepText: 'Readings become available in the iPhone Health app.',
      shortcutStep: 'RV Shortcut sends',
      shortcutStepText: 'The shortcut reads only authorized data and sends it to RV.',
      rvStep: 'RV updates',
      rvStepText: 'Data appears below and stays linked to the student.',
      truthTitle: 'No direct watch connection',
      truthText:
        'Safari/PWA on iPhone does not expose a direct Apple Watch bridge. This screen no longer searches for Bluetooth, pairs the Watch or displays a connection that does not exist.',
      privacyTitle: 'Privacy under control',
      privacyText:
        'Permissions are selected in Apple Health. The RV sending key can be revoked at any time.',
      readyTitle: 'Available now',
      readyText:
        'Heart rate via Apple Health/Shortcuts and manual OMRON blood pressure entry.',
      noAppTitle: 'No extra Watch app',
      noAppText:
        'This data flow does not require an RV app to be installed on Apple Watch.',
    },
    es: {
      eyebrow: 'APPLE WATCH + APPLE SALUD',
      title: 'Tus datos del Apple Watch en RV.',
      description:
        'Sin emparejamiento directo con el reloj. Apple Watch registra, Apple Salud recibe en el iPhone y el Atajo RV envía la información autorizada.',
      status: 'Integración vía Apple Salud',
      routeLabel: 'FLUJO ACTUAL',
      route: 'Watch → Apple Salud → Atajo RV → RV App',
      flowTitle: 'Cómo llegan los datos a RV',
      flowText:
        'Este es el flujo usado actualmente, sin Bluetooth del navegador ni una app watchOS propia.',
      watchStep: 'Apple Watch registra',
      watchStepText: 'El reloj mide y guarda los datos de salud.',
      healthStep: 'Apple Salud recibe',
      healthStepText: 'Las lecturas quedan disponibles en Salud del iPhone.',
      shortcutStep: 'Atajo RV envía',
      shortcutStepText: 'El atajo lee solo los datos autorizados y los envía a RV.',
      rvStep: 'RV actualiza',
      rvStepText: 'Los datos aparecen abajo y quedan vinculados al alumno.',
      truthTitle: 'Sin conexión directa al reloj',
      truthText:
        'Safari/PWA no ofrece un puente directo con Apple Watch. Esta pantalla ya no busca Bluetooth, no empareja el Watch y no muestra una conexión inexistente.',
      privacyTitle: 'Privacidad bajo control',
      privacyText:
        'Los permisos se eligen en Apple Salud y la clave de RV puede revocarse.',
      readyTitle: 'Disponible ahora',
      readyText:
        'Frecuencia cardíaca por Apple Salud/Atajos y presión OMRON manual.',
      noAppTitle: 'Sin app extra en el Watch',
      noAppText:
        'Este flujo no necesita una app RV instalada en Apple Watch.',
    },
    'zh-CN': {
      eyebrow: 'APPLE WATCH + APPLE 健康',
      title: 'Apple Watch 数据进入 RV。',
      description:
        '无需与手表直接配对。Apple Watch 负责记录，iPhone 上的 Apple 健康负责接收，RV 快捷指令再发送已授权的信息。',
      status: '通过 Apple 健康集成',
      routeLabel: '当前流程',
      route: 'Watch → Apple 健康 → RV 快捷指令 → RV App',
      flowTitle: '数据如何进入 RV',
      flowText: '这是当前实际使用的流程，不依赖浏览器蓝牙，也不需要独立的 watchOS 应用。',
      watchStep: 'Apple Watch 记录',
      watchStepText: '手表正常测量并保存健康数据。',
      healthStep: 'Apple 健康接收',
      healthStepText: '读数会出现在 iPhone 的健康 App 中。',
      shortcutStep: 'RV 快捷指令发送',
      shortcutStepText: '快捷指令只读取已授权的数据并发送到 RV。',
      rvStep: 'RV 更新',
      rvStepText: '数据会显示在下方并关联到学员。',
      truthTitle: '无需直接连接手表',
      truthText:
        'iPhone 上的 Safari/PWA 不提供 Apple Watch 的直接桥接，因此本页面不再搜索蓝牙、不再尝试配对，也不会显示不存在的连接。',
      privacyTitle: '隐私可控',
      privacyText: '权限由学员在 Apple 健康中选择，RV 发送密钥也可以随时撤销。',
      readyTitle: '当前可用',
      readyText: '通过 Apple 健康/快捷指令接收心率，以及手动记录 OMRON 血压。',
      noAppTitle: '无需额外 Watch App',
      noAppText: '此数据流程不需要在 Apple Watch 上安装 RV App。',
    },
    de: {
      eyebrow: 'APPLE WATCH + APPLE HEALTH',
      title: 'Apple-Watch-Daten im RV.',
      description:
        'Keine direkte Kopplung mit der Uhr. Die Apple Watch zeichnet auf, Apple Health empfängt auf dem iPhone und der RV-Kurzbefehl sendet freigegebene Daten.',
      status: 'Integration über Apple Health',
      routeLabel: 'AKTUELLER ABLAUF',
      route: 'Watch → Apple Health → RV-Kurzbefehl → RV App',
      flowTitle: 'So gelangen Daten zu RV',
      flowText:
        'Dieser Ablauf wird heute tatsächlich verwendet, ohne Browser-Bluetooth und ohne eigene watchOS-App.',
      watchStep: 'Apple Watch zeichnet auf',
      watchStepText: 'Die Uhr misst und speichert Gesundheitsdaten normal.',
      healthStep: 'Apple Health empfängt',
      healthStepText: 'Messwerte stehen in der Health-App des iPhones bereit.',
      shortcutStep: 'RV-Kurzbefehl sendet',
      shortcutStepText: 'Der Kurzbefehl liest nur freigegebene Daten und sendet sie an RV.',
      rvStep: 'RV aktualisiert',
      rvStepText: 'Daten erscheinen unten und bleiben dem Schüler zugeordnet.',
      truthTitle: 'Keine direkte Watch-Verbindung',
      truthText:
        'Safari/PWA auf dem iPhone bietet keine direkte Apple-Watch-Brücke. Diese Seite sucht daher nicht mehr nach Bluetooth, koppelt die Watch nicht und zeigt keine erfundene Verbindung.',
      privacyTitle: 'Datenschutz unter Kontrolle',
      privacyText:
        'Berechtigungen werden in Apple Health gewählt. Der RV-Sendeschlüssel kann jederzeit widerrufen werden.',
      readyTitle: 'Jetzt verfügbar',
      readyText:
        'Herzfrequenz über Apple Health/Kurzbefehle und manuelle OMRON-Blutdruckeingabe.',
      noAppTitle: 'Keine zusätzliche Watch-App',
      noAppText:
        'Für diesen Datenfluss muss keine RV-App auf der Apple Watch installiert werden.',
    },
  } as const

  const t = labels[language]

  return (
    <section className="rvWatchPage" data-rv-watch-hub="health-v18">
      <section className="rvWatchHero rvWatchHealthHero">
        <div className="rvWatchHeroCopy">
          <div className="rvWatchEyebrow">
            <Watch size={14} />
            {t.eyebrow}
          </div>

          <h1>{t.title}</h1>
          <p>{t.description}</p>

          <div className="rvWatchConnectionState state-bridge">
            <span className="rvWatchConnectionDot" />
            {t.status}
          </div>
        </div>

        <div className="rvWatchFlowRoute">
          <span>{t.routeLabel}</span>
          <HeartPulse size={27} />
          <strong>{t.route}</strong>
        </div>
      </section>

      <section className="rvWatchFeaturesSection">
        <div className="rvWatchSectionHead">
          <div>
            <span>APPLE HEALTH</span>
            <h2>{t.flowTitle}</h2>
          </div>
          <Activity size={20} />
        </div>

        <p>{t.flowText}</p>

        <div className="rvWatchDataGrid rvWatchHealthFlowGrid">
          <article>
            <span>1 · APPLE WATCH</span>
            <strong>{t.watchStep}</strong>
            <small>{t.watchStepText}</small>
          </article>

          <article>
            <span>2 · IPHONE</span>
            <strong>{t.healthStep}</strong>
            <small>{t.healthStepText}</small>
          </article>

          <article>
            <span>3 · ATALHO RV</span>
            <strong>{t.shortcutStep}</strong>
            <small>{t.shortcutStepText}</small>
          </article>

          <article>
            <span>4 · RV APP</span>
            <strong>{t.rvStep}</strong>
            <small>{t.rvStepText}</small>
          </article>
        </div>
      </section>

      <section className="rvWatchArchitecture">
        <div className="rvWatchSectionHead">
          <div>
            <span>TRANSPARÊNCIA</span>
            <h2>{t.truthTitle}</h2>
          </div>
          <ShieldCheck size={20} />
        </div>

        <p className="rvWatchTruthNote">
          <ShieldCheck size={16} />
          <span>{t.truthText}</span>
        </p>

        <div className="rvWatchFeatureGrid">
          <article>
            <div className="rvWatchFeatureIcon">
              <Smartphone size={17} />
            </div>
            <strong>{t.privacyTitle}</strong>
            <p>{t.privacyText}</p>
          </article>

          <article>
            <div className="rvWatchFeatureIcon">
              <CloudUpload size={17} />
            </div>
            <strong>{t.readyTitle}</strong>
            <p>{t.readyText}</p>
          </article>

          <article>
            <div className="rvWatchFeatureIcon">
              <CheckCircle2 size={17} />
            </div>
            <strong>{t.noAppTitle}</strong>
            <p>{t.noAppText}</p>
          </article>
        </div>
      </section>

      <StudentHealthData studentId={studentId} />
    </section>
  )
}
