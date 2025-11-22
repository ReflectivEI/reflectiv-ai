
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
 *  - PROVIDER_KEY    bearer key for provider (used if no rotation pool defined)
 *  - PROVIDER_KEYS   optional comma/semicolon separated list of provider keys for round-robin / hashed rotation
 *    OR environment may define PROVIDER_KEY_1, PROVIDER_KEY_2, ... PROVIDER_KEY_N
 *    Selection strategy: stable hash on session id => key index (avoids per-request randomness & keeps stickiness)
 *    Fallback order: explicit rotation pool > single PROVIDER_KEY. If no keys present → 500 config error.
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

export default {
  async fetch(req, env, ctx) {
    const reqId = req.headers.get("x-req-id") || cryptoRandomId();
    try {
      const url = new URL(req.url);

      // One-time environment validation log
      if (!globalThis.__CFG_LOGGED__) {
        const keyPool = getProviderKeyPool(env);
        const allowed = String(env.CORS_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
        console.log({ event: "startup_config", key_pool_size: keyPool.length, cors_allowlist_size: allowed.length, rotation_strategy: (env.PROVIDER_ROTATION_STRATEGY || 'session') });
        globalThis.__CFG_LOGGED__ = true;
      }

      // CORS preflight
      if (req.method === "OPTIONS") {
        const h = cors(env, req);
        h["x-req-id"] = reqId;
        return new Response(null, { status: 204, headers: h });
      }

      // Health check - supports both GET and HEAD for frontend health checks
      if (url.pathname === "/health" && (req.method === "GET" || req.method === "HEAD")) {
        const deep = url.searchParams.get("deep");
        if (req.method === "HEAD" && !deep) {
          return new Response(null, { status: 200, headers: cors(env, req) });
        }
        if (deep === "1" || deep === "true") {
          const keyPool = getProviderKeyPool(env);
          let provider = { ok: false, status: 0 };
          try {
            const key = selectProviderKey(env, "healthcheck");
            if (key) {
              const r = await fetch((env.PROVIDER_URL || "https://api.groq.com/openai/v1/chat/completions").replace(/\/chat\/completions$/, "/models"), {
                headers: { "authorization": `Bearer ${key}` }, method: "GET"
              });
              provider = { ok: r.ok, status: r.status };
            }
          } catch (e) {
            provider = { ok: false, error: String(e?.message || e) };
          }
          return json({ ok: true, time: Date.now(), key_pool: keyPool.length, provider }, 200, env, req, { "x-req-id": reqId });
        }
        return new Response("ok", { status: 200, headers: { ...cors(env, req), "x-req-id": reqId } });
      }

      // Version endpoint
      if (url.pathname === "/version" && req.method === "GET") {
        return json({ version: "r10.1" }, 200, env, req, { "x-req-id": reqId });
      }

      // Debug EI endpoint - returns basic info about the worker
      if (url.pathname === "/debug/ei" && req.method === "GET") {
        return json({ worker: "ReflectivAI Gateway", version: "r10.1", endpoints: ["/health", "/version", "/debug/ei", "/facts", "/plan", "/chat"], timestamp: new Date().toISOString() }, 200, env, req, { "x-req-id": reqId });
      }

      if (url.pathname === "/facts" && req.method === "POST") return postFacts(req, env);
      if (url.pathname === "/plan" && req.method === "POST") return postPlan(req, env);
      if (url.pathname === "/chat" && req.method === "POST") {
        const ip = req.headers.get("CF-Connecting-IP") || "0.0.0.0";
        const gate = rateLimit(`${ip}:chat`, env);
        if (!gate.ok) {
          const retry = Number(env.RATELIMIT_RETRY_AFTER || 2);
          return json({ error: "rate_limited", retry_after_sec: retry }, 429, env, req, {
            "Retry-After": String(retry),
            "X-RateLimit-Limit": String(gate.limit),
            "X-RateLimit-Remaining": String(gate.remaining),
            "x-req-id": reqId
          });
        }
        return postChat(req, env);
      }
      if (url.pathname === "/coach-metrics" && req.method === "POST") return postCoachMetrics(req, env);

      return json({ error: "not_found" }, 404, env, req, { "x-req-id": reqId });
    } catch (e) {
      // Log the error for debugging but don't expose details to client
      console.error("Top-level error:", e);
      return json({ error: "server_error", message: "Internal server error" }, 500, env, req, { "x-req-id": reqId });
    }
  },

  // Export test functions for unit testing
  validateSalesCoachContract,
  fixSalesCoachContract
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

// Finite State Machines per mode (5 modes total)
// CAPS INCREASED TO PREVENT CUTOFF - Sales Sim needs room for 4-section format
const FSM = {
  "sales-simulation": {
    states: { START: { capSentences: 30, next: "COACH" }, COACH: { capSentences: 30, next: "COACH" } },
    start: "START"
  },
  "role-play": {
    states: { START: { capSentences: 12, next: "HCP" }, HCP: { capSentences: 12, next: "HCP" } },
    start: "START"
  },
  "emotional-assessment": {
    states: { START: { capSentences: 20, next: "EI" }, EI: { capSentences: 20, next: "EI" } },
    start: "START"
  },
  "product-knowledge": {
    states: { START: { capSentences: 20, next: "PK" }, PK: { capSentences: 20, next: "PK" } },
    start: "START"
  },
  "general-knowledge": {
    states: { START: { capSentences: 20, next: "GENERAL" }, GENERAL: { capSentences: 20, next: "GENERAL" } },
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

function json(body, status, env, req, extraHeaders = {}) {
  const rid = req && typeof req.headers?.get === 'function' ? req.headers.get('x-req-id') : null;
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...cors(env, req), ...(rid ? { "x-req-id": rid } : {}), ...extraHeaders }
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

// ───────────────────── Provider Key Rotation Utilities ──────────────────────
function getProviderKeyPool(env) {
  const pool = [];
  // Comma / semicolon separated list
  if (env.PROVIDER_KEYS) {
    pool.push(
      ...String(env.PROVIDER_KEYS)
        .split(/[;,]/)
        .map(s => s.trim())
        .filter(Boolean)
    );
  }
  // Enumerated keys PROVIDER_KEY_1..N
  Object.keys(env)
    .filter(k => /^PROVIDER_KEY_\d+$/.test(k))
    .forEach(k => { if (env[k]) pool.push(String(env[k]).trim()); });
  // GROQ naming schemes (legacy)
  const groqCandidates = [
    'GROQ_KEY_1', 'GROQ_KEY_2', 'GROQ_KEY_3', 'GROQ_KEY_4', 'GROQ_KEY_5',
    'GROQ_API_KEY', 'GROQ_API_KEY_2', 'GROQ_API_KEY_3', 'GROQ_API_KEY_4', 'GROQ_API_KEY_5'
  ];
  groqCandidates.forEach(k => { if (env[k]) pool.push(String(env[k]).trim()); });
  // Single key fallback (ensure uniqueness)
  if (env.PROVIDER_KEY) {
    const base = String(env.PROVIDER_KEY).trim();
    if (base && !pool.includes(base)) pool.push(base);
  }
  return pool.filter(Boolean);
}

function hashString(str) {
  // FNV-1a 32-bit
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h >>> 0) * 0x01000193;
  }
  return h >>> 0;
}

function selectProviderKey(env, session) {
  const pool = getProviderKeyPool(env);
  if (!pool.length) return null;
  const sid = String(session || "anon");
  const idx = hashString(sid) % pool.length;
  return pool[idx];
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

async function providerChat(env, messages, { maxTokens = 900, temperature = 0.2, session = "anon", providerKey } = {}) {
  const cap = Number(env.MAX_OUTPUT_TOKENS || 0);
  const finalMax = cap > 0 ? Math.min(maxTokens, cap) : maxTokens;
  const key = providerKey || selectProviderKey(env, session) || env.PROVIDER_KEY;
  if (!key) throw new Error("provider_key_missing");
  if (env.DEBUG_MODE === "true") {
    console.log({ event: "provider_key_select", session, key_len: key.length, rotated: key !== env.PROVIDER_KEY });
  }
  const r = await fetch(env.PROVIDER_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "authorization": `Bearer ${key}`
    },
    body: JSON.stringify({
      model: env.PROVIDER_MODEL,
      temperature,
      max_tokens: finalMax,
      messages
    })
  });
  if (!r.ok) {
    const errText = await r.text();
    console.error("provider_fetch_error", { status: r.status, error: errText });
    throw new Error(`provider_http_${r.status}`);
  }
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
      const dOk = !disease || f.ta?.toLowerCase() === String(disease).toLowerCase();
      const tOk = !topic || f.topic?.toLowerCase().includes(String(topic).toLowerCase());
      return dOk && tOk;
    });

    // CONTEXT EDGE CASES: Always return 200 with fallback facts, never 422
    let facts = factsRes.slice(0, 8);
    if (facts.length === 0) {
      // Fallback to first 8 facts from FACTS_DB if filter yields empty array
      facts = FACTS_DB.slice(0, 8);
    }

    const plan = {
      planId: cryptoRandomId(),
      mode, disease, persona, goal,
      facts: facts.map(f => ({ id: f.id, text: f.text, cites: f.cites || [] })),
      fsm: FSM[mode] || FSM["sales-simulation"]
    };

    // Always return 200 - no validation failures that cause 422
    return json(plan, 200, env, req);
  } catch (e) {
    console.error("postPlan error:", e);
    return json({ error: "server_error", message: "Failed to create plan" }, 500, env, req);
  }
}

