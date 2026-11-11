// Supabase Edge Function: send-sms
//
// Keeps the send.lk API token off the client. The frontend (audrey-care-ops-v9.html)
// posts { recipient, message } here; this function attaches the real API token and
// forwards the request to send.lk.
//
// Deploy:
//   supabase functions deploy send-sms --no-verify-jwt
//
// Secrets (set once, from the project root):
//   supabase secrets set SEND_LK_API_TOKEN=xxxxx SEND_LK_SENDER_ID=xxxxx SMS_APP_SECRET=some-long-random-string
//
// SEND_LK_SENDER_ID_OUTSTANDING is optional — only the payment-reminder feature requests it (via
// body.purpose === "outstanding"), everything else (order/packing notifications, bulk campaigns,
// quick send) always uses the default SEND_LK_SENDER_ID above, unchanged. Falls back to the
// default sender ID if this one isn't set, so nothing breaks before it's configured:
//   supabase secrets set SEND_LK_SENDER_ID_OUTSTANDING=xxxxx
//
// Only a signed-in, switched-on member of the app can send (the page sends its own sign-in token).
// The old shared password SMS_APP_SECRET sat inside the public page, so it protected nothing; it is no
// longer needed (and should be treated as leaked).

const SEND_LK_ENDPOINT = "https://sms.send.lk/api/v3/sms/send";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-sms-secret",
};


// ---- who is calling? -------------------------------------------------------------------------------
// This function used to be protected by a shared password (a secret string) that had to be written into the
// public web page, which made it public. It now checks the caller's own sign-in instead: only a real,
// switched-on member of the app (a profiles row with active = true) may use it.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// While every open copy of the page is being updated, the old shared-password header is still accepted as well.
// Set to false (and redeploy) afterwards: the leaked password is then useless.
const ALLOW_LEGACY_SECRET = true;

async function memberFromRequest(req: Request): Promise<{ id: string; role: string } | null> {
  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return null;
  const caller = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error } = await caller.auth.getUser();
  if (error || !user) return null; // the public (anonymous) key is not a person
  const { data: profile } = await caller.from("profiles").select("role, active").eq("id", user.id).maybeSingle();
  if (!profile || profile.active === false) return null;
  return { id: user.id, role: profile.role };
}

function clientIp(req: Request): string {
  const raw = req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for") || "";
  return raw.split(",")[0].trim() || "unknown";
}

// true while `ident` is still under `max` calls per `windowSeconds` for this bucket (counted in the database).
async function underLimit(bucket: string, ident: string, windowSeconds: number, max: number): Promise<boolean> {
  try {
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data, error } = await admin.rpc("bump_rate_limit", { p_bucket: bucket, p_ident: ident, p_window_seconds: windowSeconds, p_max: max });
    if (error) { console.error("rate limit check failed", error.message); return true; }
    return data === true;
  } catch (e) {
    console.error("rate limit check threw", String(e));
    return true;
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

// Sri Lankan numbers only: normalizes "0771234567" / "+94771234567" / "94771234567" -> "94771234567".
// Also recovers from a doubled prefix like "+94 0771234567" (country code AND the leading 0 both
// present) — a common paste/typo that used to slip through as an invalid 12-digit number and get
// silently rejected by send.lk, while every normally-formatted number kept working fine.
function normalizeLkNumber(raw: string): string | null {
  let digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("0094")) digits = digits.slice(2); // international "00" dialing prefix
  if (digits.startsWith("94")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = digits.slice(1);
  if (digits.length !== 9) return null;
  return "94" + digits;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ ok: false, error: "POST only" }, 405);

  const member = await memberFromRequest(req);
  const legacySecret = Deno.env.get("SMS_APP_SECRET") || "";
  const legacyOk = ALLOW_LEGACY_SECRET && legacySecret !== "" && req.headers.get("x-sms-secret") === legacySecret;
  if (!member && !legacyOk) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }
  // 1500 messages per hour per person is far above real use (the biggest campaign) and caps a stolen sign-in.
  if (!(await underLimit("sms", member ? member.id : "legacy:" + clientIp(req), 3600, 1500))) {
    return json({ ok: false, error: "too many messages this hour — try again later" }, 429);
  }

  let body: { recipient?: string; message?: string; purpose?: string };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "invalid JSON body" }, 400);
  }

  const recipient = normalizeLkNumber(body.recipient || "");
  const message = String(body.message || "").trim();
  if (!recipient) return json({ ok: false, error: "a valid recipient phone number is required" }, 400);
  if (!message) return json({ ok: false, error: "message is required" }, 400);
  if (message.length > 1000) return json({ ok: false, error: "message is too long" }, 400);

  const apiToken = Deno.env.get("SEND_LK_API_TOKEN");
  const defaultSenderId = Deno.env.get("SEND_LK_SENDER_ID");
  // purpose selects between a small, fixed set of server-side secrets — the client can never pass
  // an arbitrary sender ID through directly, only pick which pre-configured one applies.
  const senderId = (body.purpose === "outstanding" && Deno.env.get("SEND_LK_SENDER_ID_OUTSTANDING")) ||
    defaultSenderId;
  if (!apiToken || !senderId) {
    return json({ ok: false, error: "SMS gateway is not configured (missing secrets)" }, 500);
  }

  try {
    const gatewayRes = await fetch(SEND_LK_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + apiToken,
      },
      body: JSON.stringify({
        recipient,
        sender_id: senderId,
        type: "plain",
        message,
      }),
    });
    const text = await gatewayRes.text();
    let parsed: unknown;
    try { parsed = JSON.parse(text); } catch { parsed = { raw: text }; }

    if (!gatewayRes.ok) {
      return json({ ok: false, error: "send.lk rejected the request", detail: parsed }, 502);
    }
    return json({ ok: true, detail: parsed });
  } catch (e) {
    return json({ ok: false, error: "could not reach send.lk", detail: String(e) }, 502);
  }
});
