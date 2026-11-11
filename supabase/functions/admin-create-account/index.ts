// Supabase Edge Function: admin-create-account
//
// Lets a signed-in Admin create a new login (a real Supabase Auth account plus its profiles row).
// Creating the account on a server is what makes it safe to forbid the browser from creating profile
// rows itself: until now the browser signed the new person up with the public key and then wrote the
// profile (including the access level) AS that new person, which meant ANY signed-in user could also
// write themselves a profile with any access level. Now only this function (service-role key, and only
// after it has re-checked that the caller really is an Admin) can create one.
//
// Deploy with the Supabase CLI from the project root:
//   npx supabase functions deploy admin-create-account
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  let name = '', role = '', password = '';
  try {
    const body = await req.json();
    name = String(body.name ?? '').trim();
    role = String(body.role ?? '').trim();
    password = String(body.password ?? '');
  } catch {
    return jsonResponse({ error: 'Invalid request body' }, 400);
  }
  if (!name || name.length > 60) return jsonResponse({ error: 'A user login of 1 to 60 characters is required' }, 400);
  if (!role || role.length > 60) return jsonResponse({ error: 'An access level is required' }, 400);
  if (password.length < 6 || password.length > 72) return jsonResponse({ error: 'Password must be 6 to 72 characters' }, 400);

  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-+|-+$)/g, '');
  if (!slug) return jsonResponse({ error: 'The user login needs at least one letter or number' }, 400);
  const email = `${slug}@audreyops.internal`;

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return jsonResponse({ error: 'Not authenticated' }, 401);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // A client scoped to the CALLER's own token: used only to find out who is calling.
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
    return jsonResponse({ error: 'Only Admin can create an account' }, 403);
  }

  // Only now, after confirming the caller is really an Admin, escalate with the secret key.
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // One person, one name: refuse a name that already belongs to someone (case-insensitive).
  const { data: profiles, error: listErr } = await adminClient.from('profiles').select('id, staff_name');
  if (listErr) return jsonResponse({ error: listErr.message }, 500);
  if ((profiles ?? []).some((p) => (p.staff_name ?? '').trim().toLowerCase() === name.toLowerCase())) {
    return jsonResponse({ error: 'User already registered' }, 409);
  }

  const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createErr || !created?.user) {
    const msg = createErr?.message ?? 'Could not create the login';
    // A login with this address exists but has no profile (an orphan): report it the way the app expects,
    // so it can offer to reuse that login and reset its password.
    const taken = /already|registered|exists/i.test(msg);
    return jsonResponse({ error: taken ? 'User already registered' : msg }, taken ? 409 : 400);
  }

  const { error: profileErr } = await adminClient
    .from('profiles')
    .insert({ id: created.user.id, role, staff_name: name, active: true });
  if (profileErr) {
    // Do not leave a login without a profile behind.
    await adminClient.auth.admin.deleteUser(created.user.id);
    return jsonResponse({ error: profileErr.message }, 500);
  }

  return jsonResponse({ ok: true, userId: created.user.id });
});