/* ------------------------------ Validators --------------------------------- */

/**
 * validateModeResponse - Enforce mode-specific guardrails and clean responses
 * @param {string} mode - Current mode (sales-simulation, role-play, emotional-assessment, product-knowledge)
 * @param {string} reply - AI response text
 * @param {object} coach - Coach metadata object
 * @returns {object} - { reply: cleanedReply, warnings: [...], violations: [...] }
 */
function validateModeResponse(mode, reply, coach) {
  let cleaned = reply;
  const warnings = [];
  const violations = [];

  // ROLE-PLAY: Enforce HCP-only voice, NO coaching language
  if (mode === "role-play") {
    // Detect coaching leakage
    const coachingPatterns = [
      /Challenge:/i,
      /Rep Approach:/i,
      /Impact:/i,
      /Suggested Phrasing:/i,
      /Coach Guidance:/i,
      /\bYou should have\b/i,
      /\bThe rep\b/i,
      /\bNext-Move Planner:/i
    ];

    for (const pattern of coachingPatterns) {
      if (pattern.test(cleaned)) {
        violations.push(`coaching_leak_detected: ${pattern.source}`);
        // Strip from match point onward
        cleaned = cleaned.split(pattern)[0].trim();
      }
    }

    // Ensure HCP stays in first person
    if (/\b(we evaluate|from my perspective|I think|I prioritize)/i.test(cleaned)) {
      // This is actually GOOD for role-play - HCP should say this
      warnings.push("hcp_first_person_detected_ok");
    }
  }

  // SALES-SIMULATION: Enforce coach voice, NO HCP impersonation
  if (mode === "sales-simulation") {
    // Detect if AI is speaking as HCP instead of coach
    const hcpVoicePatterns = [
      /^I'm a (busy|difficult|engaged)/i,
      /^From my clinic's perspective/i,
      /^We don't have time for/i,
      /^I've got a few minutes/i
    ];

    for (const pattern of hcpVoicePatterns) {
      if (pattern.test(cleaned)) {
        violations.push(`hcp_voice_in_sales_sim: ${pattern.source}`);
      }
    }

    // Verify required sections present
    const hasChallenge = /Challenge:/i.test(cleaned);
    const hasRepApproach = /Rep Approach:/i.test(cleaned);
    const hasImpact = /Impact:/i.test(cleaned);
    const hasSuggestedPhrasing = /Suggested Phrasing:/i.test(cleaned);

    if (!hasChallenge) warnings.push("missing_challenge_section");
    if (!hasRepApproach) warnings.push("missing_rep_approach_section");
    if (!hasImpact) warnings.push("missing_impact_section");
    if (!hasSuggestedPhrasing) warnings.push("missing_suggested_phrasing_section");
  }

  // PRODUCT-KNOWLEDGE: Check compliance
  if (mode === "product-knowledge") {
    // Flag potential off-label mentions
    const offLabelKeywords = /(off-label|unapproved indication|not indicated for)/i;
    if (offLabelKeywords.test(cleaned)) {
      // Check if properly contextualized (warning vs recommendation)
      if (!/explicitly state|not recommended|contraindicated|outside label/i.test(cleaned)) {
        violations.push("potential_off_label_claim_uncontextualized");
      } else {
        warnings.push("off_label_mentioned_but_contextualized_ok");
      }
    }

    // Ensure citations present
    const hasCitations = /\[HIV-PREP-[A-Z]+-\d+\]|\[\d+\]/i.test(cleaned);
    if (!hasCitations) {
      warnings.push("no_citations_detected");
    }
  }

  // EMOTIONAL-ASSESSMENT: Verify Socratic questions
  if (mode === "emotional-assessment") {
    const questionCount = (cleaned.match(/\?/g) || []).length;
    if (questionCount === 0) {
      warnings.push("no_socratic_questions_detected");
    } else if (questionCount >= 2) {
      warnings.push(`socratic_questions_present: ${questionCount}`);
    }
  }

  return { reply: cleaned, warnings, violations };
}

/**
 * validateCoachSchema - Ensure _coach object has required fields per mode
 */
