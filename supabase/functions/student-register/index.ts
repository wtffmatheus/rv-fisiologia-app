import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "@supabase/supabase-js"

type LanguageCode = "pt-BR" | "en" | "es" | "zh-CN" | "de"

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
      "authorization, x-client-info, apikey, content-type",
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

function normalizeLanguage(value: unknown): LanguageCode {
  return value === "en" ||
    value === "es" ||
    value === "zh-CN" ||
    value === "de"
    ? value
    : "pt-BR"
}

function clientAddress(req: Request) {
  const forwarded = req.headers.get("x-forwarded-for")
  if (forwarded) return forwarded.split(",")[0].trim()

  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    `unknown:${req.headers.get("user-agent") || "browser"}`
  )
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value)
  const digest = new Uint8Array(
    await crypto.subtle.digest("SHA-256", bytes),
  )

  return Array.from(
    digest,
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("")
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: cors(req),
    })
  }

  if (req.method !== "POST") {
    return json(req, { error: "method_not_allowed" }, 405)
  }

  const url = Deno.env.get("SUPABASE_URL")
  const serviceKey =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

  if (!url || !serviceKey) {
    return json(
      req,
      { error: "server_not_configured" },
      500,
    )
  }

  let body: {
    name?: unknown
    email?: unknown
    password?: unknown
    language?: unknown
  }

  try {
    body = await req.json()
  } catch {
    return json(req, { error: "invalid_json" }, 400)
  }

  const name = String(body.name ?? "")
    .trim()
    .replace(/\s+/g, " ")
  const email = String(body.email ?? "")
    .trim()
    .toLowerCase()
  const password = String(body.password ?? "")
  const language = normalizeLanguage(body.language)

  if (name.length < 2 || name.length > 80) {
    return json(req, { error: "invalid_name" }, 400)
  }

  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    email.length > 254
  ) {
    return json(req, { error: "invalid_email" }, 400)
  }

  if (
    password.length < 8 ||
    password.length > 72
  ) {
    return json(
      req,
      { error: "invalid_password" },
      400,
    )
  }

  const sb = createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  const ipHash = await sha256(clientAddress(req))
  const emailHash = await sha256(email)
  const now = Date.now()
  const hourAgo = new Date(
    now - 60 * 60 * 1000,
  ).toISOString()
  const dayAgo = new Date(
    now - 24 * 60 * 60 * 1000,
  ).toISOString()

  await sb
    .from("student_registration_attempts")
    .delete()
    .lt("created_at", dayAgo)

  const [
    ipCountResult,
    emailCountResult,
    globalCountResult,
  ] = await Promise.all([
    sb
      .from("student_registration_attempts")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("ip_hash", ipHash)
      .gte("created_at", hourAgo),

    sb
      .from("student_registration_attempts")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("email_hash", emailHash)
      .gte("created_at", hourAgo),

    sb
      .from("student_registration_attempts")
      .select("id", {
        count: "exact",
        head: true,
      })
      .gte("created_at", hourAgo),
  ])

  if (
    ipCountResult.error ||
    emailCountResult.error ||
    globalCountResult.error
  ) {
    return json(
      req,
      { error: "rate_limit_unavailable" },
      503,
    )
  }

  if (
    (ipCountResult.count ?? 0) >= 10 ||
    (emailCountResult.count ?? 0) >= 3 ||
    (globalCountResult.count ?? 0) >= 100
  ) {
    return json(
      req,
      {
        error: "rate_limited",
        retry_after_seconds: 3600,
      },
      429,
    )
  }

  const {
    data: attempt,
    error: attemptError,
  } = await sb
    .from("student_registration_attempts")
    .insert({
      ip_hash: ipHash,
      email_hash: emailHash,
      successful: false,
    })
    .select("id")
    .single()

  if (attemptError || !attempt) {
    return json(
      req,
      { error: "registration_unavailable" },
      503,
    )
  }

  const {
    data: created,
    error: createError,
  } = await sb.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      name,
      language,
      registration_source:
        "rv_app_manual_approval_v1",
    },
  })

  if (createError || !created.user) {
    const raw =
      `${createError?.code ?? ""} ${createError?.message ?? ""}`
        .toLowerCase()

    if (
      raw.includes("already") ||
      raw.includes("exists") ||
      raw.includes("registered")
    ) {
      return json(
        req,
        { error: "account_exists" },
        409,
      )
    }

    console.error(
      "student-register createUser failed",
      createError,
    )

    return json(
      req,
      { error: "registration_failed" },
      500,
    )
  }

  const {
    data: profile,
    error: profileError,
  } = await sb
    .from("profiles")
    .select("id,status,role,language")
    .eq("id", created.user.id)
    .single()

  if (
    profileError ||
    !profile ||
    profile.role !== "student" ||
    profile.status !== "pending"
  ) {
    console.error(
      "student-register profile validation failed",
      profileError,
      profile,
    )

    await sb.auth.admin.deleteUser(
      created.user.id,
    )

    return json(
      req,
      { error: "profile_creation_failed" },
      500,
    )
  }

  await sb
    .from("student_registration_attempts")
    .update({ successful: true })
    .eq("id", attempt.id)

  return json(req, {
    ok: true,
    user_id: created.user.id,
    status: "pending",
  })
})
