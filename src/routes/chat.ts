/**
 * /chat endpoint - Main conversation handler with EI support
 */

import type { Env, ChatRequest, ChatResponse, CoachPayload, Plan } from '../types';
import { json, readJson, capSentences, extractCoach, sanitizeLLM, norm, validateCoach, cors } from '../helpers';
import { fromRequest } from '../config';
import { FSM } from '../data';
import { FALLBACK_RESPONSES } from '../constants';
import { providerChat, deterministicScore } from '../provider';
import { seqGet, seqPut } from '../session';
import { analyzeReply, computeEI } from '../ei/eiRules';
import { trackChatRequest, trackEIComputation, trackCoachExtraction } from '../metrics';
import { postPlan } from './plan';

export async function postChat(req: Request, env: Env): Promise<Response> {
  const startTime = Date.now();
  const config = fromRequest(req, env);
  const body: ChatRequest = await readJson(req);
  
  const {
    mode = "sales-simulation",
    user,
    history = [],
    disease = "",
    persona = "",
    goal = "",
    plan,
    planId
  } = body;

  const session = body.session || "anon";

  // Load or build a plan
  let activePlan: Plan = plan as Plan;
  if (!activePlan) {
    const planReq = new Request("http://x", { 
      method: "POST", 
      body: JSON.stringify({ mode, disease, persona, goal }) 
    });
    const planRes = await postPlan(planReq, env);
    activePlan = await planRes.json();
  }

  // Check if SSE is requested
  const accept = req.headers.get('Accept') || '';
  const isSSE = accept.includes('text/event-stream');

  if (isSSE) {
    return handleSSEChat(req, env, body, activePlan, config, session, startTime);
  }

  // Regular JSON response
  const result = await processChat(env, body, activePlan, config, session);
  
  trackChatRequest(mode, config.emitEi, Date.now() - startTime);
  
  return json(
    { 
      reply: result.reply, 
      coach: result.coach, 
      plan: { id: planId || activePlan.planId } 
    }, 
    200, 
    env, 
    req
  );
}

/**
 * Process chat logic (shared between JSON and SSE)
 */