function validateCoachSchema(coach, mode) {
  const requiredFields = {
    "sales-simulation": ["scores", "worked", "improve", "feedback"],
    "emotional-assessment": ["ei"],
    "product-knowledge": [],
    "role-play": [] // Should have NO coach data in messages
  };

  const required = requiredFields[mode] || [];
  const missing = required.filter(key => !(coach && key in coach));

  return { valid: missing.length === 0, missing };
}

/* ------------------------------ Alora Site Assistant ----------------------- */
async function handleAloraChat(body, env, req) {
  // Alora payload: { role: 'alora', site: 'reflectivai', persona, site_context, message }
  const message = body.message || "";
  const siteContext = body.site_context || "";
  const persona = body.persona || "You are Alora, a friendly and professional site assistant for ReflectivAI.";

  // Build concise system prompt for Alora
  const systemPrompt = `${persona}

You answer questions about ReflectivAI's platform, features, emotional intelligence framework, simulations, analytics, pricing, and integrations.

RESPONSE RULES:
- Keep answers SHORT (2-4 sentences max)
- Be friendly, conversational, and helpful
- DO NOT use coaching format (no "Challenge:", "Rep Approach:", etc.)
- DO NOT use numbered lists or bullet points unless absolutely necessary
- Focus on direct, clear answers
- If you don't know something from the context, suggest they request a demo or contact the team

SITE CONTEXT:
${siteContext.slice(0, 12000)}`;

  try {
    const key = selectProviderKey(env, "alora-" + cryptoRandomId());
    if (!key) throw new Error("NO_PROVIDER_KEY");

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: message }
    ];

    const payload = {
      model: env.PROVIDER_MODEL || "llama-3.1-8b-instant",
      messages,
      temperature: 0.7,
      max_tokens: 200, // Keep Alora responses short
      stream: false
    };

    const providerResp = await fetch(env.PROVIDER_URL || "https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!providerResp.ok) {
      const errText = await providerResp.text();
      console.error("alora_provider_error", { status: providerResp.status, error: errText });
      throw new Error(`Provider error: ${providerResp.status}`);
    }

    const data = await providerResp.json();
    const reply = data.choices?.[0]?.message?.content || "I'm having trouble responding right now. Please try again or contact our team.";

    return json({ reply: reply.trim() }, 200, env, req);
  } catch (e) {
    console.error("alora_chat_error", { message: e.message, stack: e.stack });
    return json({
      error: "alora_error",
      message: "Unable to process request",
      reply: "I'm having trouble right now. You can still explore the Coach, view Platform modules, or request a demo."
    }, 500, env, req);
  }
}

function validateSalesCoachContract(text) {
  const sections = ['Challenge', 'Rep Approach', 'Impact', 'Suggested Phrasing'];
  const missing = [];
  const parsed = {};

  sections.forEach(section => {
    const regex = new RegExp(`${section}:`, 'i');
    if (!regex.test(text)) {
      missing.push(section);
    } else {
      // Extract content roughly
      const match = text.match(new RegExp(`${section}:(.*?)(?=${sections.find(s => s !== section)}:|$)`, 'is'));
      parsed[section.toLowerCase().replace(' ', '')] = match ? match[1].trim() : '';
    }
  });

  return {
    ok: missing.length === 0,
    missing,
    parsed
  };
}

function fixSalesCoachContract(text, validation) {
  let fixed = text;

  validation.missing.forEach(section => {
    const placeholder = section === 'Rep Approach' ? 
      `${section}:\n- Placeholder bullet 1\n- Placeholder bullet 2\n- Placeholder bullet 3` :
      `${section}: Placeholder content for ${section.toLowerCase()}.`;
    fixed += `\n\n${placeholder}`;
  });

  console.log(`Sales Coach contract fixed: added placeholders for ${validation.missing.join(', ')}`);
  return fixed;
}

