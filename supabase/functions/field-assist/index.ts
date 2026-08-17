// ============================================================
// Watchtower edge function: field-assist
// Composes an IMIST-AMBO handover from a patient's field-log
// timeline using the Claude API. The API key stays server-side.
//
// Deploy: Supabase Dashboard → Edge Functions → New function
//   name: field-assist  → paste this file → Deploy
// Secret: Edge Functions → field-assist → Secrets →
//   ANTHROPIC_API_KEY = <your key from console.anthropic.com>
// ============================================================

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'content-type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const { mode, patient, entries } = await req.json();
    const key = Deno.env.get('ANTHROPIC_API_KEY');
    if (!key) return json({ error: 'ANTHROPIC_API_KEY secret is not set' }, 500);
    if (mode !== 'handoff') return json({ error: 'unknown mode' }, 400);

    const timeline = (entries ?? [])
      .map((e: { at: string; type: string; payload?: { at_client?: string; text?: string; triage?: string; status?: string } }) => {
        const t = new Date(e.payload?.at_client ?? e.at).toISOString().slice(11, 16);
        const body = e.payload?.text ?? (e.payload?.triage ? `triage set to ${e.payload.triage}` : e.payload?.status ? `status: ${e.payload.status}` : e.type);
        return `${t}Z  ${body}`;
      })
      .join('\n');

    const prompt = `You are assisting an emergency responder at handover to hospital staff.
From the raw field log below, compose a concise IMIST-AMBO handover report.

Rules:
- IMIST-AMBO sections: Identity; Mechanism/Medical complaint; Injuries/Information; Signs & symptoms (with trends over time); Treatment (with times); Allergies; Medications; Background; Other.
- Use ONLY facts present in the log. For any section with no information, write "[not recorded]" — NEVER invent clinical details.
- Extract medications with doses and times precisely as logged.
- Keep it tight enough to read aloud in under 60 seconds.
- Plain text, no markdown.

Patient: ${patient?.tag ? `triage tag ${patient.tag}` : `patient number ${patient?.num}`}, triage category: ${patient?.triage ?? 'unknown'}.

Field log (times UTC):
${timeline || '(no entries)'}`;

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 700,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    const data = await r.json();
    if (!r.ok) return json({ error: data?.error?.message ?? 'Claude API error' }, 502);

    const text = Array.isArray(data.content)
      ? data.content.filter((c: { type: string }) => c.type === 'text').map((c: { text: string }) => c.text).join('\n')
      : '';
    return json({ handoff: text });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
