
/**
 * Cloudflare Worker — ReflectivAI Gateway (r10.1)
 * Endpoints: POST /facts, POST /plan, POST /chat, GET/HEAD /health, GET /version, GET /debug/ei
 * Inlined: FACTS_DB, FSM, PLAN_SCHEMA, COACH_SCHEMA, extractCoach()
 *
 * KV namespaces (optional):
 *  - SESS : per-session state (last replies, FSM state)
 *
 * Required VARS:
 *  - PROVIDER_URL    e.g., "https://api.groq.com/openai/v1/chat/completions"
 *  - PROVIDER_MODEL  e.g., "llama-3.1-70b-versatile"
 *  - PROVIDER_KEY    bearer key for provider
 *  - CORS_ORIGINS    comma-separated allowlist of allowed origins
 *                    REQUIRED VALUES (must include):
 *                      https://reflectivei.github.io
 *                      https://tonyabdelmalak.github.io
 *                      https://tonyabdelmalak.com
 *                      https://www.tonyabdelmalak.com
 *                    Example: "https://reflectivei.github.io,https://tonyabdelmalak.github.io,https://tonyabdelmalak.com,https://www.tonyabdelmalak.com"
 *                    If not set, allows all origins (not recommended for production)
 *  - REQUIRE_FACTS   "true" to require at least one fact in plan
 *  - MAX_OUTPUT_TOKENS optional hard cap (string int)
 */

function getGroqKey(env) {
  const keys = [env.PROVIDER_KEY, env.PROVIDER_KEY_2, env.PROVIDER_KEY_3].filter(Boolean);
  if (keys.length === 0) return null;
  const index = Math.floor(Math.random() * keys.length);
  return keys[index];
}

function normalizeSalesCoachReply(reply, userQuestion) {
  if (!reply) return reply;

  // Check for all 4 required headers in order
  const challengeMatch = reply.match(/Challenge\s*:\s*(.+?)(?=\n\s*(?:Rep Approach|Impact|Suggested Phrasing):|$)/i);
  const repMatch = reply.match(/Rep Approach\s*:\s*(.+?)(?=\n\s*(?:Impact|Suggested Phrasing):|$)/i);
  const impactMatch = reply.match(/Impact\s*:\s*(.+?)(?=\n\s*Suggested Phrasing:|$)/i);
  const phrasingMatch = reply.match(/Suggested\s+Phrasing\s*:\s*(.+)/i);

  if (challengeMatch && repMatch && impactMatch && phrasingMatch) {
    // Check bullets in Rep Approach
    const repText = repMatch[1].trim();
    const bullets = repText.split(/\s*•\s*/).filter(Boolean);
    if (bullets.length === 3) {
      return reply; // All good
    }
  }

  // Rebuild compliant response
  console.log('[Sales Coach Normalize] Rebuilding malformed response');

  // Extract core idea from user question for Challenge
  const challenge = userQuestion ? `Addressing ${userQuestion.split(' ').slice(0, 5).join(' ')}...` : 'Navigating HCP concerns effectively';

  // Generic safe bullets
  const bullets = [
    'Focus on patient safety and label alignment',
    'Use data to address specific concerns',
    'End with a clear next step question'
  ];

  // Generic impact
  const impact = 'Builds trust and advances patient care discussions';

  // Generic phrasing
  const phrasing = 'Based on the patient\'s profile, how can we ensure safety while exploring this option?';

  return `Challenge: ${challenge}

Rep Approach:
• ${bullets[0]}
• ${bullets[1]}
• ${bullets[2]}

Impact: ${impact}

Suggested Phrasing: "${phrasing}"`;
}

