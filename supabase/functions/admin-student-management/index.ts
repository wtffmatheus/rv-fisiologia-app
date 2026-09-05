import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "@supabase/supabase-js"

type RequestBody = {
  action?: "delete_student"
  student_id?: string
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

function bearerToken(req: Request) {
  const header = req.headers.get("Authorization") || ""
  return header.startsWith("Bearer ") ? header.slice(7).trim() : ""
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
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

  if (!url || !serviceKey) {
    return json(req, { error: "server_not_configured" }, 500)
  }

  const token = bearerToken(req)

  if (!token) {
    return json(req, { error: "unauthorized" }, 401)
  }

  const sb = createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  const { data: userData, error: userError } =
    await sb.auth.getUser(token)

  if (userError || !userData.user) {
    return json(req, { error: "unauthorized" }, 401)
  }

  const { data: requester } = await sb
    .from("profiles")
    .select("id,role,status")
    .eq("id", userData.user.id)
    .single()

  if (
    !requester ||
    requester.role !== "admin" ||
    requester.status !== "active"
  ) {
    return json(req, { error: "forbidden" }, 403)
  }

  let body: RequestBody

  try {
    body = await req.json()
  } catch {
    return json(req, { error: "invalid_json" }, 400)
  }

  if (body.action !== "delete_student") {
    return json(req, { error: "invalid_action" }, 400)
  }

  const studentId = String(body.student_id || "").trim()

  if (!studentId) {
    return json(req, { error: "student_id_required" }, 400)
  }

  if (studentId === requester.id) {
    return json(req, { error: "cannot_delete_self" }, 400)
  }

  const { data: target, error: targetError } = await sb
    .from("profiles")
    .select("id,name,email,role,status")
    .eq("id", studentId)
    .single()

  if (targetError || !target) {
    return json(req, { error: "student_not_found" }, 404)
  }

  if (target.role !== "student") {
    return json(req, { error: "target_is_not_student" }, 403)
  }

  const { error: deleteError } =
    await sb.auth.admin.deleteUser(studentId)

  if (deleteError) {
    console.error(
      "admin-student-management delete failed",
      deleteError,
    )

    return json(req, { error: "delete_failed" }, 500)
  }

  return json(req, {
    ok: true,
    deleted_student_id: studentId,
    deleted_name: target.name,
    deleted_email: target.email,
  })
})