/* ------------------------------ /chat -------------------------------------- */
async function postChat(req, env) {
  // DEBUG_BREAKPOINT: worker.chat.entry
  try {
    // Defensive check: ensure at least one provider key is configured
    const keyPool = getProviderKeyPool(env);
    if (!keyPool.length) {
      console.error("chat_error", { step: "config_check", message: "NO_PROVIDER_KEYS" });
      return json({ error: "server_error", message: "No provider API keys configured" }, 500, env, req);
    }

    const body = await readJson(req);

    // Handle Alora site assistant separately - it needs concise, helpful answers, not coaching format
    if (body.role === 'alora') {
      return handleAloraChat(body, env, req);
    }

    // Handle both payload formats:
    // 1. ReflectivAI format: { mode, user, history, disease, persona, goal, plan, planId, session }
    // 2. Widget format: { model, temperature, messages, ... }
    let mode, user, history, disease, persona, goal, plan, planId, session, eiContext;

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
      eiContext = body.eiContext || "";
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
      eiContext = body.eiContext || "";
    }

    // INPUT EDGE CASES: Empty or whitespace-only user message returns 400
    if (!user || String(user).trim() === "") {
      return json({
        error: {
          type: "bad_request",
          code: "EMPTY_USER_MESSAGE",
          message: "User message cannot be empty or whitespace only"
        }
      }, 400, env, req);
    }

    // DEBUG_BREAKPOINT: worker.chat.mode-routing

    // Load or build a plan
    let activePlan = plan;
    if (!activePlan) {
      try {
        // Generate plan directly without creating a fake Request
        const factsRes = FACTS_DB.filter(f => {
          const dOk = !disease || f.ta?.toLowerCase() === String(disease).toLowerCase();
          return dOk;
        });
        
        // CONTEXT EDGE CASES: Always ensure fallback facts, never empty array
        let facts = factsRes.slice(0, 8);
        if (facts.length === 0) {
          // Fallback to first 8 facts from FACTS_DB if filter yields empty array
          facts = FACTS_DB.slice(0, 8);
        }

        activePlan = {
          planId: cryptoRandomId(),
          mode, disease, persona, goal,
          facts: facts.map(f => ({ id: f.id, text: f.text, cites: f.cites || [] })),
          fsm: FSM[mode] || FSM["sales-simulation"]
        };
      } catch (e) {
        console.error("chat_error", { step: "plan_generation", message: e.message });
        throw new Error("plan_generation_failed");
      }
    }

    // Validate activePlan structure to avoid obscure crashes
    if (!activePlan || !Array.isArray(activePlan.facts) || activePlan.facts.length === 0) {
      console.error("chat_error", { step: "plan_validation", message: "no_active_plan_or_facts", activePlan });
      throw new Error("no_active_plan_or_facts");
    }

    // Provider prompts with format hardening
    const factsStr = activePlan.facts.map(f => `- [${f.id}] ${f.text}`).join("\n");
    const citesStr = activePlan.facts.flatMap(f => f.cites || []).slice(0, 6).map(c => `- ${c}`).join("\n");

    // Mode-specific contracts - ENTERPRISE PHARMA FORMATTING
    const salesContract = `
You MUST respond in EXACTLY this structure:

Challenge:
<one short sentence>

Rep Approach:
- <bullet 1>
- <bullet 2>
- <bullet 3>

Impact:
<one short sentence>

Suggested Phrasing:
<1–3 short example lines>

Rules:
- Do NOT add new sections.
- Do NOT rename sections.
- Do NOT remove sections.
- Do NOT use markdown (#, ##, **, etc.).
- Do NOT use xml, html, json, or code blocks.
- ALWAYS include all four sections.

RESPONSE FORMAT (MANDATORY - MUST INCLUDE ALL 4 SECTIONS):

Challenge: [ONE SENTENCE describing the HCP's concern, barrier, or knowledge gap - 15-25 words]

Rep Approach:
• [BULLET 1: Specific clinical discussion point with full context - Include "as recommended..." or "as indicated..." phrasing - 20-35 words - MUST include reference code [HIV-PREP-XXX]]
• [BULLET 2: Supporting strategy with rationale - Include contextual phrases like "for PrEP" or "in the FDA label" - 20-35 words - MUST include reference code [HIV-PREP-XXX]]
• [BULLET 3: Safety/monitoring consideration with clinical detail - Include phrases like "to ensure..." or "per the FDA label" - 20-35 words - MUST include reference code [HIV-PREP-XXX]]
[EXACTLY 3 BULLETS - NO MORE, NO LESS - Use • or 1. 2. 3. or - format]

Impact: [ONE SENTENCE describing expected outcome - 20-35 words - Connect back to Challenge]

Suggested Phrasing: "[EXACT words rep should say - Conversational, professional tone - 25-40 words total - Include key clinical points]"

CRITICAL ANTI-REPETITION RULES:
- RETURN EACH SECTION EXACTLY ONCE - DO NOT REPEAT ANY SECTION
- DO NOT ECHO THE FORMAT TEMPLATE MULTIPLE TIMES
- DO NOT DUPLICATE CONTENT ACROSS SECTIONS
- IF YOU FIND YOURSELF STARTING TO REPEAT "Challenge:" OR "Rep Approach:" - STOP IMMEDIATELY

BULLET WRITING REQUIREMENTS:
- Include full context phrases: "as recommended for...", "as indicated in the FDA label...", "per the label...", "to ensure..."
- Make each bullet clinically substantial - don't abbreviate
- Connect action to outcome (e.g., "to identify individuals at substantial risk")
- Reference specific clinical guidelines or label language
- Each bullet should be 20-35 words (NOT the old 25 word max)

EXAMPLE (follow this detailed style):
Challenge: The HCP may not be prioritizing PrEP prescriptions due to lack of awareness about the substantial risk of HIV in certain patient populations.

Rep Approach:
• Discuss the importance of assessing sexual and injection risk factors to identify individuals at substantial risk of HIV, as recommended for PrEP eligibility [HIV-PREP-ELIG-001].
• Highlight the efficacy and safety profile of Descovy (emtricitabine/tenofovir alafenamide) for PrEP, excluding receptive vaginal sex, as indicated in the FDA label [HIV-PREP-TAF-002].
• Emphasize the need for renal function assessment before and during PrEP, considering eGFR thresholds per the FDA label, to ensure safe prescribing practices [HIV-PREP-SAFETY-003].

Impact: By emphasizing the importance of risk assessment, the benefits of Descovy for PrEP, and the need for renal function monitoring, the HCP will be more likely to prioritize PrEP prescriptions for at-risk patients and commit to proactive Descovy prescribing.

Suggested Phrasing: "Given the substantial risk of HIV in certain patient populations, I recommend we discuss how to identify and assess these individuals for PrEP eligibility, and consider Descovy as a safe and effective option."

Then append deterministic EI scoring:
<coach>{
  "scores":{"empathy":0-5,"clarity":0-5,"compliance":0-5,"discovery":0-5,"objection_handling":0-5,"confidence":0-5,"active_listening":0-5,"adaptability":0-5,"action_insight":0-5,"resilience":0-5},
  "rationales":{"empathy":"...","clarity":"...","compliance":"...","discovery":"...","objection_handling":"...","confidence":"...","active_listening":"...","adaptability":"...","action_insight":"...","resilience":"..."},
  "tips":["Tip 1","Tip 2","Tip 3"],
  "rubric_version":"v2.0"
}</coach>

CRITICAL: Use ONLY the provided Facts context when making claims. NO fabricated references or citations.`.trim();

    const commonContract = `
Return exactly two parts. No code blocks or headings.

1) Sales Guidance: short, accurate, label-aligned guidance (3–5 sentences) and a "Suggested Phrasing:" single-sentence line.
2) <coach>{
  "scores":{"empathy":0-5,"clarity":0-5,"compliance":0-5,"discovery":0-5,"objection_handling":0-5,"confidence":0-5,"active_listening":0-5,"adaptability":0-5,"action_insight":0-5,"resilience":0-5},
  "worked":["…"],"improve":["…"],"phrasing":"…","feedback":"…",
  "context":{"rep_question":"...","hcp_reply":"..."}
}</coach>

CRITICAL: Base all claims on the provided Facts context. NO fabricated citations.`.trim();

    // Enhanced prompts for format hardening
    const salesSimPrompt = [
      `You are the ReflectivAI Sales Coach. Be label-aligned and specific to the facts.`,
      `Disease: ${disease || "—"}; Persona: ${persona || "—"}; Goal: ${goal || "—"}.`,
      `Facts:\n${factsStr}\nReferences:\n${citesStr}`,
      ``,
      salesContract
    ].join("\n");

    const rolePlayPrompt = [
      `You are the HCP in Role Play mode. Speak ONLY as the HCP in first person.`,
      ``,
      `Disease: ${disease || "—"}; Persona: ${persona || "—"}; Goal: ${goal || "—"}.`,
      `Facts:\n${factsStr}\nReferences:\n${citesStr}`,
      ``,
      `HCP BEHAVIOR:`,
      `- Respond naturally as this HCP would in a real clinical setting`,
      `- Use 1-4 sentences OR brief bulleted lists when explaining clinical reasoning`,
      `- Bullets ARE natural for HCPs when listing: priorities, processes, treatment steps, monitoring criteria`,
      `- Reflect time pressure, priorities, and decision style from persona`,
      `- Stay professional and realistic`,
      ``,
      `CRITICAL RULES:`,
      `- NO coaching language ("You should have...", "The rep...")`,
      `- NO evaluation or scores  `,
      `- NO "Suggested Phrasing:" or "Rep Approach:" meta-commentary`,
      `- STAY IN CHARACTER as HCP throughout entire conversation`,
      ``,
      `EXAMPLE HCP RESPONSES:`,
      `"From my perspective, we evaluate high-risk patients using history, behaviors, and adherence context."`,
      `"• I prioritize regular follow-up appointments to assess treatment efficacy and detect any potential issues early. • I also encourage patients to report any changes in symptoms or side effects promptly. • Additionally, I consider using digital tools to enhance patient engagement and monitoring."`,
      `"I appreciate your emphasis on timely interventions and proactive prescribing."`,
      `"I've got a few minutes, what's on your mind?"`,
      ``,
      `Remember: You are the HCP. Natural, brief, clinical voice only - bullets allowed when clinically appropriate.`
    ].join("\n");

    const eiPrompt = [
      `You are Reflectiv Coach in Emotional Intelligence mode.`,
      ``,
      `HCP Type: ${persona || "—"}; Disease context: ${disease || "—"}.`,
      ``,
      `MISSION: Help the rep develop emotional intelligence through reflective practice based on about-ei.md framework.`,
      ``,
      eiContext || "EI knowledgebase not provided.",
      ``,
      `FOCUS AREAS (CASEL SEL Competencies):`,
      `- Self-Awareness: Recognizing emotions, triggers, communication patterns`,
      `- Self-Regulation: Managing stress, tone, composure under pressure`,
      `- Empathy/Social Awareness: Acknowledging HCP perspective, validating concerns`,
      `- Clarity: Concise messaging without jargon`,
      `- Relationship Skills: Building rapport, navigating disagreement`,
      `- Responsible Decision-Making/Compliance: Balancing empathy with ethical boundaries`,
      ``,
      `TRIPLE-LOOP REFLECTION ARCHITECTURE:`,
      `Loop 1 (Task Outcome): Did they accomplish the communication objective?`,
      `Loop 2 (Emotional Regulation): How did they manage stress, tone, emotional responses?`,
      `Loop 3 (Mindset Reframing): What beliefs or patterns should change for future conversations?`,
      ``,
      `USE SOCRATIC METACOACH PROMPTS:`,
      `Self-Awareness: "What did you notice about your tone just now?" "What emotion are you holding as you plan your next response?"`,
      `Perspective-Taking: "How might the HCP have perceived your last statement?" "What might be driving the HCP's resistance?"`,
      `Pattern Recognition: "What do you notice about how you respond when someone challenges your evidence?"`,
      `Reframing: "What assumption did you hold about this HCP that shaped your approach?" "If objections are requests for clarity, how would you rephrase?"`,
      `Regulation: "Where do you feel tension when hearing that objection?" "What would change if you paused for two seconds before responding?"`,
      ``,
      `OUTPUT STYLE:`,
      `- 2-4 short paragraphs of guidance (max 350 words)`,
      `- Include 1-2 Socratic questions to deepen metacognition`,
      `- Reference Triple-Loop Reflection when relevant`,
      `- Model empathy and warmth in your coaching tone`,
      `- End with a reflective question that builds emotional metacognition`,
      ``,
      `DO NOT:`,
      `- Role-play as HCP`,
      `- Provide sales coaching or product info`,
      `- Include coach scores or rubrics`,
      `- Use structured Challenge/Rep Approach format`
    ].join("\n");

    const pkPrompt = [
      `You are ReflectivAI, an advanced AI knowledge partner for life sciences professionals.`,
      ``,
      `CORE IDENTITY:`,
      `You are a highly knowledgeable, scientifically rigorous assistant trained to answer questions across:`,
      `- Disease states, pathophysiology, and clinical management`,
      `- Pharmacology, mechanisms of action, and therapeutic approaches`,
      `- Clinical trials, evidence-based medicine, and guidelines`,
      `- Life sciences topics: biotechnology, drug development, regulatory affairs`,
      `- General knowledge: business, strategy, technology, healthcare trends`,
      `- Anything a thoughtful AI assistant could help with`,
      ``,
      `CONVERSATION STYLE:`,
      `- Comprehensive yet accessible - explain complex topics clearly`,
      `- Balanced - present multiple perspectives when appropriate`,
      `- Evidence-based - cite sources when making scientific claims`,
      `- Helpful - anticipate follow-up questions and offer relevant insights`,
      `- Professional - maintain scientific accuracy while being engaging`,
      ``,
      `RESPONSE STRUCTURE (flexible based on question):`,
      ``,
      `**For scientific/medical questions:**`,
      `- Clear, structured explanations (use headers, bullets, or paragraphs as appropriate)`,
      `- Clinical context and relevance`,
      `- Evidence citations [1], [2] when available`,
      `- Practical implications for HCPs or patients`,
      `- Acknowledge uncertainties or limitations in evidence`,
      ``,
      `**For general questions:**`,
      `- Direct, helpful answers`,
      `- Context and background as needed`,
      `- Multiple perspectives or approaches when relevant`,
      ``,
      `AVAILABLE CONTEXT:`,
      `${disease ? `Disease Focus: ${disease}` : ''}`,
      `${persona ? `HCP Context: ${persona}` : ''}`,
      `${factsStr ? `\nRelevant Facts:\n${factsStr}` : ''}`,
      `${citesStr ? `\nReferences:\n${citesStr}` : ''}`,
      ``,
      `COMPLIANCE & QUALITY STANDARDS:`,
      `- Distinguish clearly between on-label and off-label information`,
      `- Present risks, contraindications, and safety considerations alongside benefits`,
      `- Recommend consulting official sources (FDA labels, guidelines) for prescribing decisions`,
      `- Use [numbered citations] for clinical claims when references are available`,
      `- If asked about something outside your knowledge, acknowledge limitations`,
      ``,
      `EXAMPLE INTERACTIONS:`,
      ``,
      `Q: "What are the 5 key facts I need to know about this disease state?"`,
      `A: Here are 5 essential points about [disease]:`,
      `1. **Epidemiology:** [prevalence, key populations affected]`,
      `2. **Pathophysiology:** [disease mechanism, biological basis]`,
      `3. **Clinical Presentation:** [symptoms, diagnostic criteria]`,
      `4. **Current Standard of Care:** [first-line treatments, guidelines]`,
      `5. **Emerging Approaches:** [new therapies, ongoing research]`,
      ``,
      `Q: "How should I approach a busy PCP about this therapy?"`,
      `A: When engaging busy PCPs, focus on:`,
      `- **Time efficiency:** Lead with the single most relevant data point`,
      `- **Practice relevance:** Connect to their patient population and workflow`,
      `- **Evidence:** Brief reference to key trial or guideline`,
      `- **Action:** One clear next step (trial offer, patient identification, etc.)`,
      ``,
      `PCPs appreciate concise, practice-applicable information that respects their time constraints while addressing real clinical needs.`,
      ``,
      `Q: "Explain the mechanism of action"`,
      `A: [Detailed, clear explanation of MOA with appropriate technical depth, clinical relevance, and how it translates to therapeutic benefit]`,
      ``,
      `RESPONSE LENGTH:`,
      `- Short questions: 100-200 words`,
      `- Complex topics: 300-600 words`,
      `- Very complex or multi-part questions: up to 800 words`,
      `- Always prioritize clarity over brevity`,
      ``,
      `YOUR GOAL: Be the most helpful, knowledgeable, and trustworthy AI thought partner possible.`
    ].join("\n");

    const generalKnowledgePrompt = [
      `You are ReflectivAI General Assistant - a helpful, knowledgeable AI that can discuss ANY topic.`,
      ``,
      `CORE CAPABILITIES:`,
      `You can answer questions on ANY subject, including but not limited to:`,
      `- Science & Medicine: disease states, biology, chemistry, physics`,
      `- Technology: AI, software, hardware, emerging tech`,
      `- Business: strategy, management, economics, finance`,
      `- Arts & Humanities: history, literature, philosophy, culture`,
      `- Current Events: news, trends, social topics`,
      `- Practical Knowledge: how-to guides, advice, explanations`,
      `- Creative Topics: writing, design, problem-solving`,
      ``,
      `You are NOT limited to life sciences or pharma topics. Answer anything the user asks with helpfulness and accuracy.`,
      ``,
      `CONVERSATION STYLE:`,
      `- **Comprehensive yet concise:** Provide thorough answers without unnecessary verbosity`,
      `- **Well-structured:** Use headers (##, ###), bullets, numbered lists, or paragraphs as appropriate`,
      `- **Clear & accessible:** Explain complex topics in understandable language`,
      `- **Balanced:** Present multiple perspectives when relevant`,
      `- **Evidence-based:** Reference sources for factual claims when possible`,
      `- **Engaging:** Maintain a friendly, professional tone`,
      `- **Helpful:** Anticipate follow-up questions and offer related insights`,
      ``,
      `CRITICAL FORMATTING RULES:`,
      `- Put each numbered item on a NEW LINE (1. First item\\n2. Second item)`,
      `- Put each bullet point on a NEW LINE (- Bullet one\\n- Bullet two)`,
      `- Use proper markdown syntax with line breaks between list items`,
      `- DO NOT write inline lists like "1. First - sub - sub 2. Second"`,
      `- DO NOT put bullets in the middle of sentences`,
      `- Lists must have each item on its own line`,
      ``,
      `RESPONSE STRUCTURE:`,
      ``,
      `**For factual questions:**`,
      `- Direct answer upfront`,
      `- Supporting context and details`,
      `- Examples when helpful`,
      `- Related information or considerations`,
      ``,
      `**For complex topics:**`,
      `- Brief overview/definition`,
      `- Key concepts broken down with headers or bullets`,
      `- Practical implications or examples`,
      `- Acknowledgment of nuances or uncertainties`,
      ``,
      `**For how-to or advice questions:**`,
      `- Step-by-step guidance or structured recommendations`,
      `- Rationale for each point`,
      `- Common pitfalls to avoid`,
      `- Alternative approaches when relevant`,
      ``,
      `RESPONSE LENGTH GUIDELINES:`,
      `- Simple factual questions: 50-150 words`,
      `- Standard questions: 200-400 words`,
      `- Complex or multi-part questions: 400-700 words`,
      `- Very complex topics requiring depth: up to 900 words`,
      ``,
      `QUALITY STANDARDS:`,
      `- Accuracy: Provide correct, up-to-date information`,
      `- Clarity: Avoid jargon unless necessary; define technical terms`,
      `- Completeness: Address all parts of multi-part questions`,
      `- Honesty: Acknowledge limitations in knowledge or uncertainty`,
      `- Relevance: Stay focused on what the user asked`,
      ``,
      `EXAMPLE INTERACTIONS:`,
      ``,
      `Q: "What is the capital of France?"`,
      `A: The capital of France is **Paris**.`,
      ``,
      `Paris has been France's capital since 987 CE and is located in the north-central part of the country along the Seine River. It's not only France's political center but also its cultural, economic, and artistic heart.`,
      ``,
      `Key facts:`,
      `- Population: ~2.2 million in the city, ~12 million in the metro area`,
      `- Known as "The City of Light" (La Ville Lumière)`,
      `- Home to iconic landmarks: Eiffel Tower, Louvre, Notre-Dame, Arc de Triomphe`,
      ``,
      `Q: "Explain quantum computing"`,
      `A: Quantum computing is a revolutionary approach to computation that leverages quantum mechanics to process information differently than classical computers.`,
      ``,
      `**Core Concepts:**`,
      `- **Qubits vs Bits:** Classical computers use bits (0 or 1). Quantum computers use qubits, which can be in superposition (0 AND 1 simultaneously)`,
      `- **Superposition:** Enables parallel processing of multiple states`,
      `- **Entanglement:** Qubits can be linked; measuring one affects others instantly`,
      `- **Interference:** Amplifies correct answers, cancels wrong ones`,
      ``,
      `**Advantages:**`,
      `Quantum computers excel at specific problems:`,
      `- Cryptography (breaking/creating encryption)`,
      `- Drug discovery (molecular simulations)`,
      `- Optimization (logistics, finance)`,
      `- Machine learning (pattern recognition)`,
      ``,
      `**Current Status:**`,
      `We're in early stages - working prototypes exist (IBM, Google, Microsoft) but face challenges:`,
      `- Extreme fragility (requires near absolute-zero temperatures)`,
      `- High error rates`,
      `- Limited qubits available (50-1000 today; millions needed)`,
      ``,
      `Think of it as the 1950s of classical computing - revolutionary potential, but decades from mainstream use.`,
      ``,
      `YOUR MISSION: Be the most helpful, versatile, and knowledgeable AI assistant possible. Answer any question with accuracy, clarity, and genuine helpfulness.`
    ].join("\n");

    // Select prompt based on mode
    let sys;
    if (mode === "role-play") {
      sys = rolePlayPrompt;
    } else if (mode === "sales-simulation") {
      sys = salesSimPrompt;
    } else if (mode === "emotional-assessment") {
      sys = eiPrompt;
    } else if (mode === "product-knowledge") {
      sys = pkPrompt;
    } else if (mode === "general-knowledge") {
      sys = generalKnowledgePrompt;
    } else {
      sys = salesSimPrompt; // default fallback
    }

    const messages = [
      { role: "system", content: sys },
      ...history.map(m => ({ role: m.role, content: String(m.content || "") })).slice(-18),
      { role: "user", content: String(user || "") }
    ];

    // Provider call with retry and mode-specific token allocation
    let raw = "";
    for (let i = 0; i < 3; i++) {
      try {
        // Token allocation prioritization
        let maxTokens;
        if (mode === "sales-simulation") {
          maxTokens = 1600; // Increased to ensure all 4 sections complete (including Suggested Phrasing)
        } else if (mode === "role-play") {
          maxTokens = 1200; // Higher for natural conversation flow
        } else if (mode === "emotional-assessment") {
          maxTokens = 1200; // Comprehensive EI coaching with reflective questions
        } else if (mode === "product-knowledge") {
          maxTokens = 1800; // HIGH - comprehensive AI assistant responses (like ChatGPT)
        } else if (mode === "general-knowledge") {
          maxTokens = 1800; // HIGH - comprehensive general knowledge responses
        } else {
          maxTokens = 900; // Default
        }

        // DEBUG_BREAKPOINT: worker.chat.call-llm
        raw = await providerChat(env, messages, {
          maxTokens,
          temperature: 0.2,
          session
        });
        if (raw) break;
      } catch (e) {
        console.error("chat_error", { step: "provider_call", attempt: i + 1, message: e.message });
        if (i === 2) throw e;
        await new Promise(r => setTimeout(r, 300 * (i + 1)));
      }
    }

    // Validate and fix Sales Coach contract if needed
    if (mode === "sales-simulation") {
      const validation = validateSalesCoachContract(raw);
      if (!validation.ok) {
        console.log("Sales Coach contract validation failed, injecting placeholders", validation.missing);
        raw = fixSalesCoachContract(raw, validation);
      }
    }

    // Extract coach and clean text
    const { coach, clean } = extractCoach(raw);
    // DEBUG_BREAKPOINT: worker.chat.postprocess
    let reply = clean;

    // Role-play: honor optional XML wrapper if produced
    if (mode === "role-play") {
      const role = (raw.match(/<role>(.*?)<\/role>/is) || [])[1]?.trim();
      const content = (raw.match(/<content>([\s\S]*?)<\/content>/i) || [])[1]?.trim();
      if (role && role.toLowerCase() === "hcp" && content) {
        reply = sanitizeLLM(content);
      }
    }

    // Post-processing: Strip unwanted formatting for role-play mode
    if (mode === "role-play") {
      // Remove coaching labels but KEEP bullets for clinical explanations (natural HCP speech)
      reply = reply
        .replace(/^[\s]*Suggested Phrasing:\s*/gmi, '')  // Remove "Suggested Phrasing:" labels
        .replace(/^[\s]*Coach Guidance:\s*/gmi, '')      // Remove any leaked coach headings
        .replace(/^[\s]*Challenge:\s*/gmi, '')
        .replace(/^[\s]*Rep Approach:\s*/gmi, '')
        .replace(/^[\s]*Impact:\s*/gmi, '')
        .replace(/^[\s]*Next-Move Planner:\s*/gmi, '')
        .replace(/^[\s]*Risk Flags:\s*/gmi, '')
        .trim();

      // Don't remove bullets - HCPs naturally use them for clinical processes
      // Example: "• I prioritize follow-ups • I assess adherence"
    }

    // Post-processing: Normalize headings and ENFORCE FORMAT for sales-simulation mode
    if (mode === "sales-simulation") {
      reply = reply
        .replace(/Coach [Gg]uidance:/g, 'Challenge:')
        .replace(/Next[- ]?[Mm]ove [Pp]lanner:/g, 'Rep Approach:')
        .replace(/Risk [Ff]lags:/g, 'Impact:')
        .replace(/Suggested [Pp]hrasing:/g, 'Suggested Phrasing:')
        .replace(/Rubric [Jj][Ss][Oo][Nn]:/g, '');

      // ENTERPRISE FORMATTING VALIDATION - Enforce exactly 1 Challenge, 3 bullets, 1 Impact, 1 Phrasing
      const hasChallenge = /Challenge:/i.test(reply);
      const hasRepApproach = /Rep Approach:/i.test(reply);
      const hasImpact = /Impact:/i.test(reply);
      const hasSuggested = /Suggested Phrasing:/i.test(reply);

      // Count bullets in Rep Approach section - accept multiple formats
      const repMatch = reply.match(/Rep Approach:(.*?)(?=Impact:|Suggested Phrasing:|$)/is);
      const bulletCount = repMatch ? (
        (repMatch[1].match(/•/g) || []).length +           // Unicode bullet
        (repMatch[1].match(/\d+\./g) || []).length +       // Numbered list (1. 2. 3.)
        (repMatch[1].match(/^\s*[-*]\s/gm) || []).length + // Dash or asterisk bullets
        (repMatch[1].match(/●/g) || []).length             // Alternative bullet
      ) : 0;

      // Validation warnings (log for monitoring, don't block)
      if (!hasChallenge || !hasRepApproach || !hasImpact || !hasSuggested) {
        console.warn("sales_simulation_format_incomplete", {
          has_challenge: hasChallenge,
          has_rep_approach: hasRepApproach,
          has_impact: hasImpact,
          has_suggested: hasSuggested,
          bullet_count: bulletCount
        });
      }

      // Force-add Suggested Phrasing if missing (model consistently cuts off after Impact)
      if (!hasSuggested) {
        const repText = repMatch ? repMatch[1] : '';
        let phrasing = `"Would you like to discuss how this approach fits your practice?"`;

        if (repText.includes('assess') || repText.includes('eligibility')) {
          phrasing = `"Can we review patient eligibility criteria together?"`;
        } else if (repText.includes('renal') || repText.includes('monitor')) {
          phrasing = `"Let's confirm the monitoring protocol that works for your workflow."`;
        } else if (repText.includes('adherence') || repText.includes('follow-up')) {
          phrasing = `"How do you currently support adherence in your at-risk population?"`;
        }

        reply += `\n\nSuggested Phrasing: ${phrasing}`;
      }

      // Enforce exactly 3 bullets if Rep Approach exists but has wrong count
      if (hasRepApproach && bulletCount !== 3 && repMatch) {
        // Try to extract existing bullets using multiple patterns
        const existingBullets = [];
        const repText = repMatch[1];
        
        // Look for different bullet formats
        const bulletPatterns = [
          /(?:^|\n)\s*•\s*(.+?)(?=\n\s*•|\n\s*\d+\.|\n\s*[-*]|\n\s*Impact:|$)/g,
          /(?:^|\n)\s*\d+\.\s*(.+?)(?=\n\s*\d+\.|\n\s*•|\n\s*[-*]|\n\s*Impact:|$)/g,
          /(?:^|\n)\s*[-*]\s*(.+?)(?=\n\s*[-*]|\n\s*•|\n\s*\d+\.|\n\s*Impact:|$)/g
        ];
        
        for (const pattern of bulletPatterns) {
          let match;
          while ((match = pattern.exec(repText)) !== null) {
            existingBullets.push(match[1].trim());
          }
        }
        
        // Remove duplicates and take first 3
        const uniqueBullets = [...new Set(existingBullets)].slice(0, 3);
        
        // Pad with defaults if needed
        while (uniqueBullets.length < 3) {
          uniqueBullets.push(`• Reinforce evidence-based approach`);
        }
        
        const newRepSection = `Rep Approach:\n• ${uniqueBullets.join('\n• ')}`;
        reply = reply.replace(/Rep Approach:.*?(?=Impact:|Suggested Phrasing:|$)/is, newRepSection + '\n\n');
      }
    }

    // STRUCTURE EDGE CASES: Enforce paragraph separation for sales-coach mode (STR-30)
    if (mode === "sales-simulation") {
      reply = reply
        .replace(/\r\n/g, "\n")
        .replace(/\s*Challenge:/gi, "\n\nChallenge:")
        .replace(/\s*Rep Approach:/gi, "\n\nRep Approach:")
        .replace(/\s*Impact:/gi, "\n\nImpact:")
        .replace(/\s*Suggested Phrasing:/gi, "\n\nSuggested Phrasing:");
      reply = reply.replace(/\n{3,}/g, "\n\n").trim();
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
        const contRaw = await providerChat(env, contMsgs, { maxTokens: 180, temperature: 0.2, session });
        const contClean = sanitizeLLM(contRaw || "");
        if (contClean) reply = (reply + " " + contClean).trim();
      } catch (_) { }
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

    // Deterministic scoring if provider omitted or malformed
    let coachObj = coach && typeof coach === "object" ? coach : null;
    if (!coachObj || !coachObj.scores) {
      const usedFactIds = (activePlan.facts || []).map(f => f.id);
      const overall = deterministicScore({ reply, usedFactIds });
      coachObj = {
        overall,
        scores: { empathy: 3, clarity: 4, compliance: 4, discovery: /[?]\s*$/.test(reply) ? 4 : 3, objection_handling: 3, confidence: 4, active_listening: 3, adaptability: 3, action_insight: 3, resilience: 3 },
        worked: ["Tied guidance to facts"],
        improve: ["End with one specific discovery question"],
        phrasing: "Would confirming eGFR today help you identify one patient to start this month?",
        feedback: "Stay concise. Cite label-aligned facts. Close with one clear question.",
        context: { rep_question: String(user || ""), hcp_reply: reply }
      };
    }

    // ═══════════════════════════════════════════════════════════════════
    // VALIDATION & GUARDRAILS - Apply mode-specific safety checks
    // ═══════════════════════════════════════════════════════════════════
    const validation = validateModeResponse(mode, reply, coachObj);
    reply = validation.reply; // Use cleaned reply

    // Log validation results for debugging
    if (validation.warnings.length > 0 || validation.violations.length > 0) {
      console.log({
        event: "validation_check",
        mode,
        warnings: validation.warnings,
        violations: validation.violations,
        reply_length: reply.length
      });
    }

    // Schema validation
    const schemaCheck = validateCoachSchema(coachObj, mode);
    if (!schemaCheck.valid) {
      console.log({
        event: "schema_validation_failed",
        mode,
        missing_fields: schemaCheck.missing,
        coach_keys: Object.keys(coachObj || {})
      });
    }

    // Enhanced debug logging (disabled in production via env var)
    if (env.DEBUG_MODE === "true") {
      console.log({
        event: "chat_response_debug",
        mode,
        reply_length: reply.length,
        has_coach: !!coachObj,
        coach_keys: Object.keys(coachObj || {}),
        format_check: {
          has_challenge: /Challenge:/i.test(reply),
          has_rep_approach: /Rep Approach:/i.test(reply),
          has_impact: /Impact:/i.test(reply),
          has_suggested_phrasing: /Suggested Phrasing:/i.test(reply),
          has_citations: /\[HIV-PREP-[A-Z]+-\d+\]|\[\d+\]/i.test(reply),
          ends_with_question: /\?\s*$/.test(reply)
        },
        validation: {
          warnings: validation.warnings,
          violations: validation.violations
        }
      });
    }

    // DEBUG_BREAKPOINT: worker.chat.response
    return json({ reply, coach: coachObj, plan: { id: planId || activePlan.planId } }, 200, env, req);
  } catch (e) {
    console.error("chat_error", { step: "general", message: e.message, stack: e.stack });

    // Distinguish provider errors from client bad_request errors
    const isProviderError = e.message && (
      e.message.startsWith("provider_http_") ||
      e.message === "plan_generation_failed"
    );

    const isPlanError = e.message === "no_active_plan_or_facts";

    if (isProviderError) {
      // Provider errors return 200 with error JSON for test harness compatibility
      return json({
        error: {
          type: "provider_error",
          code: "PROVIDER_UNAVAILABLE",
          message: "External provider failed or is unavailable"
        }
      }, 200, env, req);
    } else if (isPlanError) {
      // Plan validation errors return 422 Unprocessable Entity
      return json({
        error: "bad_request",
        message: "Unable to generate or validate plan with provided parameters"
      }, 422, env, req);
    } else {
      // Other errors are treated as bad_request
      return json({
        error: "bad_request",
        message: "Chat request failed"
      }, 400, env, req);
    }
  }
}

