import { createClient } from '@supabase/supabase-js'
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function getPublishableKey() {
  const legacy = Deno.env.get('SUPABASE_ANON_KEY')
  if (legacy) return legacy

  const raw = Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')
  if (!raw) throw new Error('Supabase publishable key is not configured')
  return JSON.parse(raw).default
}

function r2Client() {
  const accountId = Deno.env.get('R2_ACCOUNT_ID')
  const accessKeyId = Deno.env.get('R2_ACCESS_KEY_ID')
  const secretAccessKey = Deno.env.get('R2_SECRET_ACCESS_KEY')

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error('R2 ainda não configurado no Supabase Edge Functions Secrets')
  }

  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  })
}

function bucketName() {
  const bucket = Deno.env.get('R2_BUCKET')
  if (!bucket) throw new Error('R2_BUCKET não configurado')
  return bucket
}

function safeExtension(fileName = '', contentType = '') {
  const ext = fileName.split('.').pop()?.toLowerCase()
  if (ext && ['mp4', 'mov', 'webm'].includes(ext)) return ext
  if (contentType === 'video/quicktime') return 'mov'
  if (contentType === 'video/webm') return 'webm'
  return 'mp4'
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Não autenticado' }, 401)

    const token = authHeader.slice(7)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      getPublishableKey(),
      { global: { headers: { Authorization: authHeader } } },
    )

    const { data: userData, error: userError } = await supabase.auth.getUser(token)
    if (userError || !userData.user) return json({ error: 'Sessão inválida' }, 401)

    const userId = userData.user.id
    const body = await req.json()
    const action = body.action

    if (action === 'upload') {
      const { data: profile } = await supabase.from('profiles').select('role,status').eq('id', userId).single()
      if (profile?.role !== 'admin' || profile?.status !== 'active') return json({ error: 'Somente administrador pode enviar vídeos' }, 403)

      const exerciseId = Number(body.exercise_id)
      const programId = Number(body.program_id)
      const lessonId = Number(body.lesson_id)
      const fileName = String(body.file_name || 'video.mp4')
      const contentType = String(body.content_type || 'video/mp4')
      const allowed = ['video/mp4', 'video/quicktime', 'video/webm']

      if (!exerciseId || !programId || !lessonId) return json({ error: 'Dados da aula incompletos' }, 400)
      if (!allowed.includes(contentType)) return json({ error: 'Formato de vídeo não aceito' }, 400)

      const { data: exercise } = await supabase.from('exercises').select('id').eq('id', exerciseId).eq('lesson_id', lessonId).single()
      if (!exercise) return json({ error: 'Exercício não encontrado' }, 404)

      const ext = safeExtension(fileName, contentType)
      const key = `programs/${programId}/lessons/${lessonId}/exercises/${exerciseId}/${crypto.randomUUID()}.${ext}`

      const uploadUrl = await getSignedUrl(
        r2Client(),
        new PutObjectCommand({ Bucket: bucketName(), Key: key, ContentType: contentType, CacheControl: 'private, max-age=3600' }),
        { expiresIn: 900 },
      )

      return json({ upload_url: uploadUrl, key, expires_in: 900 })
    }

    if (action === 'play') {
      const exerciseId = Number(body.exercise_id)
      const { data: exercise } = await supabase.from('exercises').select('id,video_path').eq('id', exerciseId).single()

      if (!exercise) return json({ error: 'Sem acesso a este vídeo' }, 403)
      if (!exercise.video_path) return json({ error: 'Exercício sem vídeo' }, 404)

      const url = await getSignedUrl(
        r2Client(),
        new GetObjectCommand({ Bucket: bucketName(), Key: exercise.video_path }),
        { expiresIn: 3600 },
      )

      return json({ url, expires_in: 3600 })
    }

    if (action === 'delete') {
      const { data: profile } = await supabase.from('profiles').select('role,status').eq('id', userId).single()
      if (profile?.role !== 'admin' || profile?.status !== 'active') return json({ error: 'Somente administrador pode excluir vídeos' }, 403)

      const key = String(body.key || '')
      if (!key.startsWith('programs/')) return json({ error: 'Caminho inválido' }, 400)

      await r2Client().send(new DeleteObjectCommand({ Bucket: bucketName(), Key: key }))
      return json({ ok: true })
    }

    return json({ error: 'Ação inválida' }, 400)
  } catch (error) {
    console.error('r2-video error', error)
    return json({ error: error instanceof Error ? error.message : 'Erro inesperado' }, 500)
  }
})
