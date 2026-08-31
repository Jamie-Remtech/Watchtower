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
    const { mode, patient, entries, question, context, history, picture, situation, run, events } = await req.json();
    const key = Deno.env.get('ANTHROPIC_API_KEY');
    if (!key) return json({ error: 'ANTHROPIC_API_KEY secret is not set' }, 500);

    const callClaude = async (body: Record<string, unknown>) => {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model: 'claude-sonnet-5', ...body }),
      });
      const data = await r.json();
      return { ok: r.ok, data };
    };
    const textOf = (data: { content?: Array<{ text?: string }> }) =>
      Array.isArray(data.content)
        ? data.content.filter((c) => typeof c.text === 'string').map((c) => c.text).join('\n')
        : '';
    const parseJson = (raw: string) => {
      const t = raw.replace(/```(?:json)?/gi, '').trim();
      try { return JSON.parse(t); } catch {
        const m = t.match(/\{[\s\S]*\}/);
        if (m) { try { return JSON.parse(m[0]); } catch { /* still bad */ } }
      }
      return null;
    };

    // ---- mode: protocol_draft — turn a situation into a playbook ----
    if (mode === 'protocol_draft') {
      const prompt = `You are Watchtower's protocol author for an emergency response organization.
Draft a response protocol (an actionable checklist the crew executes together) for the situation below.

Rules:
- 5 to 12 steps. Each step is ONE concrete action a responder can check off — start with a verb.
- Order matters: life safety first (account for people, escape routes), then containment/mitigation, then communication/logging.
- Include a step to notify the coordinator and a final step to stand down / debrief.
- Ground the steps in the situation given; no generic filler.
- Respond with STRICT JSON only, no prose, no code fences:
{"name":"short protocol name","trigger_kind":"wildfire|seismic|weather|medical|custom","description":"one sentence on when to run this","steps":["step 1","step 2"]}

SITUATION:
${String(situation ?? '').slice(0, 1500)}

LIVE CONTEXT (may be empty):
${JSON.stringify(context ?? {}, null, 1).slice(0, 2000)}`;

      const { ok, data } = await callClaude({ max_tokens: 1500, messages: [{ role: 'user', content: prompt }] });
      if (!ok) return json({ error: data?.error?.message ?? 'Claude API error' }, 502);
      const parsed = parseJson(textOf(data));
      if (parsed && Array.isArray(parsed.steps)) return json(parsed);
      return json({ error: 'unparseable draft', raw: textOf(data).slice(0, 300) }, 502);
    }

    // ---- mode: debrief — after-action summary of a completed run ----
    if (mode === 'debrief') {
      const prompt = `You are Watchtower's after-action analyst. A response protocol run just ended.
Write a debrief the coordinator will keep on file — this is how the organization learns patterns.

Rules:
- Plain text, no markdown. Four short labeled sections: WHAT HAPPENED / TIMELINE HIGHLIGHTS / WHAT WORKED / IMPROVE NEXT TIME.
- Use ONLY the run data and event log given. Note steps skipped or done out of order, and gaps between steps that look long.
- Name people by the names given when crediting actions.
- Under 200 words total.

RUN:
${JSON.stringify(run ?? {}, null, 1).slice(0, 4000)}

ORG EVENT LOG DURING THE RUN (may be empty):
${JSON.stringify(events ?? [], null, 1).slice(0, 3000)}`;

      const { ok, data } = await callClaude({ max_tokens: 700, messages: [{ role: 'user', content: prompt }] });
      if (!ok) return json({ error: data?.error?.message ?? 'Claude API error' }, 502);
      return json({ debrief: textOf(data).trim() });
    }

    // ---- mode: cascade — secondary/chained risk analysis around people ----
    if (mode === 'cascade') {
      const prompt = `You are Watchtower's cascade-risk analyst for an emergency response team.
Below is the live picture: anchors (people/assets with positions) and active threats nearby (fires with weather where available, earthquakes).

Identify SECONDARY and CASCADING dangers that follow from these threats, per anchor where relevant:
- fire spread setups: wind carrying fire toward an anchor, dry/hot corridors downwind
- post-seismic chains: landslides, rockfall, dam/glacier/lahar-mudflow risk where the region plausibly has steep or glaciated terrain (judge from place names and latitude), aftershock exposure
- weather chains: storm→flash flood in burned or steep areas, smoke→air quality downwind

Rules:
- Base every warning ONLY on the data given plus well-established physical reasoning. State the chain explicitly (X → Y → risk to Z).
- Include rough distances/directions using the coordinates.
- If nothing meaningful, return an empty list — silence is better than noise.
- Respond with STRICT JSON only, no prose, no code fences:
{"warnings":[{"severity":"critical|warning|info","title":"short, names the anchor when specific","detail":"the chain and what to do, 1-3 sentences","key":"short-stable-slug"}]}

LIVE PICTURE:
${JSON.stringify(picture ?? {}, null, 1)}`;

      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model: 'claude-sonnet-5', max_tokens: 3000, messages: [{ role: 'user', content: prompt }] }),
      });
      const data = await r.json();
      if (!r.ok) return json({ error: data?.error?.message ?? 'Claude API error' }, 502);
      let text = Array.isArray(data.content)
        ? data.content.filter((c: { text?: string }) => typeof c.text === 'string').map((c: { text: string }) => c.text).join('\n')
        : '';
      text = text.replace(/```(?:json)?/gi, '').trim();
      // Parse strictly, then fall back to the outermost JSON object anywhere
      // in the reply — models sometimes add a sentence around the JSON.
      let parsed: { warnings?: unknown } | null = null;
      try { parsed = JSON.parse(text); } catch {
        const m = text.match(/\{[\s\S]*\}/);
        if (m) { try { parsed = JSON.parse(m[0]); } catch { /* still bad */ } }
      }
      if (parsed && Array.isArray(parsed.warnings)) return json({ warnings: parsed.warnings });
      return json({
        warnings: [], note: 'unparseable analysis', raw: text.slice(0, 300),
        stop_reason: data.stop_reason,
        block_types: Array.isArray(data.content) ? data.content.map((c: { type: string }) => c.type) : null,
      });
    }

    // ---- mode: ask — voice Q&A over the live operational snapshot,
    // with real actions the client executes under the asker's own
    // permissions (RLS): start a protocol, message the team, raise an alert.
    if (mode === 'ask') {
      const system = `You are Watchtower, the tactical coordination AI for an emergency response team.
You answer questions from coordinators and field responders about THEIR live operation, and you can ACT.

Rules:
- Answer ONLY from the live state snapshot below. If something isn't tracked there, say so plainly.
- Radio style: short sentences, concrete facts, no markdown, no bullet symbols. Fit an answer in a few sentences — it may be read aloud.
- When coordinates are involved, give rough distance and compass direction from the asker's position when known (approximate is fine).
- Safety first: if the state shows critical attention items or red-triage patients relevant to the question, mention them.
- Times in the snapshot are ISO/UTC; phrase them as minutes/hours ago relative to "now".

Actions:
- Use a tool ONLY when the user clearly asks for that action (start/run a protocol, tell/message the team, raise/log an alert) — never speculatively. If they merely describe a situation, answer and OFFER the action instead.
- start_protocol only with a name from available_protocols; if none fits, say so.
- When you use a tool, also say in words what you are doing.

LIVE STATE SNAPSHOT:
${JSON.stringify(context ?? {}, null, 1)}`;

      const tools = [
        {
          name: 'start_protocol',
          description: "Start a live run of one of the organization's response protocols. The whole team is alerted and gets the shared checklist.",
          input_schema: {
            type: 'object',
            properties: { protocol_name: { type: 'string', description: 'Exact name from available_protocols' } },
            required: ['protocol_name'],
          },
        },
        {
          name: 'send_team_message',
          description: 'Send a message to the whole team in Comms (also pushed to their phones).',
          input_schema: {
            type: 'object',
            properties: { text: { type: 'string', description: 'The message, radio-brief' } },
            required: ['text'],
          },
        },
        {
          name: 'raise_alert',
          description: 'Raise an attention item for coordinators. Critical severity also pushes to pockets.',
          input_schema: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              detail: { type: 'string' },
              severity: { type: 'string', enum: ['critical', 'warning', 'info'] },
            },
            required: ['title', 'severity'],
          },
        },
      ];

      const msgs = [
        ...(Array.isArray(history) ? history.slice(-6).map((m: { role: string; content: string }) => ({ role: m.role, content: m.content })) : []),
        { role: 'user', content: String(question ?? '') },
      ];

      const { ok, data } = await callClaude({ max_tokens: 600, system, messages: msgs, tools });
      if (!ok) return json({ error: data?.error?.message ?? 'Claude API error' }, 502);
      const answer = Array.isArray(data.content)
        ? data.content.filter((c: { type: string }) => c.type === 'text').map((c: { text: string }) => c.text).join('\n')
        : '';
      const actions = Array.isArray(data.content)
        ? data.content.filter((c: { type: string }) => c.type === 'tool_use').map((c: { name: string; input: unknown }) => ({ name: c.name, input: c.input }))
        : [];
      return json({ answer, actions });
    }

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
