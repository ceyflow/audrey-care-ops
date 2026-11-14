// Supabase Edge Function: chat-push
//
// Sends a phone/browser notification (Web Push) for a chat message. The sender's app calls it right after the message
// was saved: { message_id }. Only a signed-in, switched-on member is accepted, and only for a message THEY sent in the
// last 10 minutes that has not been pushed yet (the database marks it pushed, so repeat calls do nothing).
// Recipients: everyone with chat access who registered a device (push_subscriptions) and belongs to that chat
// (all of them for the Team chat, the other person for a private chat). The sender's own devices are skipped.
// The signing keys live in the database (private.push_vapid, readable only by the service role through push_vapid_keys()).
//
// Deploy: supabase functions deploy chat-push        (JWT is verified)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ ok: false, error: "POST only" }, 405);

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return json({ ok: false, error: "unauthorized" }, 401);
  const caller = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error: uerr } = await caller.auth.getUser();
  if (uerr || !user) return json({ ok: false, error: "unauthorized" }, 401);
  const { data: profile } = await caller.from("profiles").select("active").eq("id", user.id).maybeSingle();
  if (!profile || profile.active === false) return json({ ok: false, error: "unauthorized" }, 401);

  let messageId = "";
  try { messageId = String((await req.json()).message_id || ""); } catch (_) { /* below */ }
  if (!/^[0-9a-f-]{36}$/i.test(messageId)) return json({ ok: false, error: "bad message_id" }, 400);

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: info, error: terr } = await admin.rpc("chat_push_targets", { p_message: messageId, p_sender: user.id });
  if (terr) return json({ ok: false, error: terr.message }, 500);
  if (!info) return json({ ok: true, sent: 0, note: "nothing to send" });
  const targets: { endpoint: string; p256dh: string; auth: string }[] = info.targets || [];
  if (!targets.length) return json({ ok: true, sent: 0 });

  const { data: keys, error: kerr } = await admin.rpc("push_vapid_keys");
  if (kerr || !keys) return json({ ok: false, error: "keys missing" }, 500);
  webpush.setVapidDetails(keys.subject, keys.public, keys.private);

  const payload = JSON.stringify({
    title: info.kind === "team" ? `${info.sender} · Team chat` : String(info.sender || "New message"),
    body: String(info.body || ""),
    thread: info.thread,
    tag: "chat-" + info.thread,
  });
  let sent = 0, dead = 0, failed = 0;
  await Promise.all(targets.map(async (t) => {
    try {
      await webpush.sendNotification({ endpoint: t.endpoint, keys: { p256dh: t.p256dh, auth: t.auth } }, payload, { TTL: 3600, urgency: "high" });
      sent++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) { dead++; await admin.rpc("push_mark_dead", { p_endpoint: t.endpoint }); }
      else failed++;
    }
  }));
  return json({ ok: true, sent, dead, failed });
});
