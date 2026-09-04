import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react'

export type AppLanguage = 'pt-BR' | 'en' | 'es' | 'zh-CN' | 'de'

export const languages: Array<{ value: AppLanguage; name: string; locale: string }> = [
  { value: 'pt-BR', name: 'Português (Brasil)', locale: 'pt-BR' },
  { value: 'en', name: 'English', locale: 'en-US' },
  { value: 'es', name: 'Español', locale: 'es-ES' },
  { value: 'zh-CN', name: '中文（简体）', locale: 'zh-CN' },
  { value: 'de', name: 'Deutsch', locale: 'de-DE' },
]

const pt = {
  navDashboard:'Início', navStudents:'Alunos', navContent:'Conteúdo', navSettings:'Ajustes', navHome:'Início', navProgram:'Programa', navProfile:'Perfil',
  languageTitle:'Idioma do aplicativo', languageHelp:'Escolha o idioma usado nos menus, botões, mensagens e datas.', languageSaved:'Idioma atualizado.', languageError:'Não foi possível alterar o idioma agora.',
  settingsTitle:'Configurações', settingsSubtitle:'Conta, preferências e recursos deste dispositivo.', preferences:'Preferências', notifications:'Notificações', app:'Aplicativo', session:'Sessão', admin:'Administrador', version:'Versão publicada', logout:'Sair da conta',
  loginTitle:'Acesse sua conta', registerTitle:'Crie sua conta', forgotTitle:'Recupere sua senha', loginHelp:'Entre com seu e-mail e senha.', registerHelp:'Crie sua conta e escolha o idioma do aplicativo.', forgotHelp:'Informe o e-mail da sua conta para receber o link de recuperação.',
  name:'Nome', email:'E-mail', password:'Senha', signIn:'Entrar', create:'Criar cadastro', sendRecovery:'Enviar link de recuperação', wait:'Aguarde...', forgot:'Esqueci minha senha', noAccount:'Ainda não tem conta? Cadastre-se', hasAccount:'Já possui cadastro? Entrar', backLogin:'Voltar para entrar',
  pending:'Seu acesso está em análise.', blocked:'Seu acesso está bloqueado.', registrationReceived:'CADASTRO RECEBIDO', accessPaused:'ACESSO PAUSADO',
  myProfile:'MEU PERFIL', profileHelp:'Informações da sua conta e do acompanhamento atual.', methodology:'Metodologia', programStart:'Início do programa', progress:'Progresso', activeAccess:'Acesso ativo',
  dashboard:'Dashboard', dashboardHelp:'Acompanhe alunos, acessos e conteúdo da plataforma.', activeStudents:'Alunos ativos', awaiting:'Aguardando aprovação', activeMethods:'Metodologias ativas', blockedStudents:'Bloqueados', avgProgress:'Progresso médio', recent:'Últimas conclusões', newRegistrations:'Novos cadastros', studentBase:'Base de alunos', refresh:'Atualizar dados',
}

