// ============================================================
// Watchtower edge function: join
// Redeems an invitation code and creates the account directly — no
// confirmation email. The code is the proof: it is random, single-use,
// expires, and can be locked to one email address. The existing
// handle_new_user trigger attaches the person to the inviting company
// with the invited role and marks the code accepted.
// ============================================================

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const supaUrl = Deno.env.get('SUPABASE_URL')!;
  const svc = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const H = { apikey: svc, Authorization: `Bearer ${svc}`, 'Content-Type': 'application/json' };

  try {
    const { code, email, password, display_name, language } = await req.json();
    const cleanCode = String(code ?? '').trim();
    const cleanEmail = String(email ?? '').trim().toLowerCase();
    const name = String(display_name ?? '').trim().slice(0, 80);
    if (!cleanCode || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) return json({ error: 'invalid_input' }, 400);
    if (String(password ?? '').length < 8) return json({ error: 'weak_password' }, 400);

    const inv = (await (await fetch(
      `${supaUrl}/rest/v1/invitations?code=eq.${encodeURIComponent(cleanCode)}&select=id,status,expires_at,email&limit=1`,
      { headers: H },
    )).json())?.[0];
    if (!inv || inv.status !== 'pending') return json({ error: 'code_not_valid' }, 400);
    if (Date.parse(inv.expires_at) < Date.now()) return json({ error: 'code_expired' }, 400);
    if (inv.email && inv.email.toLowerCase() !== cleanEmail) return json({ error: 'code_other_email' }, 400);

    const r = await fetch(`${supaUrl}/auth/v1/admin/users`, {
      method: 'POST', headers: H,
      body: JSON.stringify({
        email: cleanEmail, password, email_confirm: true,
        user_metadata: { invite_code: cleanCode, display_name: name || undefined, language: language || undefined },
      }),
    });
    if (!r.ok) {
      const t = await r.text();
      if (/already|registered|exists/i.test(t)) return json({ error: 'email_exists' }, 409);
      return json({ error: 'create_failed', detail: t.slice(0, 200) }, 500);
    }
    return json({ ok: true });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
