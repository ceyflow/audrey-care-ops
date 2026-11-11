// Supabase Edge Function: admin-delete-account
//
// Lets a signed-in Admin permanently delete someone else's account -- their Supabase
// Auth login AND their profiles row, not just their entry in the app's own account
// list. Removing someone via Settings used to only clear them from that list, leaving
// their real login behind forever (confirmed: re-adding the same name later failed
// with "already registered", since the underlying account was still there) -- this is
// the fix, explicitly requested after that confusion. Deleting an auth.users row needs
// the project's service-role secret key, which must never reach client code (every
// visitor's browser runs that code), so this runs server-side only, same pattern as
// admin-reset-password: re-check independently that the caller is really an Admin
// before doing anything, never trust the app's own client-side check alone.
//
// The target account is found by the NAME on its profile (exact, case-insensitive). The previous
// version matched any login whose address merely ended in "-<name>@audreyops.internal", which could
// delete the wrong person's account; that suffix guess is gone.
//
// Deploy with the Supabase CLI from the project root:
//   npx supabase functions deploy admin-delete-account
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

  let loginName: string;
  try {
    const body = await req.json();
    loginName = (body.loginName || '').trim();
  } catch {
    return jsonResponse({ error: 'Invalid request body' }, 400);
  }
  if (!loginName) return jsonResponse({ error: 'loginName is required' }, 400);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return jsonResponse({ error: 'Not authenticated' }, 401);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // A client scoped to the CALLER's own token -- used only to find out who is calling.
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
    return jsonResponse({ error: 'Only Admin can delete another account' }, 403);
  }

  // Only now, after confirming the caller is really an Admin, escalate with the secret key.
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const target = await findTarget(adminClient, loginName);
  if ('error' in target) return jsonResponse({ error: target.error }, target.status);

  // Defense in depth: never let an Admin delete the very account they're calling this
  // with, even if the app's own client-side "can't remove yourself" check were ever
  // bypassed or out of date -- this is permanent, so this one guard stays server-side too.
  if (target.id === callerUser.id) {
    return jsonResponse({ error: "You can't delete the account you're signed in as" }, 400);
  }

  // Delete the profile first: if this fails, the login deletion below is skipped too, rather than
  // leaving the login gone but the profile orphaned.
  const { error: profileErr } = await adminClient.from('profiles').delete().eq('id', target.id);
  if (profileErr) return jsonResponse({ error: profileErr.message }, 500);

  const { error: deleteErr } = await adminClient.auth.admin.deleteUser(target.id);
  if (deleteErr) return jsonResponse({ error: deleteErr.message }, 500);

  return jsonResponse({ ok: true });
});
