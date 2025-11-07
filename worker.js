/**
 * Cloudflare Worker — ReflectivAI Gateway (r11.0 - EI-First with MODE_REGISTRY)
 * Endpoints: POST /facts, POST /plan, POST /chat, GET /health, GET /version, GET /debug/ei
 * 
 * NEW in r11.0:
 * - Central MODE_REGISTRY for deterministic, isolated mode handling
 * - Deterministic EI scoring engine with heuristic patterns
 * - Performance improvements (caching, timeouts, token budgets)
 * - Off-label/unethical selling point flagging
 * - Enhanced security and compliance safeguards
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

/* ------------------------- Cached Assets (TASK 3) ------------------------- */

let cachedSystemText = null;
let cachedAboutEi = null;
let cachedScenarios = null;

async function loadSystemText() {
  if (cachedSystemText) return cachedSystemText;
  // In Cloudflare Workers, we'd fetch from KV or R2
  // For now, return empty string as placeholder
  cachedSystemText = "";
  return cachedSystemText;
}

async function loadAboutEi() {
  if (cachedAboutEi) return cachedAboutEi;
  cachedAboutEi = "";
  return cachedAboutEi;
}

async function loadScenarios() {
  if (cachedScenarios) return cachedScenarios;
  cachedScenarios = [];
  return cachedScenarios;
}

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

// Finite State Machines per mode (deprecated in favor of MODE_REGISTRY)
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

/* -------------------- Deterministic EI Scoring (TASK 2) -------------------- */

