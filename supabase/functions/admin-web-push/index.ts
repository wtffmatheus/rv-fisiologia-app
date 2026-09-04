import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "@supabase/supabase-js"
import webpush from "web-push"

type DeliveryConfig = {
  vapid_subject: string
  vapid_public_key: string
  vapid_private_key: string
  webhook_secret: string
}

type AdminNotification = {
  id: number
  kind: "new_student" | "program_completed"
  title: string
  message: string
  student_id: string | null
  program_id: number | null
}

type SubscriptionRow = {
  id: number
  admin_id: string
  endpoint: string
  p256dh: string
  auth: string
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-rv-push-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  })
}

function bearerToken(req: Request) {
  const header = req.headers.get("Authorization") || ""
  return header.startsWith("Bearer ") ? header.slice(7).trim() : ""
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405)
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: "server_not_configured" }, 500)
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: configRows, error: configError } = await supabase.rpc(
    "get_admin_push_delivery_config",
  )

  const config = Array.isArray(configRows)
    ? (configRows[0] as DeliveryConfig | undefined)
    : undefined

  if (configError || !config) {
    console.error("push config error", configError)
    return json({ error: "push_config_unavailable" }, 500)
  }

  let body: {
    action?: string
    notification_id?: number
  }

  try {
    body = await req.json()
  } catch {
    return json({ error: "invalid_json" }, 400)
  }

  const providedSecret = req.headers.get("x-rv-push-secret") || ""
  const isInternal =
    Boolean(providedSecret) && providedSecret === config.webhook_secret

  let targetAdminId: string | null = null
  let title = "RV App"
  let message = "As notificações deste dispositivo estão funcionando."
  let targetUrl = "/?admin=settings"
  let tag = `rv-admin-test-${Date.now()}`

  if (isInternal) {
    const notificationId = Number(body.notification_id)

    if (!Number.isFinite(notificationId) || notificationId <= 0) {
      return json({ error: "invalid_notification_id" }, 400)
    }

    const { data: notification, error: notificationError } = await supabase
      .from("admin_notifications")
      .select("id,kind,title,message,student_id,program_id")
      .eq("id", notificationId)
      .single()

    if (notificationError || !notification) {
      return json({ error: "notification_not_found" }, 404)
    }

    const record = notification as AdminNotification
    const studentQuery = record.student_id
      ? `&student=${encodeURIComponent(record.student_id)}`
      : ""

    title = record.title
    message = record.message
    targetUrl =
      record.kind === "new_student"
        ? `/?admin=students&status=pending${studentQuery}`
        : `/?admin=students&status=active${studentQuery}`
    tag = `rv-admin-${record.kind}-${record.id}`
  } else {
    if (body.action !== "test") {
      return json({ error: "unauthorized" }, 401)
    }

    const token = bearerToken(req)
    if (!token) return json({ error: "unauthorized" }, 401)

    const { data: userData, error: userError } =
      await supabase.auth.getUser(token)

    const user = userData.user

    if (userError || !user) {
      return json({ error: "unauthorized" }, 401)
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id,role,status")
      .eq("id", user.id)
      .single()

    if (
      profileError ||
      !profile ||
      profile.role !== "admin" ||
      profile.status !== "active"
    ) {
      return json({ error: "forbidden" }, 403)
    }

    targetAdminId = user.id
  }

  let subscriptionQuery = supabase
    .from("admin_push_subscriptions")
    .select("id,admin_id,endpoint,p256dh,auth")
    .eq("active", true)

  if (targetAdminId) {
    subscriptionQuery = subscriptionQuery.eq("admin_id", targetAdminId)
  }

  const { data: subscriptions, error: subscriptionsError } =
    await subscriptionQuery

  if (subscriptionsError) {
    console.error("subscription load error", subscriptionsError)
    return json({ error: "subscriptions_unavailable" }, 500)
  }

  if (!subscriptions?.length) {
    return json({ ok: true, sent: 0, disabled: 0, no_devices: true })
  }

  webpush.setVapidDetails(
    config.vapid_subject,
    config.vapid_public_key,
    config.vapid_private_key,
  )

  const payload = JSON.stringify({
    title,
    body: message,
    icon: "/icons/icon-rvapp-192.png",
    badge: "/icons/icon-rvapp-192.png",
    tag,
    data: { url: targetUrl },
  })

  let sent = 0
  const staleIds: number[] = []

  await Promise.allSettled(
    (subscriptions as SubscriptionRow[]).map(async (subscription) => {
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
          { TTL: 60 * 60 * 24 },
        )
        sent += 1
      } catch (error) {
        const statusCode = Number(
          (error as { statusCode?: number })?.statusCode ?? 0,
        )

        if (statusCode === 404 || statusCode === 410) {
          staleIds.push(subscription.id)
          return
        }

        console.error("push delivery error", statusCode, error)
      }
    }),
  )

  if (staleIds.length) {
    await supabase
      .from("admin_push_subscriptions")
      .update({ active: false, updated_at: new Date().toISOString() })
      .in("id", staleIds)
  }

  return json({
    ok: true,
    sent,
    disabled: staleIds.length,
  })
})
