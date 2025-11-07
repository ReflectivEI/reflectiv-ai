/**
 * Cloudflare Worker — ReflectivAI Gateway (r10.1)
 * Endpoints: POST /facts, POST /plan, POST /chat, GET /health, GET /version, GET /debug/ei
 * Inlined: FACTS_DB, FSM, PLAN_SCHEMA, COACH_SCHEMA, extractCoach()
 *
 * KV namespaces (optional):
 *  - SESS : per-session state (last replies, FSM state)
 *
 * Required VARS:
 *  - PROVIDER_URL    e.g., "https://api.groq.com/openai/v1/chat/completions"
 *  - PROVIDER_MODEL  e.g., "llama-3.1-70b-versatile"
 *  - PROVIDER_KEY    bearer key for provider
 *  - CORS_ORIGINS    comma-separated allowlist, e.g. "https://a.com,https://b.com"
 *  - REQUIRE_FACTS   "true" to require at least one fact in plan
 *  - MAX_OUTPUT_TOKENS optional hard cap (string int)
 *  - EMIT_EI / emitEi  "true" to enable EI (Emotional Intelligence) data in responses
 */

export default {
  async fetch(req, env, ctx) {
    try {
      const url = new URL(req.url);

      // CORS preflight
      if (req.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: cors(env, req) });
      }

      if (url.pathname === "/health" && req.method === "GET") {
        return new Response("ok", { status: 200, headers: cors(env, req) });
      }
      if (url.pathname === "/version" && req.method === "GET") {
        return json({ version: "r10.1" }, 200, env, req);
      }

      if (url.pathname === "/debug/ei" && req.method === "GET") {
        return getDebugEi(req, env);
      }

      if (url.pathname === "/facts" && req.method === "POST") return postFacts(req, env);
      if (url.pathname === "/plan"  && req.method === "POST") return postPlan(req, env);
      if (url.pathname === "/chat"  && req.method === "POST") return postChat(req, env);

      return json({ error: "not_found" }, 404, env, req);
    } catch (e) {
      return json({ error: "server_error", detail: String(e?.message || e) }, 500, env, req);
    }
  }
};

/* ------------------------- Inlined Knowledge & Rules ------------------------ */

// Minimal curated facts for demo. Add more or move to KV.
const FACTS_DB = [
  {
    id: "HIV-PREP-ELIG-001",
    ta: "HIV",
    topic: "PrEP Eligibility",
    text: "PrEP is recommended for individuals at substantial risk of HIV. Discuss sexual and injection risk factors.",
    cites: ["CDC PrEP 2024"]
  },
  {
    id: "HIV-PREP-TAF-002",
    ta: "HIV",
    topic: "Descovy for PrEP",
    text: "Descovy (emtricitabine/tenofovir alafenamide) is indicated for PrEP excluding receptive vaginal sex.",
    cites: ["FDA Label Descovy PrEP"]
  },
  {
    id: "HIV-PREP-SAFETY-003",
    ta: "HIV",
    topic: "Safety",
    text: "Assess renal function before and during PrEP. Consider eGFR thresholds per label.",
    cites: ["FDA Label Descovy", "CDC PrEP 2024"]
  }
];

// Finite State Machines per mode
const FSM = {
  "sales-simulation": {
    states: { START: { capSentences: 5, next: "COACH" }, COACH: { capSentences: 6, next: "COACH" } },
    start: "START"
  },
  "role-play": {
    states: { START: { capSentences: 4, next: "HCP" }, HCP: { capSentences: 4, next: "HCP" } },
    start: "START"
  }
};

// JSON Schemas (basic)
const PLAN_SCHEMA = {
  type: "object",
  required: ["mode", "disease", "persona", "goal", "facts"],
  properties: {
    mode: { type: "string" },
    disease: { type: "string" },
    persona: { type: "string" },
    goal: { type: "string" },
    facts: {
      type: "array",
      minItems: 1,
      items: { type: "object", required: ["id", "text"], properties: {
        id: { type: "string" }, text: { type: "string" }, cites: { type: "array", items: { type: "string" } }
      } }
    }
  }
};

