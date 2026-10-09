// Admin-only account management. Only a signed-in admin (per public.is_admin())
// can create, reset or delete staff logins. Runs with the service role, which
// Supabase injects into the function environment — it never reaches the browser.
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const authHeader = req.headers.get('Authorization') ?? '';

  // Who is calling? Ask the database, using the caller's own token.
  const caller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: isAdmin, error: adminErr } = await caller.rpc('is_admin');
  if (adminErr || isAdmin !== true) return json({ error: 'Admins only' }, 403);
  const { data: callerId } = await caller.rpc('current_staff_id');

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const findAuthUser = async (email: string) => {
    for (let page = 1; page <= 20; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw error;
      const hit = data.users.find((u) => u.email?.toLowerCase() === email);
      if (hit) return hit;
      if (data.users.length < 200) return null;
    }
    return null;
  };

  try {
    const action = body.action;

    if (action === 'create') {
      const name = String(body.name ?? '').trim();
      const email = String(body.email ?? '').trim().toLowerCase();
      const password = String(body.password ?? '');
      const role = body.role === 'admin' ? 'admin' : 'staff';
      if (!name || !EMAIL.test(email)) return json({ error: 'A name and a valid email are required' }, 400);
      if (password.length < 8) return json({ error: 'Password must be at least 8 characters' }, 400);

      const { data: row, error: insErr } = await admin
        .from('staff').insert({ name, email, role }).select('id').single();
      if (insErr) {
        return json({ error: insErr.code === '23505' ? 'That email is already on the staff list' : insErr.message }, 400);
      }

      const { error: createErr } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      if (createErr) {
        // A login may linger from an earlier staff member with this email: reuse it.
        const existing = await findAuthUser(email);
        if (existing) {
          const { error: upErr } = await admin.auth.admin.updateUserById(existing.id, { password, email_confirm: true });
          if (upErr) {
            await admin.from('staff').delete().eq('id', row.id);
            return json({ error: upErr.message }, 400);
          }
        } else {
          await admin.from('staff').delete().eq('id', row.id);
          return json({ error: createErr.message }, 400);
        }
      }
      return json({ ok: true, id: row.id });
    }

    if (action === 'set-password') {
      const email = String(body.email ?? '').trim().toLowerCase();
      const password = String(body.password ?? '');
      if (password.length < 8) return json({ error: 'Password must be at least 8 characters' }, 400);
      const { data: member } = await admin.from('staff').select('id').eq('email', email).maybeSingle();
      if (!member) return json({ error: 'Not on the staff list' }, 404);
      const existing = await findAuthUser(email);
      if (existing) {
        const { error } = await admin.auth.admin.updateUserById(existing.id, { password, email_confirm: true });
        if (error) return json({ error: error.message }, 400);
      } else {
        const { error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
        if (error) return json({ error: error.message }, 400);
      }
      return json({ ok: true });
    }

    if (action === 'delete') {
      const id = Number(body.id);
      if (!Number.isInteger(id)) return json({ error: 'Invalid id' }, 400);
      if (id === callerId) return json({ error: "You can't remove your own account" }, 400);
      const { data: member } = await admin.from('staff').select('email').eq('id', id).maybeSingle();
      if (!member) return json({ error: 'Not found' }, 404);
      const { error: delErr } = await admin.from('staff').delete().eq('id', id);
      if (delErr) return json({ error: delErr.message }, 400);
      const existing = await findAuthUser(member.email.toLowerCase());
      if (existing) await admin.auth.admin.deleteUser(existing.id);
      return json({ ok: true });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