const dictionaries = {
  'pt-BR': pt,
  en: { ...pt,
    navDashboard:'Home', navStudents:'Students', navContent:'Content', navSettings:'Settings', navHome:'Home', navProgram:'Program', navProfile:'Profile',
    languageTitle:'App language', languageHelp:'Choose the language used in menus, buttons, messages and dates.', languageSaved:'Language updated.', languageError:'Could not change the language right now.',
    settingsTitle:'Settings', settingsSubtitle:'Account, preferences and features for this device.', preferences:'Preferences', notifications:'Notifications', app:'App', session:'Session', admin:'Administrator', version:'Published version', logout:'Sign out',
    loginTitle:'Sign in to your account', registerTitle:'Create your account', forgotTitle:'Recover your password', loginHelp:'Enter your email and password.', registerHelp:'Create your account and choose the app language.', forgotHelp:'Enter your account email to receive a recovery link.',
    name:'Name', email:'Email', password:'Password', signIn:'Sign in', create:'Create account', sendRecovery:'Send recovery link', wait:'Please wait...', forgot:'Forgot my password', noAccount:'No account yet? Sign up', hasAccount:'Already registered? Sign in', backLogin:'Back to sign in',
    pending:'Your access is under review.', blocked:'Your access is blocked.', registrationReceived:'REGISTRATION RECEIVED', accessPaused:'ACCESS PAUSED', myProfile:'MY PROFILE', profileHelp:'Your account and current training information.', methodology:'Methodology', programStart:'Program start', progress:'Progress', activeAccess:'Active access',
    dashboard:'Dashboard', dashboardHelp:'Track students, access and platform content.', activeStudents:'Active students', awaiting:'Awaiting approval', activeMethods:'Active methodologies', blockedStudents:'Blocked', avgProgress:'Average progress', recent:'Recent completions', newRegistrations:'New registrations', studentBase:'Student base', refresh:'Refresh data',
  },
  es: { ...pt,
    navDashboard:'Inicio', navStudents:'Alumnos', navContent:'Contenido', navSettings:'Ajustes', navHome:'Inicio', navProgram:'Programa', navProfile:'Perfil',
    languageTitle:'Idioma de la aplicación', languageHelp:'Elige el idioma de menús, botones, mensajes y fechas.', languageSaved:'Idioma actualizado.', languageError:'No se pudo cambiar el idioma ahora.',
    settingsTitle:'Ajustes', settingsSubtitle:'Cuenta, preferencias y recursos de este dispositivo.', preferences:'Preferencias', notifications:'Notificaciones', app:'Aplicación', session:'Sesión', admin:'Administrador', version:'Versión publicada', logout:'Cerrar sesión',
    loginTitle:'Accede a tu cuenta', registerTitle:'Crea tu cuenta', forgotTitle:'Recupera tu contraseña', loginHelp:'Ingresa con tu correo y contraseña.', registerHelp:'Crea tu cuenta y elige el idioma de la aplicación.', forgotHelp:'Ingresa el correo de tu cuenta para recibir el enlace de recuperación.',
    name:'Nombre', email:'Correo', password:'Contraseña', signIn:'Entrar', create:'Crear cuenta', sendRecovery:'Enviar enlace', wait:'Espera...', forgot:'Olvidé mi contraseña', noAccount:'¿Aún no tienes cuenta? Regístrate', hasAccount:'¿Ya tienes cuenta? Entrar', backLogin:'Volver al acceso',
    pending:'Tu acceso está en revisión.', blocked:'Tu acceso está bloqueado.', registrationReceived:'REGISTRO RECIBIDO', accessPaused:'ACCESO PAUSADO', myProfile:'MI PERFIL', profileHelp:'Información de tu cuenta y seguimiento actual.', methodology:'Metodología', programStart:'Inicio del programa', progress:'Progreso', activeAccess:'Acceso activo',
    dashboard:'Panel', dashboardHelp:'Sigue alumnos, accesos y contenido de la plataforma.', activeStudents:'Alumnos activos', awaiting:'Pendientes de aprobación', activeMethods:'Metodologías activas', blockedStudents:'Bloqueados', avgProgress:'Progreso medio', recent:'Últimas finalizaciones', newRegistrations:'Nuevos registros', studentBase:'Base de alumnos', refresh:'Actualizar datos',
  },
  'zh-CN': { ...pt,
    navDashboard:'首页', navStudents:'学员', navContent:'内容', navSettings:'设置', navHome:'首页', navProgram:'课程', navProfile:'我的',
    languageTitle:'应用语言', languageHelp:'选择菜单、按钮、消息和日期使用的语言。', languageSaved:'语言已更新。', languageError:'暂时无法更改语言。',
    settingsTitle:'设置', settingsSubtitle:'管理账户、偏好设置和当前设备功能。', preferences:'偏好设置', notifications:'通知', app:'应用', session:'会话', admin:'管理员', version:'发布版本', logout:'退出登录',
    loginTitle:'登录账户', registerTitle:'创建账户', forgotTitle:'找回密码', loginHelp:'请输入邮箱和密码。', registerHelp:'创建账户并选择应用语言。', forgotHelp:'输入账户邮箱以接收密码重置链接。',
    name:'姓名', email:'邮箱', password:'密码', signIn:'登录', create:'创建账户', sendRecovery:'发送重置链接', wait:'请稍候...', forgot:'忘记密码', noAccount:'还没有账户？注册', hasAccount:'已有账户？登录', backLogin:'返回登录',
    pending:'你的访问权限正在审核中。', blocked:'你的访问权限已被暂停。', registrationReceived:'注册已收到', accessPaused:'访问已暂停', myProfile:'我的资料', profileHelp:'账户信息和当前训练进度。', methodology:'训练方案', programStart:'开始日期', progress:'进度', activeAccess:'访问正常',
    dashboard:'控制台', dashboardHelp:'查看学员、访问状态和平台内容。', activeStudents:'活跃学员', awaiting:'待审核', activeMethods:'启用方案', blockedStudents:'已停用', avgProgress:'平均进度', recent:'最近完成', newRegistrations:'新注册', studentBase:'学员概览', refresh:'刷新数据',
  },
  de: { ...pt,
    navDashboard:'Start', navStudents:'Schüler', navContent:'Inhalte', navSettings:'Einstellungen', navHome:'Start', navProgram:'Programm', navProfile:'Profil',
    languageTitle:'App-Sprache', languageHelp:'Wähle die Sprache für Menüs, Schaltflächen, Meldungen und Datumsangaben.', languageSaved:'Sprache aktualisiert.', languageError:'Die Sprache konnte gerade nicht geändert werden.',
    settingsTitle:'Einstellungen', settingsSubtitle:'Konto, Einstellungen und Funktionen dieses Geräts.', preferences:'Präferenzen', notifications:'Benachrichtigungen', app:'App', session:'Sitzung', admin:'Administrator', version:'Veröffentlichte Version', logout:'Abmelden',
    loginTitle:'Bei deinem Konto anmelden', registerTitle:'Konto erstellen', forgotTitle:'Passwort zurücksetzen', loginHelp:'Melde dich mit E-Mail und Passwort an.', registerHelp:'Erstelle dein Konto und wähle die App-Sprache.', forgotHelp:'Gib deine E-Mail ein, um einen Wiederherstellungslink zu erhalten.',
    name:'Name', email:'E-Mail', password:'Passwort', signIn:'Anmelden', create:'Konto erstellen', sendRecovery:'Link senden', wait:'Bitte warten...', forgot:'Passwort vergessen', noAccount:'Noch kein Konto? Registrieren', hasAccount:'Bereits registriert? Anmelden', backLogin:'Zurück zur Anmeldung',
    pending:'Dein Zugang wird geprüft.', blocked:'Dein Zugang ist gesperrt.', registrationReceived:'REGISTRIERUNG ERHALTEN', accessPaused:'ZUGANG PAUSIERT', myProfile:'MEIN PROFIL', profileHelp:'Informationen zu deinem Konto und aktuellen Training.', methodology:'Methodik', programStart:'Programmstart', progress:'Fortschritt', activeAccess:'Aktiver Zugang',
    dashboard:'Dashboard', dashboardHelp:'Schüler, Zugänge und Plattforminhalte verwalten.', activeStudents:'Aktive Schüler', awaiting:'Wartet auf Freigabe', activeMethods:'Aktive Methoden', blockedStudents:'Gesperrt', avgProgress:'Durchschnittlicher Fortschritt', recent:'Letzte Abschlüsse', newRegistrations:'Neue Registrierungen', studentBase:'Schülerübersicht', refresh:'Daten aktualisieren',
  },
} as const