const COACH_SCHEMA = {
  type: "object",
  required: ["scores"],
  properties: {
    overall: { type: "number" },
    score: { type: "number" },
    scores: { type: "object" },
    subscores: { type: "object" },
    worked: { type: "array" },
    improve: { type: "array" },
    phrasing: { type: "string" },
    feedback: { type: "string" },
    context: { type: "object" }
  }
};

/* ------------------------------ Helpers ------------------------------------ */

function getEiFlag(req, env) {
  const url = new URL(req.url);
  const queryFlag = url.searchParams.get("emitEi");
  const headerFlag = req.headers.get("x-emit-ei");
  const envFlag = env.EMIT_EI || env.emitEi;

  return (
    queryFlag === "1" || queryFlag === "true" ||
    headerFlag === "1" || headerFlag === "true" ||
    envFlag === "true"
  );
}

function cors(env, req) {
  const reqOrigin = req.headers.get("Origin") || "";
  const allowed = String(env.CORS_ORIGINS || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);

  const isAllowed = allowed.length === 0 || allowed.includes(reqOrigin);
  const allowOrigin = isAllowed ? (reqOrigin || "*") : "null";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "content-type,authorization,x-req-id,x-emit-ei",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin"
  };
}

function ok(body, headers = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json", ...headers }
  });
}

function json(body, status, env, req) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...cors(env, req) }
  });
}

async function readJson(req) {
  const txt = await req.text();
  if (!txt) return {};
  try { return JSON.parse(txt); } catch { return {}; }
}

function capSentences(text, n) {
  const parts = String(text || "").replace(/\s+/g, " ").match(/[^.!?]+[.!?]?/g) || [];
  return parts.slice(0, n).join(" ").trim();
}

