import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "@supabase/supabase-js"
import webpush from "web-push"
import { createECDH } from "node:crypto"

type LanguageCode = "pt-BR" | "en" | "es" | "zh-CN" | "de"
type DeliveryConfig = {
  vapid_subject: string
  vapid_public_key: string
  vapid_private_key: string
  webhook_secret: string
}
type StudentNotification = {
  id: number
  student_id: string
  kind: "access_approved" | "custom"
  title: string
  message: string
  metadata: Record<string, unknown> | null
}
type SubscriptionRow = {
  id: number
  student_id: string
  endpoint: string
  p256dh: string
  auth: string
  language: LanguageCode
}

const allowedOrigins = new Set([
  "https://app.rvfisiologista.com.br",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
])

function cors(req: Request) {
  const origin = req.headers.get("origin") || ""
  return {
    "Access-Control-Allow-Origin": allowedOrigins.has(origin)
      ? origin
      : "https://app.rvfisiologista.com.br",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-rv-push-secret",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  }
}

function json(req: Request, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...cors(req),
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  })
}

function bearerToken(req: Request) {
  const header = req.headers.get("Authorization") || ""
  return header.startsWith("Bearer ") ? header.slice(7).trim() : ""
}

function safeLanguage(value: unknown): LanguageCode {
  return value === "en" ||
      value === "es" ||
      value === "zh-CN" ||
      value === "de"
    ? value
    : "pt-BR"
}

function provider(endpoint: string) {
  try {
    const host = new URL(endpoint).hostname
    if (host.includes("apple")) return "apple"
    if (host.includes("google") || host.includes("fcm")) return "fcm"
    return host
  } catch {
    return "unknown"
  }
}

function b64urlToBytes(value: string) {
  const padded = value + "=".repeat((4 - (value.length % 4)) % 4)
  return Uint8Array.from(
    atob(padded.replace(/-/g, "+").replace(/_/g, "/")),
    (char) => char.charCodeAt(0),
  )
}

function bytesToB64url(value: Uint8Array) {
  let raw = ""
  for (const byte of value) raw += String.fromCharCode(byte)
  return btoa(raw)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "")
}

function vapidMatch(config: DeliveryConfig) {
  try {
    const ecdh = createECDH("prime256v1")
    ecdh.setPrivateKey(b64urlToBytes(config.vapid_private_key))
    const derived = bytesToB64url(
      new Uint8Array(ecdh.getPublicKey(undefined, "uncompressed")),
    )
    return derived === config.vapid_public_key
  } catch {
    return false
  }
}

const testCopy: Record<LanguageCode, { title: string; body: string }> = {
  "pt-BR": {
    title: "RV App · Notificações ativas",
    body: "Pronto. Este aparelho está autorizado a receber notificações da RV.",
  },
  en: {
    title: "RV App · Notifications enabled",
    body: "Done. This device is authorized to receive RV notifications.",
  },
  es: {
    title: "RV App · Notificaciones activas",
    body: "Listo. Este dispositivo está autorizado para recibir notificaciones de RV.",
  },
  "zh-CN": {
    title: "RV App · 通知已开启",
    body: "设置完成。此设备已允许接收 RV 通知。",
  },
  de: {
    title: "RV App · Benachrichtigungen aktiv",
    body: "Fertig. Dieses Gerät darf RV-Benachrichtigungen empfangen.",
  },
}