export default {
  async fetch(req, env, ctx) {
    try {
      const url = new URL(req.url);

      // CORS preflight
      if (req.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: cors(env, req) });
      }

      // Health check - supports both GET and HEAD for frontend health checks
      if (url.pathname === "/health" && (req.method === "GET" || req.method === "HEAD")) {
        // HEAD requests return no body, GET returns "ok"
        const body = req.method === "GET" ? "ok" : null;
        return new Response(body, { status: 200, headers: cors(env, req) });
      }

      // Version endpoint
      if (url.pathname === "/version" && req.method === "GET") {
        return json({ version: "r10.3" }, 200, env, req);
      }

      // Debug EI endpoint - returns basic info about the worker
      if (url.pathname === "/debug/ei" && req.method === "GET") {
        return json({
          worker: "ReflectivAI Gateway",
          version: "r10.1",
          endpoints: ["/health", "/version", "/debug/ei", "/facts", "/plan", "/chat"],
          timestamp: new Date().toISOString()
        }, 200, env, req);
      }

      if (url.pathname === "/facts" && req.method === "POST") return postFacts(req, env);
      if (url.pathname === "/plan" && req.method === "POST") return postPlan(req, env);
      if (url.pathname === "/chat" && req.method === "POST") {
        const result = await postChat(req, env);
        if (!result.ok) {
          return json({ reply: "I'm sorry, but I'm unable to respond right now due to a technical issue. Please try again later." }, 200, env, req);
        }
        return json(result.data, 200, env, req);
      }

      return json({ error: "not_found" }, 404, env, req);
    } catch (e) {
      // Log the error for debugging but don't expose details to client
      console.error("Top-level error:", e);
      return json({ error: "server_error", message: "Internal server error" }, 500, env, req);
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
  },
  // Diabetes Facts
  {
    id: "DIABETES-MGMT-001",
    ta: "Diabetes",
    topic: "Diabetes Management",
    text: "Effective diabetes management requires a comprehensive approach including lifestyle modifications, glycemic control, cardiovascular risk reduction, and regular monitoring. Key strategies include healthy eating, physical activity, medication adherence, and routine check-ups.",
    cites: ["ADA Standards of Care 2024", "AHA/ACC Diabetes Guidelines"]
  },
  // Cardiovascular Facts
  {
    id: "CV-GDMT-HFREF-001",
    ta: "Cardiovascular",
    topic: "HFrEF Guideline-Directed Medical Therapy",
    text: "Guideline-directed medical therapy (GDMT) for HFrEF includes four pillars: ACE-I/ARB/ARNI, beta-blockers, MRAs, and SGLT2 inhibitors, each providing mortality and hospitalization benefits with additive effects.",
    cites: ["ACC/AHA Heart Failure Guidelines 2022", "ESC HF Guidelines 2021"]
  },
  {
    id: "CV-ARNI-ENTRESTO-002",
    ta: "Cardiovascular",
    topic: "Sacubitril/Valsartan (Entresto)",
    text: "Sacubitril/valsartan (ARNI) is superior to enalapril in reducing cardiovascular death and HF hospitalization in HFrEF patients (NYHA Class II-IV, EF ≤40%). Requires 36-hour ACE-I washout to avoid angioedema.",
    cites: ["PARADIGM-HF Trial", "FDA Label - Entresto"]
  },
  {
    id: "CV-SGLT2-HF-003",
    ta: "Cardiovascular",
    topic: "SGLT2 Inhibitors in Heart Failure",
    text: "SGLT2 inhibitors (dapagliflozin, empagliflozin) reduce HF hospitalization and cardiovascular death in HFrEF and HFpEF, independent of diabetes status. Benefits include diuresis, improved renal outcomes, and metabolic effects.",
    cites: ["DAPA-HF Trial", "EMPEROR-Reduced", "ACC/AHA Guidelines"]
  },
  {
    id: "CV-SGLT2-CKD-004",
    ta: "Cardiovascular",
    topic: "SGLT2i in Chronic Kidney Disease",
    text: "SGLT2 inhibitors slow CKD progression (eGFR decline, ESKD, CV/renal death) in patients with and without diabetes, including CKD Stage 3-4 (eGFR ≥20 mL/min). Initiation safe despite transient eGFR dip.",
    cites: ["DAPA-CKD Trial", "EMPA-KIDNEY", "KDIGO 2022 Guidelines"]
  },
  {
    id: "CV-SGLT2-SAFETY-005",
    ta: "Cardiovascular",
    topic: "SGLT2i Safety and Sick Day Rules",
    text: "SGLT2 inhibitors carry risks of euglycemic DKA (rare), genital mycotic infections, and volume depletion. Educate patients on sick day rules: withhold during acute illness, dehydration, or fasting to prevent DKA.",
    cites: ["FDA Safety Communications", "Endocrine Society Clinical Practice Guidelines"]
  },
  {
    id: "CV-MRA-SPIRONOLACTONE-006",
    ta: "Cardiovascular",
    topic: "Mineralocorticoid Receptor Antagonists",
    text: "Spironolactone and eplerenone reduce mortality in HFrEF (NYHA Class II-IV) when added to ACE-I and beta-blockers. Monitor potassium and renal function; avoid if K+ >5.0 mEq/L or CrCl <30 mL/min.",
    cites: ["RALES Trial", "EMPHASIS-HF", "ACC/AHA Guidelines"]
  },
  {
    id: "CV-BETA-BLOCKER-007",
    ta: "Cardiovascular",
    topic: "Beta-Blockers in HFrEF",
    text: "Evidence-based beta-blockers (carvedilol, metoprolol succinate, bisoprolol) reduce mortality and hospitalization in stable HFrEF. Initiate at low dose and titrate to target or maximum tolerated dose over weeks.",
    cites: ["MERIT-HF Trial", "COPERNICUS Trial", "ACC/AHA Guidelines"]
  },
  {
    id: "CV-POST-MI-TRANSITION-008",
    ta: "Cardiovascular",
    topic: "Post-MI Discharge GDMT",
    text: "Post-MI patients with reduced EF should receive GDMT before discharge, including ARNI (if EF ≤40%), beta-blockers, SGLT2i, and statins. Early initiation (within 48-72 hours) improves adherence and outcomes.",
    cites: ["ACC/AHA STEMI Guidelines", "ESC Acute MI Guidelines"]
  },
  {
    id: "CV-TITRATION-CALENDAR-009",
    ta: "Cardiovascular",
    topic: "GDMT Titration Protocols",
    text: "Structured titration protocols with defined follow-up intervals (2-4 weeks) optimize GDMT dosing. Nurse-led HF clinics and remote monitoring support safe up-titration while managing hypotension, bradycardia, and renal function.",
    cites: ["ACC/AHA HF Performance Measures", "HF Society Clinical Practice"]
  },
  {
    id: "CV-READMISSION-PREVENTION-010",
    ta: "Cardiovascular",
    topic: "HF Readmission Reduction Strategies",
    text: "Transitional care interventions (7-day follow-up, medication reconciliation, patient education, telemonitoring) reduce 30-day HF readmissions. Pharmacy support for copay assistance and prior authorization streamlines GDMT access.",
    cites: ["ACC/AHA Quality Measures", "CMS Hospital Readmissions Reduction Program"]
  },
  // Oncology Facts
  {
    id: "ONC-ADC-MECHANISM-001",
    ta: "onc_md_decile10_io_adc_pathways",
    topic: "ADC Mechanism of Action",
    text: "Antibody-drug conjugates (ADCs) combine monoclonal antibodies targeting tumor-specific antigens with cytotoxic payloads. Upon binding, ADCs are internalized, and lysosomal degradation releases the payload, causing DNA damage or microtubule disruption leading to apoptosis.",
    cites: ["FDA ADC Guidance", "NCI ADC Review"]
  },
  {
    id: "ONC-ADC-VS-CHEMO-002",
    ta: "onc_md_decile10_io_adc_pathways",
    topic: "ADC vs Traditional Chemotherapy",
    text: "ADCs offer targeted delivery of cytotoxic agents, reducing systemic toxicity compared to traditional chemotherapy. While chemotherapy affects both healthy and cancerous cells, ADCs selectively target tumor cells expressing specific antigens, potentially improving therapeutic index.",
    cites: ["ASCO ADC Guidelines", "Lancet Oncology ADC Meta-Analysis"]
  },
  {
    id: "ONC-ADC-SAFETY-003",
    ta: "onc_md_decile10_io_adc_pathways",
    topic: "ADC Safety Profile",
    text: "ADC toxicities include infusion reactions, peripheral neuropathy, myelosuppression, and organ-specific effects. Monitoring for liver function, cardiac toxicity, and ocular events is essential. Dose adjustments may be needed for hepatic impairment.",
    cites: ["FDA ADC Safety Communications", "Oncologist ADC Toxicity Review"]
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
      items: {
        type: "object", required: ["id", "text"], properties: {
          id: { type: "string" }, text: { type: "string" }, cites: { type: "array", items: { type: "string" } }
        }
      }
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

/**
 * CORS configuration and header builder.
 *
 * IMPORTANT: CORS_ORIGINS must include https://reflectivei.github.io for GitHub Pages deployment.
 *
 * When an origin is allowed, we echo it back in Access-Control-Allow-Origin.
 * When an origin is denied, we log a warning and return "null" to block the request.
 */
function cors(env, req) {
  const reqOrigin = req.headers.get("Origin") || "";
  const allowed = String(env.CORS_ORIGINS || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);

  // If no allowlist is configured, allow any origin
  // If allowlist exists, check if request origin is in the list
  const isAllowed = allowed.length === 0 || allowed.includes(reqOrigin);

  // Log CORS denials for diagnostics
  if (!isAllowed && reqOrigin) {
    console.warn("CORS deny", { origin: reqOrigin, allowedList: allowed });
  }

  // Determine the Access-Control-Allow-Origin value
  let allowOrigin;
  if (isAllowed && reqOrigin) {
    // Specific origin is allowed and present - echo it back
    allowOrigin = reqOrigin;
  } else if (isAllowed && !reqOrigin) {
    // Allowed but no origin header (e.g., same-origin or non-browser request)
    allowOrigin = "*";
  } else {
    // Not allowed
    allowOrigin = "null";
  }

  const headers = {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "content-type,authorization,x-req-id",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };

  // Only set credentials header when we have a specific origin
  // Cannot use credentials with wildcard origin (*)
  if (allowOrigin !== "*" && allowOrigin !== "null") {
    headers["Access-Control-Allow-Credentials"] = "true";
  }

  return headers;
}

function ok(body, headers = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json", ...headers }
  });
}

