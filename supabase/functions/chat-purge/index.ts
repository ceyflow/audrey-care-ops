// Supabase Edge Function: chat-purge
//
// Chats keep 90 days. Older messages are ALREADY invisible to everyone (the database rules hide them), this function
// physically removes them (and their reactions) to keep the database small. An Admin's browser calls it about once a day
// after loading the app; only a signed-in, switched-on Admin is accepted.
//
// Deploy: supabase functions deploy chat-purge        (JWT is verified, and the caller must be an Admin)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const KEEP_DAYS = 90;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
}

async function adminFromRequest(req: Request): Promise<boolean> {
  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return false;
  const caller = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error } = await caller.auth.getUser();
  if (error || !user) return false;
  const { data: profile } = await caller.from("profiles").select("role, active").eq("id", user.id).maybeSingle();
  return !!profile && profile.active !== false && profile.role === "Admin";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ ok: false, error: "POST only" }, 405);
  if (!(await adminFromRequest(req))) return json({ ok: false, error: "unauthorized" }, 401);

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const cutoff = new Date(Date.now() - KEEP_DAYS * 86400 * 1000).toISOString();
  let removed = 0;
  for (let round = 0; round < 10; round++) {
    const { data: rows, error } = await admin.from("chat_messages").select("id").lt("created_at", cutoff).limit(500);
    if (error) return json({ ok: false, error: error.message, removed }, 500);
    if (!rows || rows.length === 0) break;
    const ids = rows.map((r: { id: string }) => r.id);
    const r1 = await admin.from("chat_reactions").delete().in("message_id", ids);
    if (r1.error) return json({ ok: false, error: r1.error.message, removed }, 500);
    const r2 = await admin.from("chat_messages").delete().in("id", ids);
    if (r2.error) return json({ ok: false, error: r2.error.message, removed }, 500);
    removed += ids.length;
    if (rows.length < 500) break;
  }
  return json({ ok: true, removed, cutoff });
});