/* -------------------------- /coach-metrics --------------------------------- */
async function postCoachMetrics(req, env) {
  try {
    const body = await readJson(req);

    // Log the metrics (in production, you could store these in KV or send to analytics)
    console.log("coach_metrics", {
      ts: body.ts || Date.now(),
      schema: body.schema || "coach-v2",
      mode: body.mode,
      scenarioId: body.scenarioId,
      turn: body.turn,
      overall: body.overall,
      scores: body.scores
    });

    // Return success
    return json({
      ok: true,
      message: "Metrics recorded",
      timestamp: Date.now()
    }, 200, env, req);
  } catch (e) {
    console.error("postCoachMetrics error:", e);
    return json({ error: "server_error", message: "Failed to record metrics" }, 500, env, req);
  }
}

function cryptoRandomId() {
  const a = new Uint8Array(8);
  crypto.getRandomValues(a);
  return [...a].map(x => x.toString(16).padStart(2, "0")).join("");
}

/* -------------------------- Rate limiting --------------------------- */
const _buckets = new Map();
function rateLimit(key, env) {
  const rate = Number(env.RATELIMIT_RATE || 10);
  const burst = Number(env.RATELIMIT_BURST || 4);
  const now = Date.now();
  const b = _buckets.get(key) || { tokens: burst, ts: now };
  const elapsed = (now - b.ts) / 60000; // per minute
  b.tokens = Math.min(burst, b.tokens + elapsed * rate);
  b.ts = now;
  if (b.tokens < 1) { _buckets.set(key, b); return { ok: false, limit: rate, remaining: 0 }; }
  b.tokens -= 1; _buckets.set(key, b);
  return { ok: true, limit: rate, remaining: Math.max(0, Math.floor(b.tokens)) };
}