const approvedCopy: Record<LanguageCode, { title: string; body: string }> = {
  "pt-BR": {
    title: "Acesso liberado",
    body: "Seu acesso à RV foi liberado. Seu programa de treino já está disponível.",
  },
  en: {
    title: "Access approved",
    body: "Your RV access has been approved. Your training program is now available.",
  },
  es: {
    title: "Acceso aprobado",
    body: "Tu acceso a RV fue aprobado. Tu programa de entrenamiento ya está disponible.",
  },
  "zh-CN": {
    title: "访问已批准",
    body: "你的 RV 访问权限已获批准。训练计划现在可以使用。",
  },
  de: {
    title: "Zugang freigegeben",
    body: "Dein RV-Zugang wurde freigegeben. Dein Trainingsprogramm ist jetzt verfügbar.",
  },
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors(req) })
  }

  if (req.method !== "POST") {
    return json(req, { error: "method_not_allowed" }, 405)
  }

  const url = Deno.env.get("SUPABASE_URL")
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

  if (!url || !key) {
    return json(req, { error: "server_not_configured" }, 500)
  }

  const sb = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: configRows, error: configError } = await sb.rpc(
    "get_admin_push_delivery_config",
  )

  const config = Array.isArray(configRows)
    ? (configRows[0] as DeliveryConfig | undefined)
    : undefined

  if (configError || !config) {
    return json(req, { error: "push_config_unavailable" }, 500)
  }

  let body: { action?: string; notification_id?: number }

  try {
    body = await req.json()
  } catch {
    return json(req, { error: "invalid_json" }, 400)
  }

  const internal =
    (req.headers.get("x-rv-push-secret") || "") === config.webhook_secret

  let targetStudentId: string | null = null
  let notification: StudentNotification | null = null

  if (internal) {
    const notificationId = Number(body.notification_id)

    if (!Number.isFinite(notificationId) || notificationId <= 0) {
      return json(req, { error: "invalid_notification_id" }, 400)
    }

    const { data, error } = await sb
      .from("student_notifications")
      .select("id,student_id,kind,title,message,metadata")
      .eq("id", notificationId)
      .single()

    if (error || !data) {
      return json(req, { error: "notification_not_found" }, 404)
    }

    notification = data as StudentNotification
    targetStudentId = notification.student_id
  } else {
    if (body.action !== "test") {
      return json(req, { error: "unauthorized" }, 401)
    }

    const token = bearerToken(req)
    if (!token) return json(req, { error: "unauthorized" }, 401)

    const { data: userData, error: userError } = await sb.auth.getUser(token)

    if (userError || !userData.user) {
      return json(req, { error: "unauthorized" }, 401)
    }

    const { data: profile } = await sb
      .from("profiles")
      .select("id,role,status")
      .eq("id", userData.user.id)
      .single()

    if (
      !profile ||
      profile.role !== "student" ||
      !["pending", "active"].includes(profile.status)
    ) {
      return json(req, { error: "forbidden" }, 403)
    }

    targetStudentId = userData.user.id
  }

  const { data: subscriptions, error: subscriptionsError } = await sb
    .from("student_push_subscriptions")
    .select("id,student_id,endpoint,p256dh,auth,language")
    .eq("student_id", targetStudentId)
    .eq("active", true)

  if (subscriptionsError) {
    return json(req, { error: "subscriptions_unavailable" }, 500)
  }

  if (!subscriptions?.length) {
    return json(req, {
      ok: true,
      attempted: 0,
      sent: 0,
      disabled: 0,
      no_devices: true,
      vapid_key_match: vapidMatch(config),
    })
  }

  webpush.setVapidDetails(
    config.vapid_subject,
    config.vapid_public_key,
    config.vapid_private_key,
  )

  let sent = 0
  const stale: number[] = []
  const errors: Array<{
    id: number
    provider: string
    status: number
    message: string
    body: string | null
  }> = []

  await Promise.allSettled(
    (subscriptions as SubscriptionRow[]).map(async (subscription) => {
      const language = safeLanguage(subscription.language)
      const test = testCopy[language]

      let title = test.title
      let message = test.body
      let targetUrl = "/?view=home"
      let tag = `rv-student-test-${Date.now()}`

      if (notification) {
        if (notification.kind === "access_approved") {
          const approved = approvedCopy[language]
          title = approved.title
          message = approved.body
        } else {
          title = notification.title
          message = notification.message
        }

        tag = `rv-student-${notification.kind}-${notification.id}`
      }

      const payload = JSON.stringify({
        title,
        body: message,
        icon: "/icons/icon-rvapp-192.png",
        badge: "/icons/icon-rvapp-192.png",
        tag,
        data: { url: targetUrl },
      })

      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth,
            },
          },
          payload,
          { TTL: 86400 },
        )

        sent += 1
      } catch (error) {
        const value = error as {
          statusCode?: number
          message?: string
          body?: string
        }

        const status = Number(value?.statusCode ?? 0)

        if (status === 404 || status === 410) {
          stale.push(subscription.id)
          return
        }

        errors.push({
          id: subscription.id,
          provider: provider(subscription.endpoint),
          status,
          message: String(value?.message ?? "unknown").slice(0, 300),
          body: value?.body
            ? String(value.body).slice(0, 500)
            : null,
        })
      }
    }),
  )

  if (stale.length) {
    await sb
      .from("student_push_subscriptions")
      .update({
        active: false,
        updated_at: new Date().toISOString(),
      })
      .in("id", stale)
  }

  return json(req, {
    ok: true,
    attempted: subscriptions.length,
    sent,
    disabled: stale.length,
    vapid_key_match: vapidMatch(config),
    errors,
  })
})