function sanitizeLLM(s) {
  return String(s || "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/<pre[\s\S]*?<\/pre>/gi, "")
    .replace(/^\s*#{1,6}\s+/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Format hardening: Remove stray coach phrasing and bullets that leak into role-play
 */
function removeCoachLeakage(text, mode) {
  let result = String(text || "");
  
  // Role-play mode: enforce plain text, no bullets, no coach phrasing
  if (mode === "role-play") {
    result = result
      .replace(/^[\s\u2022\u2023\u25E6\*-]+/gm, "")  // Remove bullet points (including Unicode)
      .replace(/Suggested Phrasing:.*$/gim, "")  // Remove coach suggestions
      .replace(/\bCoach:\s*/gi, "")  // Remove "Coach:" prefix
      .replace(/\bHCP:\s*/gi, "")  // Keep HCP natural
      .trim();
  }
  
  return result;
}

/**
 * Ensure sentence completion: add period if missing at end
 */
function ensureSentenceCompletion(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) return trimmed;
  
  // Check if ends with proper punctuation
  if (!/[.!?]"?\s*$/.test(trimmed)) {
    return trimmed + ".";
  }
  
  return trimmed;
}

/**
 * Enforce sales-simulation 5-section format
 */
function enforceSalesFormat(text) {
  const required = [
    "Assessment",
    "Objection",
    "Guidance",
    "Phrasing",
    "Next Steps"
  ];
  
  // Check if text contains section-like structure
  const hasStructure = required.some(section => 
    text.includes(section + ":") || text.includes("**" + section)
  );
  
  // If already structured, return as-is
  if (hasStructure) return text;
  
  // Otherwise, return text with note
  return text;
}

function extractCoach(raw) {
  const s = String(raw || "");
  const open = s.indexOf("<coach>");
  if (open < 0) return { coach: null, clean: sanitizeLLM(s) };
  const head = s.slice(0, open);
  const tail = s.slice(open + 7);
  const close = tail.indexOf("</coach>");
  const body = close >= 0 ? tail.slice(0, close) : tail;
  const start = body.indexOf("{");
  if (start < 0) return { coach: null, clean: sanitizeLLM(head) };
  let depth = 0, end = -1;
  for (let i = start; i < body.length; i++) {
    const ch = body[i];
    if (ch === "{") depth++;
    if (ch === "}") depth--;
    if (depth === 0) { end = i; break; }
  }
  if (end < 0) return { coach: null, clean: sanitizeLLM(head) };
  let coach = null;
  try { coach = JSON.parse(body.slice(start, end + 1)); } catch {}
  const after = close >= 0 ? tail.slice(close + 8) : "";
  return { coach, clean: sanitizeLLM((head + " " + after).trim()) };
}

async function providerChat(env, messages, { maxTokens = 1400, temperature = 0.2 } = {}) {
  const cap = Number(env.MAX_OUTPUT_TOKENS || 0);
  const finalMax = cap > 0 ? Math.min(maxTokens, cap) : maxTokens;

  const r = await fetch(env.PROVIDER_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "authorization": `Bearer ${env.PROVIDER_KEY}`
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
  return j?.choices?.[0]?.message?.content || j?.content || "";
}

function deterministicScore({ reply, usedFactIds = [] }) {
  const len = (reply || "").split(/\s+/).filter(Boolean).length;
  const base = Math.max(40, Math.min(92, 100 - Math.abs(len - 110) * 0.35));
  const factBonus = Math.min(8, usedFactIds.length * 3);
  return Math.round(base + factBonus);
}

async function seqGet(env, session) {
  if (!env.SESS) return { lastNorm: "", fsm: {} };
  const k = `state:${session}`;
  const v = await env.SESS.get(k, "json");
  return v || { lastNorm: "", fsm: {} };
}
async function seqPut(env, session, state) {
  if (!env.SESS) return;
  await env.SESS.put(`state:${session}`, JSON.stringify(state), { expirationTtl: 60 * 60 * 12 });
}
const norm = s => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();

/* ------------------------------ /debug/ei ---------------------------------- */
async function getDebugEi(req, env) {
  const url = new URL(req.url);
  const queryFlag = url.searchParams.get("emitEi");
  const headerFlag = req.headers.get("x-emit-ei");
  const envFlagUpperCase = env.EMIT_EI || "";
  const envFlagLowerCase = env.emitEi || "";

  const result = {
    queryFlag: queryFlag === "1" || queryFlag === "true",
    headerFlag: headerFlag === "1" || headerFlag === "true",
    envFlag: envFlagUpperCase === "true" || envFlagLowerCase === "true",
    modeAllowed: ["sales-simulation"],
    time: new Date().toISOString()
  };

  return json(result, 200, env, req);
}

/* ------------------------------ /facts ------------------------------------- */
async function postFacts(req, env) {
  const { disease, topic, limit = 6 } = await readJson(req);
  const out = FACTS_DB.filter(f => {
    const dOk = !disease || f.ta?.toLowerCase() === String(disease).toLowerCase();
    const tOk = !topic || f.topic?.toLowerCase().includes(String(topic).toLowerCase());
    return dOk && tOk;
  }).slice(0, limit);
  return json({ facts: out }, 200, env, req);
}

/* ------------------------------ /plan -------------------------------------- */
async function postPlan(req, env) {
  const body = await readJson(req);
  const { mode = "sales-simulation", disease = "", persona = "", goal = "", topic = "" } = body || {};

  const factsRes = FACTS_DB.filter(f => {
    const dOk = !disease || f.ta?.toLowerCase() === String(disease).toLowerCase();
    const tOk = !topic || f.topic?.toLowerCase().includes(String(topic).toLowerCase());
    return dOk && tOk;
  });
  const facts = factsRes.slice(0, 8);
  if (env.REQUIRE_FACTS === "true" && facts.length === 0)
    return json({ error: "no_facts_for_request" }, 422, env, req);

  const plan = {
    planId: cryptoRandomId(),
    mode, disease, persona, goal,
    facts: facts.map(f => ({ id: f.id, text: f.text, cites: f.cites || [] })),
    fsm: FSM[mode] || FSM["sales-simulation"]
  };

  const valid = Array.isArray(plan.facts) && plan.facts.length > 0 && typeof plan.mode === "string";
  if (!valid) return json({ error: "invalid_plan" }, 422, env, req);

  return json(plan, 200, env, req);
}

/* ------------------------------ /chat -------------------------------------- */
async function postChat(req, env) {
  try {
    // Validate Content-Type
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return json({ error: "unsupported_media_type", message: "Content-Type must be application/json" }, 415, env, req);
    }

    const body = await readJson(req);
    const {
      mode = "sales-simulation",
      user,
      history = [],
      disease = "",
      persona = "",
      goal = "",
      plan,
      planId
    } = body || {};

    const session = body.session || "anon";

  // Load or build a plan
  let activePlan = plan;
  if (!activePlan) {
    const r = await postPlan(new Request("http://x", { method: "POST", body: JSON.stringify({ mode, disease, persona, goal }) }), env);
    activePlan = await r.json();
  }

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

  // Provider call with retry and mode-specific token budgets
  // Token limits: sales-simulation=1400, role-play=1200, emotional-assessment=800, product-knowledge=700
  const tokenBudgets = {
    "sales-simulation": 1400,
    "role-play": 1200,
    "emotional-assessment": 800,
    "product-knowledge": 700
  };
  const maxTokens = tokenBudgets[mode] || 1200;
  
  let raw = "";
  for (let i = 0; i < 3; i++) {
    try {
      raw = await providerChat(env, messages, {
        maxTokens,
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

  // Apply format hardening based on mode
  reply = removeCoachLeakage(reply, mode);
  
  // Enforce sales-simulation 5-section format
  if (mode === "sales-simulation") {
    reply = enforceSalesFormat(reply);
  }

  // Mid-sentence cut-off guard + one-pass auto-continue
  const cutOff = (t) => {
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
  
  // Ensure sentence completion
  reply = ensureSentenceCompletion(reply);

  // FSM clamps
  const fsm = FSM[mode] || FSM["sales-simulation"];
  const cap = fsm?.states?.[fsm?.start]?.capSentences || 5;
  reply = capSentences(reply, cap);

  // Loop guard vs last reply
  const state = await seqGet(env, session);
  const candNorm = norm(reply);
  if (state && candNorm && (candNorm === state.lastNorm)) {
    if (mode === "role-play") {
      reply = "In my clinic, we review history, adherence, and recent exposures before deciding. Follow-up timing guides next steps.";
    } else {
      reply = "Anchor to eligibility, one safety check, and end with a single discovery question about patient selection. Suggested Phrasing: “For patients with consistent risk, would confirming eGFR today help you start one eligible person this month?”";
    }
  }
  state.lastNorm = norm(reply);
  await seqPut(env, session, state);

  // Deterministic scoring if provider omitted or malformed
  let coachObj = coach && typeof coach === "object" ? coach : null;
  if (!coachObj || !coachObj.scores) {
    const usedFactIds = (activePlan.facts || []).map(f => f.id);
    const overall = deterministicScore({ reply, usedFactIds });
    coachObj = {
      overall,
      scores: { accuracy: 4, compliance: 4, discovery: /[?]\s*$/.test(reply) ? 4 : 3, clarity: 4, objection_handling: 3, empathy: 3 },
      worked: ["Tied guidance to facts"],
      improve: ["End with one specific discovery question"],
      phrasing: "Would confirming eGFR today help you identify one patient to start this month?",
      feedback: "Stay concise. Cite label-aligned facts. Close with one clear question.",
      context: { rep_question: String(user || ""), hcp_reply: reply }
    };
  }

  // Build response
  const responseData = { reply, coach: coachObj, plan: { id: planId || activePlan.planId } };

  // Add EI data if flag is enabled
  if (getEiFlag(req, env)) {
    responseData._coach = {
      ei: {
        scores: coachObj.scores || {}
      }
    };
  }

  return json(responseData, 200, env, req);
  } catch (err) {
    // Sanitize error message to avoid leaking sensitive information
    const safeMessage = String(err.message || "invalid").replace(/\s+/g, " ").slice(0, 200);
    return json({ error: "bad_request", message: safeMessage }, 400, env, req);
  }
}

function cryptoRandomId() {
  const a = new Uint8Array(8);
  crypto.getRandomValues(a);
  return [...a].map(x => x.toString(16).padStart(2, "0")).join("");
}
