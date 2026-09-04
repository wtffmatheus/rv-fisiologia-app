const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const ROOT = process.cwd()
const HERE = __dirname
const ASSETS = path.join(HERE, 'arquivos-estabilizacao-final')

function exists(file) {
  return fs.existsSync(path.join(ROOT, file))
}

function read(file) {
  const full = path.join(ROOT, file)

  if (!fs.existsSync(full)) {
    throw new Error(
      `Arquivo não encontrado: ${file}. Rode este script na raiz do projeto.`,
    )
  }

  return fs.readFileSync(full, 'utf8')
}

function write(file, content) {
  const full = path.join(ROOT, file)
  fs.mkdirSync(path.dirname(full), { recursive: true })
  fs.writeFileSync(full, content, 'utf8')
  console.log(`OK: ${file}`)
}

function copyAsset(source, target) {
  const from = path.join(ASSETS, source)
  const to = path.join(ROOT, target)

  if (!fs.existsSync(from)) {
    throw new Error(`Arquivo do pacote não encontrado: ${source}`)
  }

  fs.mkdirSync(path.dirname(to), { recursive: true })
  fs.copyFileSync(from, to)
  console.log(`OK: ${target}`)
}

function replaceOnce(content, from, to, label) {
  if (content.includes(to)) {
    console.log(`OK: ${label} já aplicado`)
    return content
  }

  if (!content.includes(from)) {
    throw new Error(`Não encontrei o trecho esperado para: ${label}`)
  }

  console.log(`OK: ${label}`)
  return content.replace(from, to)
}

function runGit(args, allowFailure = false) {
  const result = spawnSync('git', args, {
    cwd: ROOT,
    encoding: 'utf8',
    shell: false,
  })

  if (result.stdout && result.stdout.trim()) {
    console.log(result.stdout.trim())
  }

  if (result.stderr && result.stderr.trim()) {
    console.log(result.stderr.trim())
  }

  if (result.status !== 0 && !allowFailure) {
    throw new Error(`git ${args.join(' ')} falhou`)
  }

  return result
}

// ------------------------------------------------------------
// Arquivos completos
// ------------------------------------------------------------
copyAsset('App.tsx', 'src/App.tsx')
copyAsset('AuthPage.tsx', 'src/pages/AuthPage.tsx')
copyAsset('ResetPasswordPage.tsx', 'src/pages/ResetPasswordPage.tsx')
copyAsset('AdminPushControl.tsx', 'src/components/AdminPushControl.tsx')
copyAsset('authErrors.ts', 'src/lib/authErrors.ts')
copyAsset('_headers', 'public/_headers')
copyAsset('wrangler.jsonc', 'wrangler.jsonc')
copyAsset('vite.config.ts', 'vite.config.ts')
copyAsset(
  'admin-web-push-index.ts',
  'supabase/functions/admin-web-push/index.ts',
)
copyAsset(
  'admin-web-push-deno.json',
  'supabase/functions/admin-web-push/deno.json',
)

// ------------------------------------------------------------
// Service Worker v7
// ------------------------------------------------------------
let sw = read('public/sw.js')

if (sw.includes('rv-fisiologia-pwa-v6')) {
  sw = sw.replace(
    'rv-fisiologia-pwa-v6',
    'rv-fisiologia-pwa-v7',
  )
  write('public/sw.js', sw)
} else if (sw.includes('rv-fisiologia-pwa-v7')) {
  console.log('OK: Service Worker v7 já aplicado')
} else {
  throw new Error(
    'Versão inesperada do Service Worker. Esperado v6 ou v7.',
  )
}

// ------------------------------------------------------------
// Build ID
// ------------------------------------------------------------
let viteEnv = read('src/vite-env.d.ts')

if (!viteEnv.includes('declare const __RV_BUILD_AT__: string')) {
  viteEnv += '\n\ndeclare const __RV_BUILD_AT__: string\n'
  write('src/vite-env.d.ts', viteEnv)
}

// ------------------------------------------------------------
// package.json
// ------------------------------------------------------------
const packageFile = path.join(ROOT, 'package.json')
const pkg = JSON.parse(fs.readFileSync(packageFile, 'utf8'))

pkg.scripts = pkg.scripts || {}
pkg.scripts.deploy = 'npm run build && npx wrangler deploy'

fs.writeFileSync(
  packageFile,
  JSON.stringify(pkg, null, 2) + '\n',
  'utf8',
)
console.log('OK: package.json')

// ------------------------------------------------------------
// StudentHome: mensagens amigáveis
// ------------------------------------------------------------
let student = read('src/pages/StudentHome.tsx')

student = replaceOnce(
  student,
  "import { RvEmptyState, RvLoadingState } from '../components/PlatformState'",
  "import { RvEmptyState, RvLoadingState } from '../components/PlatformState'\nimport { authErrorMessage, dataErrorMessage } from '../lib/authErrors'",
  'helpers de erro do aluno',
)

student = student.replace(
  /setLoadError\(`Não foi possível carregar seu programa: \$\{assignmentError\.message\}`\)/g,
  `setLoadError(
        dataErrorMessage(
          assignmentError,
          'Não foi possível carregar seu programa agora.',
        ),
      )`,
)

