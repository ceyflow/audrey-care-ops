// Supabase Edge Function: track-citypak
//
// Keeps the CityPak Falcon API key off the client. The public "Track your order" page
// (audrey-care-ops-v9.html) calls this with ?tracking_number=..., and this function attaches
// the real API key and forwards the request to CityPak's order-tracking endpoint. That way
// customers see live delivery status right inside our own tracking page and never have to
// visit CityPak's site at all.
//
// Deploy:
//   supabase functions deploy track-citypak --no-verify-jwt
//
// Secrets (set once, from the project root):
//   supabase secrets set CITYPAK_API_KEY=your_citypak_falcon_api_key
//   supabase secrets set CITYPAK_APP_SECRET=some-long-random-string
//
// CITYPAK_API_KEY is the Bearer token CityPak issued you for their Falcon customer API.
// This function also serves the PUBLIC tracking page, where nobody is signed in, so it cannot ask for a
// sign-in. Instead it (1) only answers for a tracking number that belongs to one of OUR CityPak orders
// (checked in the database), so it can never be used as a free look-up for arbitrary numbers, and
// (2) limits each visitor address. The old shared password CITYPAK_APP_SECRET sat inside the public page and
// protected nothing; it is no longer used (treat it as leaked).
//
// While testing against CityPak's sandbox instead of production, also set:
//   supabase secrets set CITYPAK_BASE_URL=https://staging.citypak.lk

const DEFAULT_BASE_URL = "https://falcon.citypak.lk";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-citypak-secret", // x-citypak-secret: only so pages that are still open from before the update do not fail their preflight; the value is ignored
};


// ---- who is calling? -------------------------------------------------------------------------------
// This function used to be protected by a shared password (a secret string) that had to be written into the
// public web page, which made it public. It now checks the caller's own sign-in instead: only a real,
// switched-on member of the app (a profiles row with active = true) may use it.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "GET") return json({ ok: false, error: "GET only" }, 405);

  const url = new URL(req.url);
  const trackingNumber = (url.searchParams.get("tracking_number") || "").trim();
  if (!trackingNumber || trackingNumber.length > 40) return json({ ok: false, error: "tracking_number is required" }, 400);

  // 90 look-ups per 10 minutes per visitor address (the tracking page re-checks every 30 seconds while a parcel is in transit)
  const member = await memberFromRequest(req);
  if (!(await underLimit("citypak", member ? member.id : clientIp(req), 600, 90))) {
    return json({ ok: false, error: "too many requests — try again in a few minutes" }, 429);
  }

  // Only numbers that belong to one of our own CityPak orders.
  try {
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: known, error: knownErr } = await admin.rpc("order_has_citypak_number", { p_number: trackingNumber });
    if (knownErr) return json({ ok: false, error: "could not check the tracking number" }, 500);
    if (known !== true) return json({ ok: false, error: "No tracking found for that number." }, 404);
  } catch (_e) {
    return json({ ok: false, error: "could not check the tracking number" }, 500);
  }

  const apiKey = Deno.env.get("CITYPAK_API_KEY");
  if (!apiKey) {
    return json({ ok: false, error: "CityPak tracking is not configured (missing CITYPAK_API_KEY secret)" }, 500);
  }
  const baseUrl = Deno.env.get("CITYPAK_BASE_URL") || DEFAULT_BASE_URL;

  try {
    const citypakRes = await fetch(
      baseUrl + "/customer_api/v1/track?tracking_number=" + encodeURIComponent(trackingNumber),
      { headers: { "Authorization": "Bearer " + apiKey } },
    );
    const text = await citypakRes.text();
    let parsed: any;
    try { parsed = JSON.parse(text); } catch { parsed = { raw: text }; }

    if (!citypakRes.ok) {
      const message = (parsed && parsed.message) || "CityPak rejected the request";
      return json({ ok: false, error: message, detail: parsed }, citypakRes.status === 404 ? 404 : 502);
    }
    // CityPak's success body is { is_success: true, data: {...} } — pass the tracking data
    // straight through so the frontend can render it.
    return json({ ok: true, data: parsed.data });
  } catch (e) {
    return json({ ok: false, error: "could not reach CityPak", detail: String(e) }, 502);
  }
});
