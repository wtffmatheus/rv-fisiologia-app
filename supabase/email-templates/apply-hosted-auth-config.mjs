import {
  hostedAuthEmailConfig,
  projectRef,
} from './rv-auth-emails.config.mjs'

const token = String(process.env.SUPABASE_ACCESS_TOKEN || '').trim()

if (!token) {
  console.error(
    '[ERRO] SUPABASE_ACCESS_TOKEN nao esta definido no ambiente local. ' +
    'Crie um Personal Access Token no Supabase, defina-o apenas no seu terminal e execute este arquivo novamente.',
  )
  process.exit(1)
}

const endpoint =
  `https://api.supabase.com/v1/projects/${projectRef}/config/auth`

async function request(method, body) {
  const response = await fetch(endpoint, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  const raw = await response.text()
  let data = null

  try {
    data = raw ? JSON.parse(raw) : null
  } catch {
    data = raw
  }

  if (!response.ok) {
    throw new Error(
      `Supabase Management API ${method} falhou (${response.status}): ` +
      (typeof data === 'string' ? data : JSON.stringify(data)),
    )
  }

  return data
}

console.log('[RV] Conferindo acesso ao Supabase Auth...')
await request('GET')

console.log('[RV] Aplicando templates e notificacoes de seguranca...')
await request('PATCH', hostedAuthEmailConfig)

console.log('[RV] Validando configuracao hospedada...')
const current = await request('GET')

const subjectKeys = Object.keys(hostedAuthEmailConfig).filter(
  (key) => key.startsWith('mailer_subjects_'),
)

const enabledKeys = Object.keys(hostedAuthEmailConfig).filter(
  (key) =>
    key.startsWith('mailer_notifications_') &&
    key.endsWith('_enabled'),
)

const mismatches = []

for (const key of subjectKeys) {
  if (String(current?.[key] ?? '') !== String(hostedAuthEmailConfig[key])) {
    mismatches.push(key)
  }
}

for (const key of enabledKeys) {
  if (current?.[key] !== true) {
    mismatches.push(key)
  }
}

if (mismatches.length) {
  throw new Error(
    'A API respondeu, mas a validacao encontrou divergencia em: ' +
    mismatches.join(', '),
  )
}

console.log(
  '[OK] Supabase Auth atualizado: e-mails de autenticacao + notificacoes de seguranca RV App.',
)
