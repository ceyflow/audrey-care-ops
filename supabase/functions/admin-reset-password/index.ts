// Supabase Edge Function: admin-reset-password
//
// Lets a signed-in Admin set a NEW password for someone else's account, without
// knowing their current one. This can only be done safely on a server, because it
// needs the project's service-role secret key — a key that must never be placed in
// the app's own code, since that code runs in every visitor's browser and anyone
// could read it there. This function holds that secret instead, and independently
// re-checks that the caller is really an Admin before it does anything, rather than
// trusting the app's own (client-side, and therefore spoofable) permission check.
//
// The target account is found by the NAME on its profile (exact, case-insensitive). The previous
// version matched any login whose address merely ended in "-<name>@audreyops.internal", which could
// pick the wrong person's account; that suffix guess is gone.
//
// Deploy with the Supabase CLI from the project root:
//   npx supabase functions deploy admin-reset-password
// SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are provided automatically.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Finds exactly one login for a typed name. Returns { id } or { error, status }.
// deno-lint-ignore no-explicit-any
async function findTarget(adminClient: any, loginName: string): Promise<{ id: string } | { error: string; status: number }> {
  const wanted = loginName.trim().toLowerCase();
  const { data: profiles, error } = await adminClient.from('profiles').select('id, staff_name');
  if (error) return { error: error.message, status: 500 };
  const hits = (profiles ?? []).filter((p: { staff_name: string }) => (p.staff_name ?? '').trim().toLowerCase() === wanted);
  if (hits.length === 1) return { id: hits[0].id };
  if (hits.length > 1) return { error: `More than one account is named "${loginName}" — fix that first`, status: 409 };

  // No profile with that name (a login that was never given one): accept only the exact standard address.
  const slug = wanted.replace(/[^a-z0-9]+/g, '-').replace(/(^-+|-+$)/g, '');
  const targetEmail = `${slug}@audreyops.internal`;
  for (let page = 1; ; page++) {
    const { data, error: listErr } = await adminClient.auth.admin.listUsers({ page, perPage: 200 });
    if (listErr) return { error: listErr.message, status: 500 };
    const match = data.users.find((u: { email?: string }) => (u.email ?? '').toLowerCase() === targetEmail);
    if (match) return { id: match.id };
    if (data.users.length < 200) break;
  }
  return { error: `No account found for login "${loginName}"`, status: 404 };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  let loginName: string, newPassword: string;
  try {
    const body = await req.json();
    loginName = (body.loginName || '').trim();
    newPassword = body.newPassword || '';
  } catch {
    return jsonResponse({ error: 'Invalid request body' }, 400);
  }
  if (!loginName || !newPassword || newPassword.length < 6 || newPassword.length > 72) {
    return jsonResponse({ error: 'loginName and a newPassword of 6 to 72 characters are required' }, 400);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return jsonResponse({ error: 'Not authenticated' }, 401);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // A client scoped to the CALLER's own token — used only to find out who is calling.
  const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user: callerUser }, error: callerErr } = await callerClient.auth.getUser();
  if (callerErr || !callerUser) return jsonResponse({ error: 'Not authenticated' }, 401);

  const { data: callerProfile } = await callerClient
    .from('profiles')
    .select('role, active')
    .eq('id', callerUser.id)
    .maybeSingle();
  if (!callerProfile || callerProfile.role !== 'Admin' || callerProfile.active === false) {
    return jsonResponse({ error: "Only Admin can reset another account's password" }, 403);
  }

  // Only now, after confirming the caller is really an Admin, escalate with the secret key.
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const target = await findTarget(adminClient, loginName);
  if ('error' in target) return jsonResponse({ error: target.error }, target.status);

  const { error: updateErr } = await adminClient.auth.admin.updateUserById(target.id, { password: newPassword });
  if (updateErr) return jsonResponse({ error: updateErr.message }, 500);

  return jsonResponse({ ok: true });
});
