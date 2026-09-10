import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "npm:@supabase/supabase-js@2.57.4"
import webpush from "npm:web-push@3.6.7"

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("method_not_allowed", { status: 405 })

  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  if (!supabaseUrl || !serviceRoleKey) return new Response("server_not_configured", { status: 500 })

  const sb = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: rows, error: configError } = await sb.rpc("get_admin_push_delivery_config")
  const config = Array.isArray(rows) ? rows[0] : null
  if (configError || !config) return new Response("config_unavailable", { status: 500 })

  const provided = req.headers.get("x-rv-push-secret") || ""
  if (!provided || provided !== config.webhook_secret) {
    return new Response("unauthorized", { status: 401 })
  }

  const keys = webpush.generateVAPIDKeys()
  const { error } = await sb.rpc("rotate_admin_push_vapid", {
    p_public_key: keys.publicKey,
    p_private_key: keys.privateKey,
  })

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json" } })

  return new Response(JSON.stringify({ ok: true, public_key: keys.publicKey }), {
    status: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  })
})