student = student.replace(
  /setMessage\(`Não foi possível concluir a aula: \$\{error\.message\}`\)/g,
  `setMessage(
        dataErrorMessage(
          error,
          'Não foi possível concluir a aula agora.',
        ),
      )`,
)

student = student.replace(
  /setEmailMessage\(error\.message\)/g,
  `setEmailMessage(
        authErrorMessage(
          error,
          'Não foi possível alterar o e-mail agora.',
        ),
      )`,
)

student = student.replace(
  /setPasswordMessage\(error\.message\)/g,
  `setPasswordMessage(
        authErrorMessage(
          error,
          'Não foi possível alterar a senha agora.',
        ),
      )`,
)

write('src/pages/StudentHome.tsx', student)

// ------------------------------------------------------------
// AdminHome: rotas, mobile e notificações
// ------------------------------------------------------------
let admin = read('src/pages/AdminHome.tsx')

admin = replaceOnce(
  admin,
  "type StudentFilter = 'all' | 'pending' | 'active' | 'blocked'",
  `type StudentFilter = 'all' | 'pending' | 'active' | 'blocked'

function readAdminStudentFilter(): StudentFilter {
  const value = new URLSearchParams(window.location.search).get('status')

  if (
    value === 'pending' ||
    value === 'active' ||
    value === 'blocked'
  ) {
    return value
  }

  return 'all'
}

function readAdminSelectedStudentId() {
  return new URLSearchParams(window.location.search).get('student')
}`,
  'leitura de deep link administrativo',
)

admin = replaceOnce(
  admin,
  `  const [studentFilter, setStudentFilter] = useState<StudentFilter>('all')
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null)`,
  `  const [studentFilter, setStudentFilter] = useState<StudentFilter>(
    () => readAdminStudentFilter(),
  )
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(
    () => readAdminSelectedStudentId(),
  )`,
  'estado inicial via URL',
)

// Insere limpeza de status/student antes do primeiro "const next".
// Esse primeiro ponto pertence a writeAdminTab.
if (!admin.includes("if (tab !== 'students')")) {
  admin = admin.replace(
    '  const next =',
    `  if (tab !== 'students') {
    url.searchParams.delete('status')
    url.searchParams.delete('student')
  }

  const next =`,
  )
  console.log('OK: limpeza de parâmetros administrativos')
}

admin = replaceOnce(
  admin,
  `  useEffect(() => {
    writeAdminTab(activeTab, 'replace')
  }, [activeTab])

  useEffect(() => {
    function handlePopState() {
      setActiveTab(readAdminTab())
      window.scrollTo({ top: 0, behavior: 'auto' })
    }`,
  `  useEffect(() => {
    writeAdminTab(activeTab, 'replace')
    setNotificationsOpen(false)
  }, [activeTab])

  useEffect(() => {
    if (activeTab !== 'students') return

    const url = new URL(window.location.href)

    if (studentFilter === 'all') {
      url.searchParams.delete('status')
    } else {
      url.searchParams.set('status', studentFilter)
    }

    if (selectedStudentId) {
      url.searchParams.set('student', selectedStudentId)
    } else {
      url.searchParams.delete('student')
    }

    window.history.replaceState(
      {},
      document.title,
      url.pathname + url.search + url.hash,
    )
  }, [activeTab, selectedStudentId, studentFilter])

  useEffect(() => {
    if (!notificationsOpen) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setNotificationsOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [notificationsOpen])

  useEffect(() => {
    function handlePopState() {
      setActiveTab(readAdminTab())
      setStudentFilter(readAdminStudentFilter())
      setSelectedStudentId(readAdminSelectedStudentId())
      setNotificationsOpen(false)
      window.scrollTo({ top: 0, behavior: 'auto' })
    }`,
  'rotas e fechamento seguro do painel',
)

// Texto do menu precisa estar em span para esconder de verdade no iPhone.
admin = admin.replace(
  '<LayoutDashboard size={18} /> Dashboard',
  '<LayoutDashboard size={18} /> <span className="adminMenuLabel">Dashboard</span>',
)
admin = admin.replace(
  '<UsersRound size={18} /> Alunos',
  '<UsersRound size={18} /> <span className="adminMenuLabel">Alunos</span>',
)
admin = admin.replace(
  '<BookOpen size={18} /> Conteúdo',
  '<BookOpen size={18} /> <span className="adminMenuLabel">Conteúdo</span>',
)
admin = admin.replace(
  '<Settings size={18} /> Configurações',
  '<Settings size={18} /> <span className="adminMenuLabel">Configurações</span>',
)

// Botão X no painel de notificações.
if (!admin.includes('className="adminNotificationClose"')) {
  const closeAnchor =
    `                    </button>
                  </header>

                  <div className="adminNotificationList">`

  const closeReplacement =
    `                    </button>

                    <button
                      type="button"
                      className="adminNotificationClose"
                      onClick={() => setNotificationsOpen(false)}
                      aria-label="Fechar notificações"
                    >
                      <X size={16} />
                    </button>
                  </header>

                  <div className="adminNotificationList">`

  if (!admin.includes(closeAnchor)) {
    throw new Error(
      'Não encontrei o cabeçalho da central de notificações.',
    )
  }

  admin = admin.replace(closeAnchor, closeReplacement)
  console.log('OK: botão fechar notificações')
}