function json(body, status, env, req) {
  try {
    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json", ...cors(env, req) }
    });
  } catch (e) {
    console.error("json stringify error:", e);
    return new Response('{"error":"response_error","message":"Failed to serialize response"}', {
      status: 500,
      headers: { "content-type": "application/json" }
    });
  }
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
  try { coach = JSON.parse(body.slice(start, end + 1)); } catch { }
  const after = close >= 0 ? tail.slice(close + 8) : "";
  return { coach, clean: sanitizeLLM((head + " " + after).trim()) };
}

async function providerChat({ env, mode, messages, signal }) {
  const keys = [env.PROVIDER_KEY, env.PROVIDER_KEY_2, env.PROVIDER_KEY_3].filter(Boolean);
  const poolSize = keys.length;
  if (poolSize === 0) return { ok: false, error: "No valid Groq keys configured.", provider: "groq" };
  const keyIndex = Math.floor(Math.random() * poolSize);
  const key = keys[keyIndex];
  const hasKey = !!key;

  // Validate API key at runtime
  if (!key || !key.startsWith("gsk_")) {
    console.log("[GROQ-KEY-VALIDATION]", { index: keyIndex, valid: false });
    return { ok: false, error: "Invalid API key format.", provider: "groq" };
  }
  console.log("[GROQ-KEY]", { index: keyIndex, poolSize, valid: true });

  const model = env.PROVIDER_MODEL;
  const msgCount = messages.length;

  console.log("[GROQ-REQ]", { mode, model, hasKey, poolSize, msgCount });

  const cap = Number(env.MAX_OUTPUT_TOKENS || 0);
  const maxTokens = cap > 0 ? cap : 900;

  console.log("[GROQ-FETCH-ATTEMPT]", { attempted: true });

  try {
    const res = await fetch(env.PROVIDER_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${key}`
      },
      body: JSON.stringify({
        model: env.PROVIDER_MODEL,
        temperature: 0.2,
        max_tokens: maxTokens,
        messages
      }),
      signal
    });

    const txt = await res.text();
    console.log("[GROQ-RES]", { status: res.status, ok: res.ok, preview: txt.slice(0, 300) });

    if (!res.ok) {
      return { ok: false, error: `Groq error: status ${res.status}, body: ${txt.slice(0, 300)}`, provider: "groq" };
    }

    let j;
    try {
      j = JSON.parse(txt);
    } catch (e) {
      return { ok: false, error: `Groq JSON parse error: ${e.message}, body: ${txt.slice(0, 300)}`, provider: "groq" };
    }

    if (!j || !j.choices || !j.choices[0] || !j.choices[0].message || !j.choices[0].message.content) {
      return { ok: false, error: `Groq invalid response: ${txt.slice(0, 300)}`, provider: "groq" };
    }

    return { ok: true, content: j.choices[0].message.content, provider: "groq" };
  } catch (e) {
    return { ok: false, error: `Provider error: ${e.message}`, provider: "groq" };
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

/* ------------------------------ /facts ------------------------------------- */
async function postFacts(req, env) {
  try {
    const { disease, topic, limit = 6 } = await readJson(req);
    const out = FACTS_DB.filter(f => {
      const dOk = !disease || f.ta?.toLowerCase() === String(disease).toLowerCase();
      const tOk = !topic || f.topic?.toLowerCase().includes(String(topic).toLowerCase());
      return dOk && tOk;
    }).slice(0, limit);
    return json({ facts: out }, 200, env, req);
  } catch (e) {
    console.error("postFacts error:", e);
    return json({ error: "server_error", message: "Failed to fetch facts" }, 500, env, req);
  }
}

/* ------------------------------ /plan -------------------------------------- */
async function postPlan(req, env) {
  try {
    const body = await readJson(req);
    const { mode = "sales-simulation", disease = "", persona = "", goal = "", topic = "" } = body || {};

    const factsRes = FACTS_DB.filter(f => {
      const dOk = !disease || f.ta?.toLowerCase() === String(disease).toLowerCase() || mode === "product-knowledge";
      const tOk = !topic || f.topic?.toLowerCase().includes(String(topic).toLowerCase());
      return dOk && tOk;
    });
    const facts = factsRes.slice(0, 8);
    // Allow empty facts for product-knowledge mode (soft validation)
    if (env.REQUIRE_FACTS === "true" && facts.length === 0 && mode !== "product-knowledge")
      return json({ error: "no_facts_for_request" }, 422, env, req);

    const plan = {
      planId: cryptoRandomId(),
      mode, disease, persona, goal,
      facts: facts.map(f => ({ id: f.id, text: f.text, cites: f.cites || [] })),
      fsm: FSM[mode] || FSM["sales-simulation"]
    };

    // Allow empty facts for product-knowledge mode
    const valid = Array.isArray(plan.facts) && typeof plan.mode === "string" && (plan.facts.length > 0 || mode === "product-knowledge");
    if (!valid) return json({ error: "invalid_plan" }, 422, env, req);

    return json(plan, 200, env, req);
  } catch (e) {
    console.error("postPlan error:", e);
    return json({ error: "server_error", message: "Failed to create plan" }, 500, env, req);
  }
}

/* ------------------------------ /chat -------------------------------------- */
async function postChat(req, env) {
  try {
    const body = await readJson(req);

    // Defensive checks
    if (!body || typeof body !== 'object') {
      return { ok: false, error: "Invalid request body." };
    }
    if (body.messages && Array.isArray(body.messages)) {
      if (body.messages.length === 0) {
        return { ok: false, error: "Empty messages." };
      }
    } else {
      if (!body.user && !body.messages) {
        return { ok: false, error: "No user message provided." };
      }
    }

    // Handle both payload formats:
    // 1. ReflectivAI format: { mode, user, history, disease, persona, goal, plan, planId, session }
    // 2. Widget format: { model, temperature, messages, ... }
    let mode, user, history, disease, persona, goal, plan, planId, session;

    if (body.messages && Array.isArray(body.messages)) {
      // Widget is sending provider-style payload - extract user message from messages array
      const msgs = body.messages;
      const lastUserMsg = msgs.filter(m => m.role === "user").pop();
      const historyMsgs = msgs.filter(m => m.role !== "system" && m !== lastUserMsg);

      mode = body.mode || "sales-simulation";
      user = lastUserMsg?.content || "";
      history = historyMsgs;
      disease = body.disease || "";
      persona = body.persona || "";
      goal = body.goal || "";
      plan = body.plan;
      planId = body.planId;
      session = body.session || "anon";
    } else {
      // ReflectivAI format
      mode = body.mode || "sales-simulation";
      user = body.user;
      history = body.history || [];
      disease = body.disease || "";
      persona = body.persona || "";
      goal = body.goal || "";
      plan = body.plan;
      planId = body.planId;
      session = body.session || "anon";
    }

    // Load or build a plan
    let activePlan = plan;
    if (!activePlan) {
      try {
        const r = await postPlan(new Request("http://x", { method: "POST", body: JSON.stringify({ mode, disease, persona, goal }) }), env);
        activePlan = await r.json();
      } catch (e) {
        console.error("chat_error", { step: "plan_generation", message: e.message });
        return { ok: false, error: "Plan generation failed." };
      }
    }

    // Validate activePlan structure to avoid obscure crashes - but allow empty facts for relaxed modes
    if (!activePlan || typeof activePlan !== 'object') {
      console.error("chat_error", { step: "plan_validation", message: "invalid_plan_structure", activePlan });
      return { ok: false, error: "Invalid plan structure." };
    }
    // Allow empty facts for EI and General Assistant modes
    if (!Array.isArray(activePlan.facts)) {
      activePlan.facts = [];
    }

    // For product-knowledge mode, if no facts available, return a default fallback response
    if (mode === "product-knowledge" && activePlan.facts.length === 0) {
      const fallbackReply = "I'm sorry, but I don't have specific product knowledge information available for this query at the moment. Please provide more details or try a different therapeutic area.";
      return json({ reply: fallbackReply, plan: { id: planId || activePlan.planId } }, 200, env, req);
    }

    // Provider prompts
    const factsStr = activePlan.facts.map(f => `- [${f.id}] ${f.text}`).join("\n");
    const citesStr = activePlan.facts.flatMap(f => f.cites || []).slice(0, 6).map(c => `- ${c}`).join("\n");

    const salesCoachContract = `
CRITICAL FORMAT CONTRACT — FOLLOW EXACTLY:

Return your answer in EXACTLY these 4 sections, in this order, nothing else:

Challenge: <one concise sentence summarizing the HCP or access challenge>

Rep Approach:
• <tactical coaching bullet 1>
• <tactical coaching bullet 2>
• <tactical coaching bullet 3>

Impact: <one sentence on the expected outcome or value to the HCP/patient>

Suggested Phrasing: "<2–4 sentence sample script, all inside one quoted block>"

HARD RULES:

Start each section on its own line with the exact labels above, including the colon.

Do NOT add any other headings or sections.

Do NOT wrap the whole answer in markdown code fences.

Do NOT preface with explanations. Start directly with "Challenge:" on the first line.

Rep Approach MUST have exactly 3 bullets, each starting with •.
`.trim();

    let sys;
    if (mode === "role-play") {
      sys = [
        `You are the HCP. First-person only. No coaching. No lists. No "<coach>".`,
        `Disease: ${disease || "—"}; Persona: ${persona || "—"}; Goal: ${goal || "—"}.`,
        `Facts:\n${factsStr}\nReferences:\n${citesStr}`,
        `Speak concisely.`,
        `CRITICAL: In every turn, and especially in later turns, YOU MUST speak strictly as the HCP in first person (I, me, my) and NEVER speak as the rep or coach.`
      ].join("\n");
    } else if (mode === "product-knowledge") {
      sys = [
        `You are a medical expert providing product knowledge. Be accurate and cite sources when possible.`,
        `Disease: ${disease || "—"}; Persona: ${persona || "—"}; Goal: ${goal || "—"}.`,
        `Facts:\n${factsStr}\nReferences:\n${citesStr}`,
        `Provide clear, evidence-based information.`
      ].join("\n");
    } else if (mode === "sales-coach") {
      sys = [
        `You are the ReflectivAI Sales Coach. Be label-aligned and specific to the facts.`,
        `Disease: ${disease || "—"}; Persona: ${persona || "—"}; Goal: ${goal || "—"}.`,
        `Facts:\n${factsStr}\nReferences:\n${citesStr}`,
        salesCoachContract
      ].join("\n");
    } else if (mode === "emotional-assessment") {
      sys = [
        `You are Reflectiv Coach, helping users develop emotional intelligence.`,
        `Focus on recognizing emotions, perspective-taking, and self-reflection.`,
        `ALWAYS respond helpfully and END EVERY RESPONSE with a reflective question that starts the user thinking deeper.`,
        `CRITICAL: Your response MUST end with a question mark (?) to encourage reflection.`
      ].join("\n");
    } else if (mode === "general-knowledge") {
      sys = [
        `You are a helpful AI assistant.`,
        `Provide informative responses to general questions.`
      ].join("\n");
    } else {
      // Fallback for unknown modes
      sys = [
        `You are a helpful AI assistant.`,
        `Provide informative responses.`
      ].join("\n");
    }

    const messages = [
      { role: "system", content: sys },
      ...history.map(m => ({ role: m.role, content: String(m.content || "") })).slice(-18),
      { role: "user", content: String(user || "") }
    ];

    // Provider call with retry
    let raw = "";
    for (let i = 0; i < 3; i++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout
      try {
        const result = await providerChat({ env, mode, messages, signal: controller.signal });
        clearTimeout(timeoutId);
        if (result.ok) {
          raw = result.content;
          break;
        } else {
          console.error("Provider error:", result.error);
        }
      } catch (e) {
        clearTimeout(timeoutId);
        console.error("chat_error", { step: "provider_call", attempt: i + 1, message: e.message });
        await new Promise(r => setTimeout(r, 300 * (i + 1)));
      }
    }

    if (!raw) {
      return { ok: false, error: "Provider failed after 3 attempts" };
    }

    // Extract coach and clean text
    const { coach, clean } = extractCoach(raw);
    let reply = clean;

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
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      try {
        const result = await providerChat({ env, mode, messages: contMsgs, signal: controller.signal });
        clearTimeout(timeoutId);
        if (result.ok) {
          const contClean = sanitizeLLM(result.content);
          if (contClean) reply = (reply + " " + contClean).trim();
        }
      } catch (e) {
        clearTimeout(timeoutId);
        console.error("chat_error", { step: "continuation", message: e.message });
        // Continue with original reply if continuation fails
      }
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
        reply = "In my clinic, we review history, adherence, and recent exposures before deciding. Follow-up timing guides next steps.";
      } else {
        reply = "Anchor to eligibility, one safety check, and end with a single discovery question about patient selection. Suggested Phrasing: “For patients with consistent risk, would confirming eGFR today help you start one eligible person this month?”";
      }
    }
    state.lastNorm = norm(reply);
    await seqPut(env, session, state);

    // Sales Coach normalization safety net
    if (mode === "sales-coach") {
      reply = normalizeSalesCoachReply(reply, user);
    }

    // Mode-specific post-processing
    if (mode === "emotional-assessment" && !reply.trim().endsWith('?')) {
      reply += " What insight does this give you about how you want to communicate moving forward?";
    }
    if (mode === "role-play" && !/\b(I|me|my)\b/i.test(reply)) {
      reply = "From my perspective as the clinician, " + reply;
    }

    // Deterministic scoring if provider omitted or malformed
    let coachObj = coach && typeof coach === "object" ? coach : null;
    if (!coachObj || !coachObj.scores) {
      const usedFactIds = (activePlan.facts || []).map(f => f.id);
      const overall = deterministicScore({ reply, usedFactIds });
      coachObj = {
        overall,
        scores: { empathy: 4, clarity: 4, compliance: 4, discovery: /[?]\s*$/.test(reply) ? 4 : 3, objection_handling: 3, confidence: 4, active_listening: 4, adaptability: 4, action_insight: 4, resilience: 4 },
        worked: ["Tied guidance to facts"],
        improve: ["End with one specific discovery question"],
        phrasing: "Would confirming eGFR today help you identify one patient to start this month?",
        feedback: "Stay concise. Cite label-aligned facts. Close with one clear question.",
        context: { rep_question: String(user || ""), hcp_reply: reply }
      };
    }

    // Ensure reply is not empty
    reply = reply || "I'm sorry — I couldn't generate a response just now.";

    const response = { reply, plan: { id: planId || activePlan.planId } };
    if (mode !== "role-play" && mode !== "product-knowledge" && mode !== "sales-coach") {
      response.coach = coachObj;
    }

    return { ok: true, data: response };
  } catch (e) {
    console.error("chat_error", { step: "general", message: e.message, stack: e.stack });
    return { ok: false, error: "Internal error." };
  }
}

function cryptoRandomId() {
  const a = new Uint8Array(8);
  crypto.getRandomValues(a);
  return [...a].map(x => x.toString(16).padStart(2, "0")).join("");
}