type Key = keyof typeof pt

type Value = { language: AppLanguage; locale: string; setLanguage: (value: AppLanguage) => void; t: (key: Key) => string }
const Context = createContext<Value | null>(null)

function normalize(value?: string | null): AppLanguage | null {
  if (!value) return null
  if (['pt-BR','en','es','zh-CN','de'].includes(value)) return value as AppLanguage
  if (value.startsWith('pt')) return 'pt-BR'
  if (value.startsWith('en')) return 'en'
  if (value.startsWith('es')) return 'es'
  if (value.startsWith('zh')) return 'zh-CN'
  if (value.startsWith('de')) return 'de'
  return null
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>(() => normalize(localStorage.getItem('rv_language')) ?? normalize(navigator.language) ?? 'pt-BR')
  const setLanguage = (value: AppLanguage) => { localStorage.setItem('rv_language', value); setLanguageState(value) }

  useEffect(() => {
    document.documentElement.lang = language
    document.documentElement.dataset.language = language
  }, [language])

  const value = useMemo<Value>(() => ({
    language,
    locale: languages.find((item) => item.value === language)?.locale ?? 'pt-BR',
    setLanguage,
    t: (key) => dictionaries[language][key] ?? pt[key],
  }), [language])

  return <Context.Provider value={value}>{children}</Context.Provider>
}

export function useI18n() {
  const value = useContext(Context)
  if (!value) throw new Error('LanguageProvider ausente')
  return value
}
