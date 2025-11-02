import { Env, Plan, ChatResponse } from '../types';
import { fromRequest } from '../config';
import { scoreEi } from '../ei/eiRules';
import { validateEiPayload } from '../validator';
import { incrementEiEmitted, incrementEiValidationFailed, recordEiLatency, withTiming } from '../metrics';
import { redactPII } from '../utils/redact';
import { json, readJson, capSentences, sanitizeLLM, extractCoach, cryptoRandomId, norm, cors } from '../utils/helpers';
import { FACTS_DB, FSM } from '../data';

/**
 * Session state helpers
 */
async function seqGet(env: Env, session: string): Promise<{ lastNorm: string; fsm: any }> {
  if (!env.SESS) return { lastNorm: '', fsm: {} };
  const k = `state:${session}`;
  const v = await env.SESS.get(k, 'json');
  return v || { lastNorm: '', fsm: {} };
}

async function seqPut(env: Env, session: string, state: any): Promise<void> {
  if (!env.SESS) return;
  await env.SESS.put(`state:${session}`, JSON.stringify(state), { expirationTtl: 60 * 60 * 12 });
}

/**
 * Call provider LLM
 */
async function providerChat(env: Env, messages: any[], { maxTokens = 1400, temperature = 0.2 } = {}): Promise<string> {
  const cap = Number(env.MAX_OUTPUT_TOKENS || 0);
  const finalMax = cap > 0 ? Math.min(maxTokens, cap) : maxTokens;

  const r = await fetch(env.PROVIDER_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'authorization': `Bearer ${env.PROVIDER_KEY}`
    },
    body: JSON.stringify({
      model: env.PROVIDER_MODEL,
      temperature,
      max_output_tokens: finalMax,
      messages
    })
  });
  
  if (!r.ok) throw new Error(`provider_http_${r.status}`);
  const j = await r.json().catch(() => ({}));
  return j?.choices?.[0]?.message?.content || j?.content || '';
}

/**
 * Deterministic fallback scoring
 */
function deterministicScore({ reply, usedFactIds = [] }: { reply: string; usedFactIds: string[] }): number {
  const len = (reply || '').split(/\s+/).filter(Boolean).length;
  const base = Math.max(40, Math.min(92, 100 - Math.abs(len - 110) * 0.35));
  const factBonus = Math.min(8, usedFactIds.length * 3);
  return Math.round(base + factBonus);
}

/**
 * Build plan from request or create new one
 */
async function getPlan(body: any, env: Env, req: Request): Promise<Plan> {
  if (body.plan) return body.plan;
  
  const { mode = 'sales-simulation', disease = '', persona = '', goal = '', topic = '' } = body;
  
  const factsRes = FACTS_DB.filter(f => {
    const dOk = !disease || f.ta?.toLowerCase() === String(disease).toLowerCase();
    const tOk = !topic || f.topic?.toLowerCase().includes(String(topic).toLowerCase());
    return dOk && tOk;
  });
  
  const facts = factsRes.slice(0, 8);
  if (env.REQUIRE_FACTS === 'true' && facts.length === 0) {
    throw new Error('no_facts_for_request');
  }
  
  return {
    planId: cryptoRandomId(),
    mode,
    disease,
    persona,
    goal,
    facts: facts.map(f => ({ id: f.id, text: f.text, cites: f.cites || [] })),
    fsm: FSM[mode] || FSM['sales-simulation']
  };
}

/**
 * POST /chat endpoint
 */