// Precomputed regex patterns for EI domains
const EI_PATTERNS = {
  empathy: [
    /\b(i\s+hear|i\s+understand|i\s+appreciate|that\s+makes\s+sense|it\s+sounds\s+like|i\s+see\s+your|acknowledge|empathize)\b/i,
    /\b(given\s+your|considering\s+your|from\s+your\s+perspective)\b/i
  ],
  regulation: [
    /\b(let'?s\s+pause|step\s+at\s+a\s+time|we\s+can\s+slow\s+down|take\s+it\s+one|take\s+a\s+breath)\b/i,
    /\b(stay\s+calm|composed|measured|neutral)\b/i
  ],
  clarity: [
    /\b(here'?s\s+the\s+core\s+point|in\s+summary|the\s+key\s+is|to\s+clarify|simply\s+put)\b/i,
    /\b(concise|clear|straightforward|bottom\s+line)\b/i
  ],
  compliance: [
    /\b(per\s+label|per\s+guideline|per\s+fda|fda\s+label|not\s+indicated\s+for|indication|contraindication)\b/i,
    /\b(label-aligned|on-label|approved\s+for)\b/i
  ],
  selfAwareness: [
    /\b(i\s+may\s+have\s+missed|i\s+should\s+have|i\s+could\s+have\s+explored|i\s+realize|i\s+recognize)\b/i,
    /\b(my\s+mistake|i\s+apologize|let\s+me\s+revisit)\b/i
  ]
};

/**
 * Calculate deterministic EI scores based on heuristic patterns
 * @param {string} text - The text to analyze (user message or assistant response)
 * @returns {Object} EI scores object with domain scores and composite
 */
function calculateEIScores(text) {
  const t = String(text || "").toLowerCase();
  
  const scoreDomain = (domain) => {
    const patterns = EI_PATTERNS[domain] || [];
    let markers = 0;
    patterns.forEach(pattern => {
      const matches = t.match(pattern);
      if (matches) markers += matches.length;
    });
    
    // Base score of 4, each marker adds +2, max 10
    const score = Math.min(10, 4 + (markers * 2));
    return { score, markers };
  };
  
  const empathy = scoreDomain('empathy');
  const regulation = scoreDomain('regulation');
  const clarity = scoreDomain('clarity');
  const compliance = scoreDomain('compliance');
  const selfAwareness = scoreDomain('selfAwareness');
  
  // Composite score as rounded average
  const compositeScore = Math.round(
    (empathy.score + regulation.score + clarity.score + compliance.score + selfAwareness.score) / 5
  );
  
  return {
    empathy,
    regulation,
    clarity,
    compliance,
    selfAwareness,
    composite: { score: compositeScore }
  };
}

/**
 * Build deterministic feedback based on EI scores
 * @param {Object} eiScores - The EI scores object
 * @param {string} mode - Current mode
 * @returns {Object} Feedback object with tone, strengths, improvements, suggestedPhrasing
 */
function buildEIFeedback(eiScores, mode) {
  const strengths = [];
  const improvements = [];
  
  if (eiScores.empathy.score >= 6) {
    strengths.push("Shows empathy and acknowledgment");
  } else {
    improvements.push("Incorporate more empathetic language");
  }
  
  if (eiScores.clarity.score >= 6) {
    strengths.push("Maintains clear communication");
  } else {
    improvements.push("Simplify and clarify key points");
  }
  
  if (eiScores.compliance.score >= 6) {
    strengths.push("Stays aligned with label and guidelines");
  } else {
    improvements.push("Strengthen label-aligned language");
  }
  
  return {
    tone: "Supportive",
    strengths: strengths.length > 0 ? strengths : ["Provides clear information"],
    improvements: improvements.length > 0 ? improvements : ["Continue refining approach"],
    suggestedPhrasing: []
  };
}

/* ---------------- Off-Label/Unethical Flagging (TASK 4) ------------------- */

const RISK_PATTERNS = {
  offLabel: [
    /\b(not\s+indicated\s+but\s+works\s+for|we\s+use\s+it\s+off-label\s+for)\b/i,
    /\b(though\s+not\s+approved|while\s+not\s+indicated)\b/i
  ],
  absoluteClaims: [
    /\b(cures\s+everyone|better\s+than\s+all\s+options|no\s+side\s+effects|100%\s+effective)\b/i,
    /\b(always\s+works|never\s+fails|guaranteed\s+to)\b/i
  ],
  uncitedClinical: [
    /\b(studies\s+show|research\s+proves|data\s+confirms)\b/i
  ]
};

/**
 * Scan text for off-label and unethical selling points
 * @param {string} text - Text to scan
 * @param {string} mode - Current mode (only scans for sales-simulation and role-play)
 * @returns {Array<string>} Array of risk flag strings
 */
function scanForRiskFlags(text, mode) {
  // Only scan for sales-simulation and role-play
  if (mode !== "sales-simulation" && mode !== "role-play") {
    return [];
  }
  
  const flags = [];
  const t = String(text || "");
  
  // Check for off-label patterns
  RISK_PATTERNS.offLabel.forEach(pattern => {
    if (pattern.test(t)) {
      flags.push("Potential off-label language detected");
    }
  });
  
  // Check for absolute claims
  RISK_PATTERNS.absoluteClaims.forEach(pattern => {
    if (pattern.test(t)) {
      flags.push("Absolute or uncited efficacy claim");
    }
  });
  
  // Check for uncited clinical claims
  if (RISK_PATTERNS.uncitedClinical.some(p => p.test(t)) && !/\[[\d]+\]/.test(t)) {
    flags.push("Clinical claim without citation");
  }
  
  // Remove duplicates
  return [...new Set(flags)];
}

/* ----------------------- MODE_REGISTRY (TASK 1) --------------------------- */

const MODE_REGISTRY = {
  "sales-simulation": {
    buildPrompt({ messages, context, mode }) {
      const { systemText, scenario, factsStr, citesStr } = context;
      
      const scenarioInfo = scenario ? [
        `Therapeutic Area: ${scenario.therapeuticArea || "—"}`,
        `HCP Role: ${scenario.hcpRole || "—"}`,
        `Background: ${scenario.background || "—"}`,
        `Today's Goal: ${scenario.goal || "—"}`
      ].join("\n") : "";
      
      const prompt = `You are a virtual pharma coach. Be direct, label-aligned, and safe.

# Scenario
${scenarioInfo}

# Style
- 3–4 sentences and one closing question. No lists longer than 2 bullets.
- Only appropriate, publicly known, label-aligned facts.
- No pricing advice or PHI. No off-label.
- Include a clearly labeled "Suggested Phrasing:" section as part of the chat response.

# Output Contract
Return exactly two parts. No code blocks or headings.

1) Sales Guidance: short, accurate, label-aligned guidance (3–5 sentences) and a "Suggested Phrasing:" single-sentence line.
2) <coach>{
  "scores":{"accuracy":0-5,"compliance":0-5,"discovery":0-5,"clarity":0-5,"objection_handling":0-5,"empathy":0-5},
  "worked":["…"],"improve":["…"],"phrasing":"…","feedback":"…",
  "context":{"rep_question":"...","hcp_reply":"..."}
}</coach>

Use only the Facts IDs provided when making claims.

Facts:
${factsStr}

References:
${citesStr}`;

      return [
        { role: "system", content: prompt },
        ...messages.slice(-18)
      ];
    },
    
    postProcess({ raw, mode, messages, context }) {
      const { coach, clean } = extractCoach(raw);
      
      // Try to parse rubric JSON if present
      let rubric = null;
      if (coach && typeof coach === 'object' && coach.scores) {
        rubric = coach;
      }
      
      return {
        content: sanitizeLLM(clean),
        _coach: {
          rubric,
          mode
        }
      };
    }
  },
  
  "product-knowledge": {
    buildPrompt({ messages, context, mode }) {
      const { systemText, factsStr, citesStr } = context;
      
      const prompt = `Return a concise educational overview with reputable citations.

Structure: 
- Answer (with inline numbered citations [1], [2], etc.)
- References (numbered list matching citations)

Keep responses concise and focused. Use only facts provided.

Facts:
${factsStr}

References:
${citesStr}`;

      return [
        { role: "system", content: prompt },
        ...messages.slice(-18)
      ];
    },
    
    postProcess({ raw, mode, messages, context }) {
      return {
        content: sanitizeLLM(raw)
      };
    }
  },
  
  "emotional-assessment": {
    buildPrompt({ messages, context, mode }) {
      const { systemText, eiText } = context;
      
      const prompt = `Provide brief self-reflection tips tied to HCP communication.

Structure:
- Affirmation (recognize strengths)
- Diagnosis (EI-focused: empathy, self-regulation, clarity, social awareness)
- Guidance (concrete next steps)
- Reflection Prompt (questions for self-reflection)

Keep responses focused and compact (3–5 sentences plus one reflective question).

${eiText || ""}`;

      return [
        { role: "system", content: prompt },
        ...messages.slice(-18)
      ];
    },
    
    postProcess({ raw, mode, messages, context }) {
      return {
        content: sanitizeLLM(raw)
      };
    }
  },
  
  "role-play": {
    buildPrompt({ messages, context, mode }) {
      const { systemText, scenario, factsStr, citesStr } = context;
      
      const scenarioInfo = scenario ? [
        `HCP Persona: ${scenario.hcpRole || scenario.label || "—"}`,
        `Therapeutic Area: ${scenario.therapeuticArea || "—"}`,
        `Background: ${scenario.background || "—"}`,
        `Today's Goal: ${scenario.goal || "—"}`
      ].join("\n") : "";
      
      const prompt = `# Role Play Contract — HCP Only
You are the Healthcare Provider. Reply ONLY as the HCP. First-person. Realistic, concise clinical dialogue.

${scenarioInfo}

Hard bans:
- Do NOT output coaching, rubrics, scores, JSON, or any "<coach>" block.
- Do NOT output headings or bullet lists.
- Do NOT ask the rep about the rep's process, approach, or clinic metrics.
- Do NOT interview the rep with sales-discovery prompts.
- Do NOT make offers like "I can provide/offer/arrange training, resources, handouts, or scripts."
- Do NOT propose support, resources, training, education, materials, webinars, or handouts for the rep or their staff.

Allowable questions from HCP:
- Clarify therapy, safety, logistics, coverage, workflow impact.
- Questions must reflect HCP's POV ("my clinic", "my patients", "our team").

Output only the HCP utterance (1-3 sentences).

Facts:
${factsStr}

References:
${citesStr}`;

      return [
        { role: "system", content: prompt },
        ...messages.slice(-18)
      ];
    },
    
    postProcess({ raw, mode, messages, context }) {
      // Role-play should NOT have _coach.ei
      return {
        content: sanitizeLLM(raw)
      };
    }
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

/**
 * Call provider with timeout wrapper (TASK 3)
 */
async function providerChat(env, messages, { maxTokens = 1400, temperature = 0.2 } = {}) {
  const cap = Number(env.MAX_OUTPUT_TOKENS || 0);
  const finalMax = cap > 0 ? Math.min(maxTokens, cap) : maxTokens;

  // AbortController for 8s timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
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
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!r.ok) throw new Error(`provider_http_${r.status}`);
    const j = await r.json().catch(() => ({}));
    return j?.choices?.[0]?.message?.content || j?.content || "";
  } catch (e) {
    clearTimeout(timeoutId);
    if (e.name === 'AbortError') {
      // Timeout fallback
      return { fallback: true, message: "Timeout – minimal coach guidance only." };
    }
    throw e;
  }
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
    modeAllowed: ["emotional-assessment", "product-knowledge", "sales-simulation"],
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

/* ------------------------------ /chat (TASK 5: Routing) -------------------- */
async function postChat(req, env) {
  try {
    // Validate method (already POST from router, but explicit check)
    if (req.method !== "POST") {
      return json({ error: "method_not_allowed" }, 405, env, req);
    }

    // Validate Content-Type
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return json({ error: "unsupported_media_type", message: "Content-Type must be application/json" }, 415, env, req);
    }

    // Parse and validate JSON
    const body = await readJson(req);
    if (!body || typeof body !== 'object') {
      return json({ error: "invalid_json" }, 400, env, req);
    }

    // Validate mode and messages
    const { mode, user, history = [], messages: directMessages, ...rest } = body;
    
    if (!mode || typeof mode !== 'string') {
      return json({ error: "invalid_mode", message: "mode field is required and must be a string" }, 422, env, req);
    }

    // Check if mode is supported
    if (!MODE_REGISTRY[mode]) {
      return json({ error: "unsupported_mode", message: `Mode "${mode}" is not supported. Supported modes: ${Object.keys(MODE_REGISTRY).join(", ")}` }, 422, env, req);
    }

    // Build messages array from either 'messages' or 'user' + 'history'
    let messagesArray = [];
    if (directMessages && Array.isArray(directMessages)) {
      messagesArray = directMessages;
    } else if (user) {
      messagesArray = [
        ...history.map(m => ({ role: m.role, content: String(m.content || "") })),
        { role: "user", content: String(user || "") }
      ];
    }

    if (!messagesArray || messagesArray.length === 0) {
      return json({ error: "invalid_messages", message: "messages array is required and must not be empty" }, 422, env, req);
    }

    const session = body.session || "anon";

    // Load cached assets
    const systemText = await loadSystemText();
    const aboutEi = await loadAboutEi();
    const scenarios = await loadScenarios();

    // Build context
    const { disease = "", persona = "", goal = "", plan, planId, scenarioId } = body;
    
    // Load or build a plan
    let activePlan = plan;
    if (!activePlan) {
      const r = await postPlan(new Request("http://x", { method: "POST", body: JSON.stringify({ mode, disease, persona, goal }) }), env);
      activePlan = await r.json();
    }

    const factsStr = activePlan.facts.map(f => `- [${f.id}] ${f.text}`).join("\n");
    const citesStr = activePlan.facts.flatMap(f => f.cites || []).slice(0, 6).map(c => `- ${c}`).join("\n");
    
    const scenario = scenarioId ? scenarios.find(s => s.id === scenarioId) : null;

    const context = {
      systemText,
      eiText: aboutEi,
      scenario,
      factsStr,
      citesStr
    };

    // Get handler from MODE_REGISTRY
    const handler = MODE_REGISTRY[mode];

    // Build prompt using mode-specific logic
    const promptMessages = handler.buildPrompt({ messages: messagesArray, context, mode });

    // Call provider with retry (3 attempts)
    let raw = "";
    for (let i = 0; i < 3; i++) {
      try {
        raw = await providerChat(env, promptMessages, {
          maxTokens: (mode === "sales-simulation" || mode === "role-play") ? 1200 : 800,
          temperature: 0.2
        });
        
        // Check for fallback response
        if (typeof raw === 'object' && raw.fallback) {
          raw = `Unable to generate full response. ${raw.message}`;
          break;
        }
        
        if (raw) break;
      } catch (e) {
        if (i === 2) throw e;
        await new Promise(r => setTimeout(r, 300 * (i + 1)));
      }
    }

    // Post-process using mode-specific logic
    const processed = handler.postProcess({ raw, mode, messages: messagesArray, context });

    // Calculate deterministic EI scores (TASK 2) for non-role-play modes
    if (mode !== "role-play") {
      const lastUserMessage = messagesArray[messagesArray.length - 1]?.content || "";
      const eiScores = calculateEIScores(lastUserMessage);
      
      if (!processed._coach) {
        processed._coach = {};
      }
      
      processed._coach.ei = eiScores;
      processed._coach.mode = mode;
      
      // Build feedback if not present
      if (!processed._coach.feedback) {
        const feedback = buildEIFeedback(eiScores, mode);
        processed._coach.feedback = feedback;
      }
    }

    // Scan for risk flags (TASK 4)
    const riskFlags = scanForRiskFlags(processed.content || "", mode);
    if (riskFlags.length > 0 && (mode === "sales-simulation" || mode === "role-play")) {
      if (!processed._coach) {
        processed._coach = {};
      }
      processed._coach.riskFlags = riskFlags;
    }

    // Mid-sentence cut-off guard + one-pass auto-continue (preserved from original)
    let reply = processed.content;
    const cutOff = (t) => {
      const s = String(t || "").trim();
      return s.length > 200 && !/[.!?]"?\s*$/.test(s);
    };
    
    if (cutOff(reply) && (mode !== "sales-simulation" && mode !== "role-play")) {
      const contMsgs = [
        ...promptMessages,
        { role: "assistant", content: reply },
        { role: "user", content: "Continue the same answer. Finish in 1–2 sentences. No new sections." }
      ];
      try {
        const contRaw = await providerChat(env, contMsgs, { maxTokens: 360, temperature: 0.2 });
        if (typeof contRaw === 'string') {
          const contClean = sanitizeLLM(contRaw || "");
          if (contClean) reply = (reply + " " + contClean).trim();
        }
      } catch (_) {}
      processed.content = reply;
    }

    // FSM clamps (for backward compatibility)
    const fsm = FSM[mode] || FSM["sales-simulation"];
    const cap = fsm?.states?.[fsm?.start]?.capSentences || 5;
    processed.content = capSentences(processed.content, cap);

    // Loop guard vs last reply
    const state = await seqGet(env, session);
    const candNorm = norm(processed.content);
    if (state && candNorm && (candNorm === state.lastNorm)) {
      if (mode === "role-play") {
        processed.content = "In my clinic, we review history, adherence, and recent exposures before deciding. Follow-up timing guides next steps.";
      } else {
        processed.content = 'Anchor to eligibility, one safety check, and end with a single discovery question about patient selection. Suggested Phrasing: "For patients with consistent risk, would confirming eGFR today help you start one eligible person this month?"';
      }
    }
    state.lastNorm = norm(processed.content);
    await seqPut(env, session, state);

    // Build final response envelope
    const responseData = { 
      mode,
      reply: processed.content,
      content: processed.content,
      ...processed,
      plan: { id: planId || activePlan.planId }
    };

    // Add EI data if flag is enabled (for backward compatibility)
    if (getEiFlag(req, env) && processed._coach) {
      if (!responseData._coach) {
        responseData._coach = processed._coach;
      }
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
