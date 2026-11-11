// Supabase Edge Function: lorry-location
//
// Receives the lorry phone's position from the free "Traccar Client" app (it keeps sending while the
// screen is off). Traccar Client sends an OsmAnd-style request such as
//   https://<project>.supabase.co/functions/v1/lorry-location?id=<DEVICE TOKEN>&lat=6.9&lon=79.8&speed=0&bearing=90&accuracy=12
// (GET, or the same fields as a form / JSON body). The "device identifier" typed into the app is the
// driver's private device token (office page -> Delivery runs -> Tracking app setup).
//
// The token is checked inside the database function lorry_ingest, which only stores a position while that
// driver has an ACTIVE run; otherwise the point is thrown away. The function always answers 200 so the phone
// app does not pile up and retry points that were deliberately ignored.
//
// Deploy: supabase functions deploy lorry-location --no-verify-jwt   (the phone app cannot send a sign-in token)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  const url = new URL(req.url);
  const p: Record<string, unknown> = {};
  url.searchParams.forEach((v, k) => { p[k] = v; });
  if (req.method === "POST") {
    const ct = req.headers.get("content-type") || "";
    try {
      if (ct.includes("application/json")) {
        const b = await req.json();
        // Traccar's JSON form: { device_id, location: { coords: { latitude, longitude, speed, heading, accuracy } } }
        const c = b?.location?.coords || {};
        Object.assign(p, { id: b?.device_id ?? b?.id, lat: c.latitude ?? b?.lat, lon: c.longitude ?? b?.lon ?? b?.lng,
          speed: c.speed ?? b?.speed, bearing: c.heading ?? b?.bearing, accuracy: c.accuracy ?? b?.accuracy });
      } else if (ct.includes("application/x-www-form-urlencoded")) {
        new URLSearchParams(await req.text()).forEach((v, k) => { if (!(k in p)) p[k] = v; });
      }
    } catch { /* ignore a malformed body: it is simply not stored */ }
  }

  const token = String(p.id ?? p.deviceid ?? "").slice(0, 80);
  const lat = num(p.lat), lng = num(p.lon ?? p.lng);
  let stored = false;
  if (token && lat !== null && lng !== null) {
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data, error } = await admin.rpc("lorry_ingest", {
      p_token: token, p_lat: lat, p_lng: lng,
      p_accuracy: num(p.accuracy), p_heading: num(p.bearing ?? p.heading), p_speed: num(p.speed),
    });
    if (error) console.error("lorry_ingest failed", error.message);
    else stored = data === true;
  }
  return new Response(JSON.stringify({ ok: true, stored }), {
    status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
});
