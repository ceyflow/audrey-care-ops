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
// SMS_APP_SECRET is a shared password between this function and the frontend (see
// SMS_APP_SECRET near SUPABASE_URL in the HTML file) so random visitors who find the
// function URL can't send SMS through your account. It is not cryptographically
// airtight (it still ships inside the page's JS like the Supabase anon key already
// does), but it stops casual abuse of the endpoint.

const SEND_LK_ENDPOINT = "https://sms.send.lk/api/v3/sms/send";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-sms-secret",
};

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

  const appSecret = Deno.env.get("SMS_APP_SECRET") || "";
  if (appSecret && req.headers.get("x-sms-secret") !== appSecret) {
    return json({ ok: false, error: "unauthorized" }, 401);
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