async function processChat(
  env: Env,
  body: ChatRequest,
  activePlan: Plan,
  config: { emitEi: boolean },
  session: string
): Promise<{ reply: string; coach: CoachPayload | null }> {
  const {
    mode = "sales-simulation",
    user,
    history = [],
    disease = "",
    persona = "",
    goal = ""
  } = body;

  // Provider prompts
  const factsStr = activePlan.facts.map(f => `- [${f.id}] ${f.text}`).join("\n");
  const citesStr = activePlan.facts.flatMap(f => f.cites || []).slice(0, 6).map(c => `- ${c}`).join("\n");

  const commonContract = `
Return exactly two parts. No code blocks or headings.

1) Sales Guidance: short, accurate, label-aligned guidance (3–5 sentences) and a "Suggested Phrasing:" single-sentence line.
2) <coach>{
  "scores":{"accuracy":0-5,"compliance":0-5,"discovery":0-5,"clarity":0-5,"objection_handling":0-5,"empathy":0-5},
  "worked":["…"],"improve":["…"],"phrasing":"…","feedback":"…",
  "context":{"rep_question":"...","hcp_reply":"..."}
}</coach>

Use only the Facts IDs provided when making claims.`.trim();

  const sys = (mode === "role-play")
    ? [
        `You are the HCP. First-person only. No coaching. No lists. No "<coach>".`,
        `Disease: ${disease || "—"}; Persona: ${persona || "—"}; Goal: ${goal || "—"}.`,
        `Facts:\n${factsStr}\nReferences:\n${citesStr}`,
        `Speak concisely.`
      ].join("\n")
    : [
        `You are the ReflectivAI Sales Coach. Be label-aligned and specific to the facts.`,
        `Disease: ${disease || "—"}; Persona: ${persona || "—"}; Goal: ${goal || "—"}.`,
        `Facts:\n${factsStr}\nReferences:\n${citesStr}`,
        commonContract
      ].join("\n");

  const messages = [
    { role: "system", content: sys },
    ...history.map(m => ({ role: m.role, content: String(m.content || "") })).slice(-18),
    { role: "user", content: String(user || "") }
  ];

  // Provider call with retry
  let raw = "";
  for (let i = 0; i < 3; i++) {
    try {
      raw = await providerChat(env, messages, {
        maxTokens: mode === "sales-simulation" ? 1200 : 900,
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

  // Mid-sentence cut-off guard + one-pass auto-continue
  const cutOff = (t: string) => {
    const s = String(t || "").trim();
    return s.length > 200 && !/[.!?]"?\s*$/.test(s);
  };
  
  if (cutOff(reply)) {
    const contMsgs = [
      ...messages,
      { role: "assistant", content: reply },
      { role: "user", content: "Continue the same answer. Finish in 1–2 sentences. No new sections." }
    ];
    try {
      const contRaw = await providerChat(env, contMsgs, { maxTokens: 360, temperature: 0.2 });
      const contClean = sanitizeLLM(contRaw || "");
      if (contClean) reply = (reply + " " + contClean).trim();
    } catch (_) {}
  }

  // FSM clamps
  const fsm = FSM[mode] || FSM["sales-simulation"];
  const cap = fsm?.states?.[fsm?.start]?.capSentences || 5;
  reply = capSentences(reply, cap);

  // Loop guard vs last reply
  const state = await seqGet(env, session);
  const candNorm = norm(reply);
  if (state && candNorm && (candNorm === state.lastNorm)) {
    if (mode === "role-play") {
      reply = FALLBACK_RESPONSES.ROLE_PLAY;
    } else {
      reply = FALLBACK_RESPONSES.SALES_SIMULATION;
    }
  }
  state.lastNorm = norm(reply);
  await seqPut(env, session, state);

  // Deterministic scoring if provider omitted or malformed
  let coachObj: CoachPayload | null = coach && typeof coach === "object" ? coach : null;
  const hasCoach = coachObj !== null;
  const coachValid = hasCoach && validateCoach(coachObj);
  
  trackCoachExtraction(hasCoach, coachValid);
  
  if (!coachObj || !coachObj.scores) {
    const usedFactIds = (activePlan.facts || []).map(f => f.id);
    const overall = deterministicScore({ reply, usedFactIds });
    coachObj = {
      overall,
      scores: { 
        accuracy: 4, 
        compliance: 4, 
        discovery: /[?]\s*$/.test(reply) ? 4 : 3, 
        clarity: 4, 
        objection_handling: 3, 
        empathy: 3 
      },
      worked: ["Tied guidance to facts"],
      improve: ["End with one specific discovery question"],
      phrasing: "Would confirming eGFR today help you identify one patient to start this month?",
      feedback: "Stay concise. Cite label-aligned facts. Close with one clear question.",
      context: { rep_question: String(user || ""), hcp_reply: reply }
    };
  }

  // Attach EI if enabled and in sales-simulation mode
  if (config.emitEi && mode === "sales-simulation" && coachObj) {
    const eiStartTime = Date.now();
    const eiContext = analyzeReply(reply, String(user || ""));
    const eiPayload = computeEI(eiContext);
    coachObj.ei = eiPayload;
    
    trackEIComputation(eiPayload.overall, Date.now() - eiStartTime);
  }

  return { reply, coach: coachObj };
}

/**
 * Handle Server-Sent Events (SSE) streaming
 */
async function handleSSEChat(
  req: Request,
  env: Env,
  body: ChatRequest,
  activePlan: Plan,
  config: { emitEi: boolean },
  session: string,
  startTime: number
): Promise<Response> {
  const { mode = "sales-simulation", planId } = body;
  
  // Create a TransformStream for SSE
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  // Process chat in background
  (async () => {
    try {
      // Send initial event
      await writer.write(encoder.encode(`event: coach.partial\ndata: ${JSON.stringify({ status: "processing" })}\n\n`));

      // Process the chat
      const result = await processChat(env, body, activePlan, config, session);

      // Send partial update (could be used for streaming tokens)
      await writer.write(encoder.encode(`event: coach.partial\ndata: ${JSON.stringify({ 
        reply: result.reply.slice(0, 100) + "...",
        progress: 50 
      })}\n\n`));

      // Send final result
      const finalPayload = {
        reply: result.reply,
        coach: result.coach,
        plan: { id: planId || activePlan.planId }
      };
      
      await writer.write(encoder.encode(`event: coach.final\ndata: ${JSON.stringify(finalPayload)}\n\n`));
      
      trackChatRequest(mode, config.emitEi, Date.now() - startTime);
    } catch (error: any) {
      // Don't expose internal error details
      await writer.write(encoder.encode(`event: error\ndata: ${JSON.stringify({ 
        error: "processing_failed",
        detail: "An error occurred while processing your request"
      })}\n\n`));
    } finally {
      await writer.close();
    }
  })();

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      ...cors(env, req)
    }
  });
}