// Identificação da versão realmente publicada.
if (!admin.includes('className="settingsBuildInfo"')) {
  const buildAnchor =
    '            <AdminPushControl adminId={profile.id} />'

  const buildReplacement =
    `            <AdminPushControl adminId={profile.id} />

            <div className="settingsBuildInfo">
              <span>VERSÃO PUBLICADA</span>
              <strong>
                {new Intl.DateTimeFormat('pt-BR', {
                  dateStyle: 'short',
                  timeStyle: 'medium',
                }).format(new Date(__RV_BUILD_AT__))}
              </strong>
              <small>{__RV_BUILD_AT__}</small>
            </div>`

  if (!admin.includes(buildAnchor)) {
    throw new Error(
      'Não encontrei AdminPushControl nas Configurações.',
    )
  }

  admin = admin.replace(buildAnchor, buildReplacement)
  console.log('OK: identificação da versão publicada')
}

write('src/pages/AdminHome.tsx', admin)

// ------------------------------------------------------------
// CSS final
// ------------------------------------------------------------
let feature = read('src/feature.css')
const cssMarker = '/* RV_FINAL_STABILIZATION_20260903 */'

if (!feature.includes(cssMarker)) {
  const extraCss = fs.readFileSync(
    path.join(ASSETS, 'final-stabilization.css'),
    'utf8',
  )

  feature += '\n\n' + extraCss.trim() + '\n'
  write('src/feature.css', feature)
} else {
  console.log('OK: CSS final já aplicado')
}

// ------------------------------------------------------------
// .gitignore
// ------------------------------------------------------------
let gitignore = read('.gitignore')
const ignoreLines = new Set(gitignore.split(/\r?\n/))

for (const line of [
  'my-react-app/',
  'arquivos-estabilizacao-final/',
]) {
  if (!ignoreLines.has(line)) {
    gitignore += `${gitignore.endsWith('\n') ? '' : '\n'}${line}\n`
  }
}

write('.gitignore', gitignore)

// ------------------------------------------------------------
// Migrations: apenas sincronização local, NÃO executar SQL.
// ------------------------------------------------------------
const migrationSource = path.join(ASSETS, 'migrations')

for (const file of fs.readdirSync(migrationSource)) {
  copyAsset(
    path.join('migrations', file),
    path.join('supabase', 'migrations', file),
  )
}

// Arquivos legados com timestamp curto.
for (const legacy of [
  'supabase/migrations/20260902_admin_content_editor.sql',
  'supabase/migrations/20260902_video_display_options.sql',
]) {
  if (exists(legacy)) {
    runGit(
      ['rm', '-f', '--ignore-unmatch', legacy],
      true,
    )

    const full = path.join(ROOT, legacy)

    if (fs.existsSync(full)) {
      fs.rmSync(full, { force: true })
    }
  }
}

// ------------------------------------------------------------
// Limpeza do Git
// ------------------------------------------------------------

// Preserva node_modules local, mas remove o conteúdo já versionado.
runGit(
  ['rm', '-r', '--cached', '--ignore-unmatch', 'node_modules'],
  true,
)

// my-react-app é somente o scaffold padrão antigo da Cloudflare.
if (exists('my-react-app')) {
  runGit(
    ['rm', '-r', '-f', '--ignore-unmatch', 'my-react-app'],
    true,
  )

  const scaffold = path.join(ROOT, 'my-react-app')

  if (fs.existsSync(scaffold)) {
    fs.rmSync(scaffold, {
      recursive: true,
      force: true,
    })
  }

  console.log('OK: my-react-app removido')
}

// ------------------------------------------------------------
// Validação estrutural
// ------------------------------------------------------------
const required = [
  'src/App.tsx',
  'src/pages/AuthPage.tsx',
  'src/pages/ResetPasswordPage.tsx',
  'src/pages/AdminHome.tsx',
  'src/pages/StudentHome.tsx',
  'src/components/AdminPushControl.tsx',
  'src/lib/authErrors.ts',
  'public/sw.js',
  'public/_headers',
  'wrangler.jsonc',
  'supabase/functions/admin-web-push/index.ts',
  'supabase/migrations/20260903233134_enable_rls_private_push_config.sql',
  'supabase/migrations/20260903233830_deny_client_access_private_push_config.sql',
]

for (const file of required) {
  if (!exists(file)) {
    throw new Error(`Validação falhou: ${file} não existe.`)
  }
}

console.log('')
console.log('ESTABILIZAÇÃO FINAL APLICADA.')
console.log('Agora rode: npm run build')
console.log('Depois do commit/push, rode: npm run deploy')
console.log('')
console.log('NÃO rode as migrations manualmente.')
console.log('Elas já estão aplicadas em produção.')
