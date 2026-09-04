const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const ROOT = process.cwd()
const HERE = __dirname
const ASSETS = path.join(HERE, 'arquivos-p3-push')
const DEP_LOTE2 = path.join(
  HERE,
  'dependencia-lote2',
  'aplicar-p3-notificacoes-lote2.cjs',
)

function read(file) {
  const full = path.join(ROOT, file)
  if (!fs.existsSync(full)) {
    throw new Error(`Arquivo não encontrado: ${file}. Rode na raiz do projeto.`)
  }
  return fs.readFileSync(full, 'utf8')
}

function write(file, content) {
  const full = path.join(ROOT, file)
  fs.mkdirSync(path.dirname(full), { recursive: true })
  fs.writeFileSync(full, content, 'utf8')
  console.log(`OK: ${file}`)
}

function copy(source, target, overwrite = false) {
  const from = path.join(ASSETS, source)
  const to = path.join(ROOT, target)

  if (!fs.existsSync(from)) {
    throw new Error(`Arquivo do pacote não encontrado: ${source}`)
  }

  fs.mkdirSync(path.dirname(to), { recursive: true })

  if (!overwrite && fs.existsSync(to)) {
    console.log(`OK: ${target} já existe`)
    return
  }

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

// Se lote 2 ainda não foi aplicado localmente, aplica automaticamente.
let admin = read('src/pages/AdminHome.tsx')

if (!admin.includes('adminNotificationPanel')) {
  if (!fs.existsSync(DEP_LOTE2)) {
    throw new Error(
      'O P3 lote 2 ainda não está aplicado e a dependência não foi encontrada.',
    )
  }

  console.log('P3 lote 2 ausente. Aplicando dependência primeiro...')

  const result = spawnSync(process.execPath, [DEP_LOTE2], {
    cwd: ROOT,
    stdio: 'inherit',
  })

  if (result.status !== 0) {
    throw new Error('Falha ao aplicar a dependência P3 lote 2.')
  }

  admin = read('src/pages/AdminHome.tsx')
}

// Sincroniza arquivos de backend no repositório.
// O banco e a função de produção JÁ foram aplicados.
copy(
  '20260903231315_admin_web_push_infrastructure.sql',
  'supabase/migrations/20260903231315_admin_web_push_infrastructure.sql',
)

copy(
  '20260903231650_move_pg_net_out_of_public.sql',
  'supabase/migrations/20260903231650_move_pg_net_out_of_public.sql',
)

copy(
  'admin-web-push-index.ts',
  'supabase/functions/admin-web-push/index.ts',
  true,
)

copy(
  'admin-web-push-deno.json',
  'supabase/functions/admin-web-push/deno.json',
  true,
)

// Front.
copy(
  'AdminPushControl.tsx',
  'src/components/AdminPushControl.tsx',
  true,
)

copy('sw.js', 'public/sw.js', true)

admin = read('src/pages/AdminHome.tsx')

admin = replaceOnce(
  admin,
  `import { RvEmptyState, RvLoadingState } from '../components/PlatformState'`,
  `import { RvEmptyState, RvLoadingState } from '../components/PlatformState'
import AdminPushControl from '../components/AdminPushControl'`,
  'controle de push no admin',
)

admin = replaceOnce(
  admin,
  `            <div className="settingsRoadmap">
              <span>Integrações</span>
              <strong>Notificações em tempo real ativas</strong>
              <strong>Pagamento e liberação automática</strong>
            </div>`,
  `            <div className="settingsRoadmap">
              <span>Integrações</span>
              <strong>Notificações em tempo real ativas</strong>
              <strong>Push do dispositivo disponível</strong>
              <strong>Pagamento e liberação automática</strong>
            </div>

            <AdminPushControl adminId={profile.id} />`,
  'configuração de push no painel',
)

write('src/pages/AdminHome.tsx', admin)

let css = read('src/feature.css')
const marker = '/* RV_P3_ADMIN_WEB_PUSH_LOTE3 */'

if (!css.includes(marker)) {
  css += `

${marker}

.adminPushSettings {
  margin-top: 18px;
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: 13px;
  background:
    radial-gradient(circle at 90% 0%, rgba(35, 200, 191, .055), transparent 34%),
    rgba(4, 20, 47, .5);
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr) auto;
  align-items: center;
  gap: 13px;
}

.adminPushSettingsIcon {
  width: 42px;
  height: 42px;
  border: 1px solid rgba(35, 200, 191, .18);
  border-radius: 11px;
  background: rgba(35, 200, 191, .07);
  color: var(--accent);
  display: grid;
  place-items: center;
}

.adminPushSettingsCopy {
  min-width: 0;
  display: grid;
  gap: 4px;
}

.adminPushSettingsCopy > span {
  color: var(--accent);
  font-size: 8px;
  font-weight: 850;
  letter-spacing: 1px;
}

.adminPushSettingsCopy > strong {
  color: #eef5fc;
  font-size: 11.5px;
}

.adminPushSettingsCopy > p {
  max-width: 610px;
  margin: 0;
  color: #8096b3;
  font-size: 9px;
  line-height: 1.5;
}

.adminPushSettingsCopy > small {
  color: #9bb0c8;
  font-size: 8.5px;
}

.adminPushSettingsAction {
  display: flex;
  justify-content: flex-end;
}

.adminPushEnable,
.adminPushDisable {
  min-height: 38px;
  padding: 0 12px;
  border-radius: 9px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 9px;
  font-weight: 800;
  white-space: nowrap;
}

.adminPushEnable {
  border: 0;
  background: var(--accent);
  color: #03252a;
}

.adminPushDisable {
  border: 1px solid rgba(255, 133, 146, .22);
  background: rgba(255, 133, 146, .055);
  color: #ffb8c0;
}

.adminPushEnable:disabled,
.adminPushDisable:disabled {
  opacity: .48;
  cursor: default;
}

@media (max-width: 720px) {
  .adminPushSettings {
    grid-template-columns: 42px minmax(0, 1fr);
    align-items: flex-start;
  }

  .adminPushSettingsAction {
    grid-column: 1 / -1;
  }

  .adminPushEnable,
  .adminPushDisable {
    width: 100%;
  }
}
`

  write('src/feature.css', css)
} else {
  console.log('OK: estilos de Web Push já aplicados')
}

console.log('')
console.log('P3 lote 3 aplicado.')
console.log('Backend de produção já está configurado.')
console.log('Agora rode: npm run build')