export async function postChat(req: Request, env: Env): Promise<Response> {
  try {
    // Parse config
    const config = fromRequest(req);
    const body = await readJson(req);
    const {
      mode = 'sales-simulation',
      user,
      history = [],
      disease = '',
      persona = '',
      goal = '',
      planId
    } = body || {};
    
    const session = body.session || 'anon';
    const acceptHeader = req.headers.get('accept') || '';
    const isSSE = acceptHeader.includes('text/event-stream');
    
    // Get plan
    const activePlan = await getPlan(body, env, req);
    
    // Build prompt
    const factsStr = activePlan.facts.map(f => `- [${f.id}] ${f.text}`).join('\n');
    const citesStr = activePlan.facts.flatMap(f => f.cites || []).slice(0, 6).map(c => `- ${c}`).join('\n');
    
    const commonContract = `
Return exactly two parts. No code blocks or headings.

1) Sales Guidance: short, accurate, label-aligned guidance (3–5 sentences) and a "Suggested Phrasing:" single-sentence line.
2) <coach>{
  "scores":{"accuracy":0-5,"compliance":0-5,"discovery":0-5,"clarity":0-5,"objection_handling":0-5,"empathy":0-5},
  "worked":["…"],"improve":["…"],"phrasing":"…","feedback":"…",
  "context":{"rep_question":"...","hcp_reply":"..."}
}</coach>

Use only the Facts IDs provided when making claims.`.trim();
    
    const sys = (mode === 'role-play')
      ? [
          `You are the HCP. First-person only. No coaching. No lists. No "<coach>".`,
          `Disease: ${disease || '—'}; Persona: ${persona || '—'}; Goal: ${goal || '—'}.`,
          `Facts:\n${factsStr}\nReferences:\n${citesStr}`,
          `Speak concisely.`
        ].join('\n')
      : [
          `You are the ReflectivAI Sales Coach. Be label-aligned and specific to the facts.`,
          `Disease: ${disease || '—'}; Persona: ${persona || '—'}; Goal: ${goal || '—'}.`,
          `Facts:\n${factsStr}\nReferences:\n${citesStr}`,
          commonContract
        ].join('\n');
    
    const messages = [
      { role: 'system', content: sys },
      ...history.map((m: any) => ({ role: m.role, content: String(m.content || '') })).slice(-18),
      { role: 'user', content: String(user || '') }
    ];
    
    // Provider call with retry
    let raw = '';
    for (let i = 0; i < 3; i++) {
      try {
        raw = await providerChat(env, messages, {
          maxTokens: mode === 'sales-simulation' ? 1200 : 900,
          temperature: 0.2
        });
        if (raw) break;
      } catch (e) {
        if (i === 2) throw e;
        await new Promise(r => setTimeout(r, 300 * (i + 1)));
      }
    }
    
    // Extract coach and clean text
    const { coach, clean } = extractCoach(raw);
    let reply = clean;
    
    // Mid-sentence cut-off guard
    const cutOff = (t: string) => {
      const s = String(t || '').trim();
      return s.length > 200 && !/[.!?]"?\s*$/.test(s);
    };
    
    if (cutOff(reply)) {
      const contMsgs = [
        ...messages,
        { role: 'assistant', content: reply },
        { role: 'user', content: 'Continue the same answer. Finish in 1–2 sentences. No new sections.' }
      ];
      try {
        const contRaw = await providerChat(env, contMsgs, { maxTokens: 360, temperature: 0.2 });
        const contClean = sanitizeLLM(contRaw || '');
        if (contClean) reply = (reply + ' ' + contClean).trim();
      } catch (_) {}
    }
    
    // FSM clamps
    const fsm = FSM[mode] || FSM['sales-simulation'];
    const cap = fsm?.states?.[fsm?.start]?.capSentences || 5;
    reply = capSentences(reply, cap);
    
    // Loop guard
    const state = await seqGet(env, session);
    const candNorm = norm(reply);
    if (state && candNorm && (candNorm === state.lastNorm)) {
      if (mode === 'role-play') {
        reply = 'In my clinic, we review history, adherence, and recent exposures before deciding. Follow-up timing guides next steps.';
      } else {
        reply = 'Anchor to eligibility, one safety check, and end with a single discovery question about patient selection. Suggested Phrasing: "For patients with consistent risk, would confirming eGFR today help you start one eligible person this month?"';
      }
    }
    state.lastNorm = norm(reply);
    await seqPut(env, session, state);
    
    // Deterministic scoring fallback
    let coachObj = coach && typeof coach === 'object' ? coach : null;
    if (!coachObj || !coachObj.scores) {
      const usedFactIds = (activePlan.facts || []).map(f => f.id);
      const overall = deterministicScore({ reply, usedFactIds });
      coachObj = {
        overall,
        scores: { accuracy: 4, compliance: 4, discovery: /[?]\s*$/.test(reply) ? 4 : 3, clarity: 4, objection_handling: 3, empathy: 3 },
        worked: ['Tied guidance to facts'],
        improve: ['End with one specific discovery question'],
        phrasing: 'Would confirming eGFR today help you identify one patient to start this month?',
        feedback: 'Stay concise. Cite label-aligned facts. Close with one clear question.',
        context: { rep_question: String(user || ''), hcp_reply: reply }
      };
    }
    
    // EI scoring for sales-simulation mode when emitEi is enabled
    let eiPayload = null;
    if (config.emitEi && mode === 'sales-simulation') {
      try {
        const { result: ei, latencyMs } = await withTiming(() => scoreEi({ text: reply, mode }));
        recordEiLatency(latencyMs);
        
        if (validateEiPayload(ei)) {
          eiPayload = ei;
          incrementEiEmitted();
        } else {
          incrementEiValidationFailed();
          console.warn('EI validation failed:', redactPII(JSON.stringify(ei)));
        }
      } catch (e) {
        incrementEiValidationFailed();
        console.error('EI scoring error:', redactPII(String(e)));
      }
    }
    
    // Build response
    const response: ChatResponse = {
      reply,
      coach: coachObj,
      plan: { id: planId || activePlan.planId }
    };
    
    if (eiPayload) {
      response._coach = { ei: eiPayload };
    }
    
    // SSE or JSON response
    if (isSSE && eiPayload) {
      // Return SSE stream with coach.partial and coach.final events
      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();
      const encoder = new TextEncoder();
      
      // Start streaming in background
      (async () => {
        try {
          // Send initial reply
          await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'reply', content: reply })}\n\n`));
          
          // Send partial EI updates (simulate streaming - send scores first)
          await writer.write(encoder.encode(`event: coach.partial\ndata: ${JSON.stringify({ scores: eiPayload.scores })}\n\n`));
          
          // Small delay to simulate streaming
          await new Promise(r => setTimeout(r, 50));
          
          // Send final complete EI payload
          await writer.write(encoder.encode(`event: coach.final\ndata: ${JSON.stringify(eiPayload)}\n\n`));
          
          // Done
          await writer.write(encoder.encode('data: [DONE]\n\n'));
          await writer.close();
        } catch (e) {
          console.error('SSE streaming error:', e);
          await writer.abort(e);
        }
      })();
      
      return new Response(readable, {
        headers: {
          'content-type': 'text/event-stream',
          'cache-control': 'no-cache',
          'connection': 'keep-alive',
          ...cors(env, req)
        }
      });
    }
    
    return json(response, 200, env, req);
  } catch (e: any) {
    return json({ error: 'server_error', detail: String(e?.message || e) }, 500, env, req);
  }
}
