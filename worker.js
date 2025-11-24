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

// Timeout constants (in milliseconds)
// Cloudflare Workers have 30-50s execution limits; timeouts prevent worker death
const TIMEOUT_PROVIDER_CHAT = 25000;  // 25s for main chat requests
const TIMEOUT_ALORA_CHAT = 15000;     // 15s for Alora site assistant (shorter responses)
const TIMEOUT_HEALTH_CHECK = 5000;    // 5s for health checks

export default {
  async fetch(req, env, ctx) {
    const reqId = req.headers.get("x-req-id") || cryptoRandomId();
    try {
      const url = new URL(req.url);

      // One-time environment validation log
      if (!globalThis.__CFG_LOGGED__) {
        const keyPool = getProviderKeyPool(env);
        const allowed = String(env.CORS_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
        
        // Log key pool with masked keys for debugging rotation
        const maskedKeys = keyPool.map((key, idx) => `key_${idx + 1}: ${key.substring(0, 7)}...${key.substring(key.length - 4)}`);
        
        console.log({ 
          event: "startup_config", 
          key_pool_size: keyPool.length, 
          key_pool_masked: maskedKeys,
          cors_allowlist_size: allowed.length, 
          rotation_strategy: (env.PROVIDER_ROTATION_STRATEGY || 'round-robin')
        });
        globalThis.__CFG_LOGGED__ = true;
      }

      // CORS Preflight Handling (OPTIONS requests)
      // Browser sends OPTIONS before actual request to check if cross-origin request is allowed
      // We respond with 204 No Content + full CORS headers
      // See: https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS#preflighted_requests
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
              // FIX: Add timeout to health check
              const controller = new AbortController();
              const timeout = setTimeout(() => controller.abort(), TIMEOUT_HEALTH_CHECK);
              
              try {
                const r = await fetch((env.PROVIDER_URL || "https://api.groq.com/openai/v1/chat/completions").replace(/\/chat\/completions$/, "/models"), {
                  headers: { "authorization": `Bearer ${key}` }, 
                  method: "GET",
                  signal: controller.signal
                });
                provider = { ok: r.ok, status: r.status };
              } finally {
                clearTimeout(timeout);
              }
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
    cites: ["[CDC PrEP Guidelines](https://www.cdc.gov/hiv/pdf/risk/prep/cdc-hiv-prep-guidelines-2021.pdf)"]
  },
  {
    id: "HIV-PREP-TAF-002",
    ta: "HIV",
    topic: "Descovy for PrEP",
    text: "Descovy (emtricitabine/tenofovir alafenamide) is indicated for PrEP excluding receptive vaginal sex.",
    cites: ["[Descovy PI](https://www.gilead.com/-/media/files/pdfs/medicines/hiv/descovy/descovy_pi.pdf)"]
  },
  {
    id: "HIV-PREP-SAFETY-003",
    ta: "HIV",
    topic: "Safety",
    text: "Assess renal function before and during PrEP. Consider eGFR thresholds per label.",
    cites: ["[Descovy PI](https://www.gilead.com/-/media/files/pdfs/medicines/hiv/descovy/descovy_pi.pdf)", "[CDC PrEP Guidelines](https://www.cdc.gov/hiv/pdf/risk/prep/cdc-hiv-prep-guidelines-2021.pdf)"]
  },
  {
    id: "ONCOLOGY-TREATMENT-001",
    ta: "Oncology",
    topic: "Targeted Therapies",
    text: "Targeted therapies inhibit specific molecules involved in cancer growth and progression.",
    cites: ["[NCI Targeted Therapies](https://www.cancer.gov/about-cancer/treatment/types/targeted-therapies)"]
  },
  {
    id: "ONCOLOGY-SURVIVAL-002",
    ta: "Oncology",
    topic: "Survival Rates",
    text: "Five-year survival rates vary by cancer type and stage at diagnosis.",
    cites: ["[SEER Data](https://seer.cancer.gov/statfacts/)"]
  },
  {
    id: "ONCOLOGY-SIDE-EFFECTS-003",
    ta: "Oncology",
    topic: "Side Effects Management",
    text: "Manage side effects through supportive care and dose adjustments as needed.",
    cites: ["[NCCN Guidelines](https://www.nccn.org/guidelines/category_1)"]
  },
  {
    id: "CARDIOVASCULAR-RISK-001",
    ta: "Cardiovascular",
    topic: "Risk Factors",
    text: "Key risk factors include hypertension, hyperlipidemia, diabetes, and smoking.",
    cites: ["[AHA Risk Factors](https://www.heart.org/en/health-topics/heart-attack/understand-your-risks-to-prevent-a-heart-attack)"]
  },
  {
    id: "CARDIOVASCULAR-STATINS-002",
    ta: "Cardiovascular",
    topic: "Statins",
    text: "Statins reduce LDL cholesterol and cardiovascular events in high-risk patients.",
    cites: ["[ACC/AHA Guidelines](https://www.ahajournals.org/doi/10.1161/CIR.0000000000000625)"]
  },
  {
    id: "CARDIOVASCULAR-MONITORING-003",
    ta: "Cardiovascular",
    topic: "Monitoring",
    text: "Regular monitoring of lipid profiles and liver function is essential during statin therapy.",
    cites: ["[FDA Statin Label](https://www.fda.gov/drugs/postmarket-drug-safety-information-patients-and-providers/statins-information)"]
  },
  {
    id: "VACCINES-EFFICACY-001",
    ta: "Vaccines",
    topic: "Efficacy",
    text: "Vaccines provide immunity by stimulating the production of antibodies against specific pathogens.",
    cites: ["[CDC Vaccines](https://www.cdc.gov/vaccines/vac-gen/howvax.htm)"]
  },
  {
    id: "VACCINES-SCHEDULE-002",
    ta: "Vaccines",
    topic: "Schedule",
    text: "Vaccination schedules are designed to provide optimal protection at different life stages.",
    cites: ["[CDC Schedule](https://www.cdc.gov/vaccines/schedules/index.html)"]
  },
  {
    id: "VACCINES-SAFETY-003",
    ta: "Vaccines",
    topic: "Safety",
    text: "Vaccines undergo rigorous safety testing and monitoring for adverse events.",
    cites: ["[VAERS](https://vaers.hhs.gov/)"]
  },
  {
    id: "COVID-VACCINES-001",
    ta: "COVID-19",
    topic: "mRNA Vaccines",
    text: "mRNA vaccines instruct cells to produce a harmless spike protein to trigger immune response.",
    cites: ["[CDC mRNA](https://www.cdc.gov/coronavirus/2019-ncov/vaccines/facts.html)"]
  },
  {
    id: "COVID-TREATMENT-002",
    ta: "COVID-19",
    topic: "Antiviral Treatments",
    text: "Antiviral treatments can reduce severity and hospitalization in high-risk patients.",
    cites: ["[NIH COVID](https://www.covid19treatmentguidelines.nih.gov/)"]
  },
  {
    id: "COVID-PREVENTION-003",
    ta: "COVID-19",
    topic: "Prevention",
    text: "Prevention strategies include vaccination, masking, and social distancing.",
    cites: ["[CDC Prevention](https://www.cdc.gov/coronavirus/2019-ncov/prevent-getting-sick/prevention.html)"]
  },
  {
    id: "COVID-VARIANTS-004",
    ta: "COVID-19",
    topic: "Variants",
    text: "Variants may affect vaccine efficacy and require updated prevention measures.",
    cites: ["[WHO Variants](https://www.who.int/activities/tracking-SARS-CoV-2-variants)"]
  }
];

// Finite State Machines per mode (5 modes total)
// CAPS INCREASED TO PREVENT CUTOFF - Sales Sim needs room for 4-section format
const FSM = {
  "sales-coach": {
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
 * IMPLEMENTATION NOTES:
 * - CORS_ORIGINS is a comma-separated list of allowed origins (production + localhost for dev)
 * - When an origin is in the allowlist, we echo it back exactly in Access-Control-Allow-Origin
 * - When no CORS_ORIGINS is set, we allow any origin (permissive mode)
 * - When an origin is denied, we return "null" to explicitly block the request
 *
 * ALLOWED ORIGINS (from CORS_ORIGINS env var):
 * Production:
 *   - https://reflectivei.github.io (GitHub Pages main)
 *   - https://reflectivei.github.io/reflectiv-ai (GitHub Pages with path)
 *   - https://reflectivai.github.io
 *   - https://tonyabdelmalak.github.io
 *   - https://tonyabdelmalak.com
 *   - https://reflectivai.com
 *   - https://www.reflectivai.com
 *   - https://www.tonyabdelmalak.com
 *   - https://dash.cloudflare.com
 *   - https://my-chat-agent-v2.tonyabdelmalak.workers.dev
 * Development (localhost):
 *   - http://localhost:3000
 *   - http://127.0.0.1:3000
 *   - http://localhost:5500
 *   - http://127.0.0.1:5500
 *   - http://localhost:8080
 *   - http://127.0.0.1:8080
 *
 * BROWSER CORS FLOW:
 * 1. Browser sends OPTIONS preflight with Origin header
 * 2. Worker responds with Access-Control-Allow-Origin: <exact origin> (if allowed)
 * 3. Browser sends actual request (POST/GET) with Origin header
 * 4. Worker responds with same CORS headers
 */
function cors(env, req) {
  const reqOrigin = req.headers.get("Origin") || "";
  const allowed = String(env.CORS_ORIGINS || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);

  // Determine if the requesting origin is allowed
  // If no allowlist is configured (allowed.length === 0), allow any origin
  // If allowlist exists, check if request origin is in the list
  const isAllowed = allowed.length === 0 || allowed.includes(reqOrigin);

  // Enhanced logging for CORS diagnostics
  if (!isAllowed && reqOrigin) {
    const LOG_LIMIT = 5; // Limit logged origins to avoid spam in logs
    console.warn("CORS_DENY", {
      origin: reqOrigin,
      allowedCount: allowed.length,
      allowedList: allowed.slice(0, LOG_LIMIT), // First 5 origins only
      hasAllowlist: allowed.length > 0
    });
  }

  // Determine the Access-Control-Allow-Origin value
  let allowOrigin;
  if (isAllowed && reqOrigin) {
    // Specific origin is allowed and present - echo it back exactly
    allowOrigin = reqOrigin;
  } else if (isAllowed && !reqOrigin) {
    // Allowed but no origin header (e.g., same-origin request, cURL, Postman)
    allowOrigin = "*";
  } else {
    // Origin not allowed - return "null" to explicitly block
    allowOrigin = "null";
  }

  // Build CORS headers
  const headers = {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "content-type,authorization,x-req-id",
    "Access-Control-Max-Age": "86400",  // Cache preflight for 24 hours
    "Vary": "Origin"  // Important for caching - response varies by Origin header
  };

  // Set credentials header only for specific origins
  // Cannot use Access-Control-Allow-Credentials: true with wildcard (*)
  // Cannot use credentials with "null" origin (blocked)
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
  
  // CRITICAL FIX: Deduplicate keys to ensure even distribution
  // Use Set to remove duplicates, then convert back to array
  const uniquePool = [...new Set(pool.filter(Boolean))];
  
  // Log warning if duplicates were found
  if (pool.length !== uniquePool.length) {
    console.warn("key_pool_deduplication", {
      original_count: pool.length,
      unique_count: uniquePool.length,
      duplicates_removed: pool.length - uniquePool.length
    });
  }
  
  return uniquePool;
}

// Round-robin counter for provider key rotation
// Using globalThis to persist across requests within the same worker instance
if (typeof globalThis._keyRotationIndex === 'undefined') {
  globalThis._keyRotationIndex = 0;
}

// Track key usage for monitoring (resets per worker instance)
if (typeof globalThis._keyUsageStats === 'undefined') {
  globalThis._keyUsageStats = {};
}

function selectProviderKey(env, session, excludeKeys = []) {
  const pool = getProviderKeyPool(env);
  if (!pool.length) return null;
  
  // Filter out excluded keys (e.g., rate-limited keys)
  const availablePool = pool.filter(key => !excludeKeys.includes(key));
  if (!availablePool.length) {
    // All keys excluded, fall back to full pool (better to try than fail)
    console.warn("All provider keys excluded, falling back to full pool");
    return pool[0];
  }
  
  // ROUND-ROBIN ROTATION: Select next key in sequence
  // This ensures even distribution across all keys
  const idx = globalThis._keyRotationIndex % availablePool.length;
  globalThis._keyRotationIndex = (globalThis._keyRotationIndex + 1) % 1000000; // Reset after 1M to prevent overflow
  
  const selectedKey = availablePool[idx];
  
  // Track usage statistics
  const keyId = selectedKey.substring(0, 7) + "..." + selectedKey.substring(selectedKey.length - 4);
  if (!globalThis._keyUsageStats[keyId]) {
    globalThis._keyUsageStats[keyId] = 0;
  }
  globalThis._keyUsageStats[keyId]++;
  
  // Log every 100th request to monitor distribution
  if (globalThis._keyRotationIndex % 100 === 0) {
    console.log({
      event: "key_usage_stats",
      rotation_count: globalThis._keyRotationIndex,
      stats: globalThis._keyUsageStats,
      pool_size: availablePool.length
    });
  }
  
  if (env.DEBUG_MODE === "true") {
    console.log({
      event: "round_robin_select",
      index: idx,
      pool_size: availablePool.length,
      excluded_count: excludeKeys.length,
      key_id: keyId,
      usage_count: globalThis._keyUsageStats[keyId]
    });
  }
  
  return selectedKey;
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
  
  // ENHANCED ERROR HANDLING: Log provider request details for debugging
  const providerUrl = env.PROVIDER_URL;
  const providerModel = env.PROVIDER_MODEL;
  
  // Get key pool for failover
  const keyPool = getProviderKeyPool(env);
  const excludedKeys = [];
  
  // Try keys with automatic failover on rate limits
  for (let keyAttempt = 0; keyAttempt < Math.min(keyPool.length, 3); keyAttempt++) {
    let key;
    if (providerKey) {
      // Explicit key provided (used for health checks)
      key = providerKey;
    } else {
      // Select key from pool, excluding previously failed keys
      key = selectProviderKey(env, session, excludedKeys);
    }
    
    if (!key) {
      throw new Error("provider_key_missing");
    }
    
    if (env.DEBUG_MODE === "true") {
      console.log({ 
        event: "provider_key_select", 
        session, 
        key_len: key.length, 
        key_prefix: key.substring(0, 8) + "...",
        attempt: keyAttempt + 1,
        excluded_count: excludedKeys.length
      });
    }
    
    try {
      // FIX: Add timeout to prevent worker from hanging on slow provider responses
      // Cloudflare Workers have a 30-50 second execution limit
      // Set provider timeout to 25 seconds to leave room for retries and error handling
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), TIMEOUT_PROVIDER_CHAT);
      
      try {
        const r = await fetch(providerUrl, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "authorization": `Bearer ${key}`
          },
          body: JSON.stringify({
            model: providerModel,
            temperature,
            max_tokens: finalMax,
            messages
          }),
          signal: controller.signal
        });
        
        if (!r.ok) {
          const errText = await r.text();
          // Parse error response if it's JSON
          let errorDetails = errText;
          try {
            const errorJson = JSON.parse(errText);
            errorDetails = errorJson.error?.message || errorJson.message || errText;
          } catch (e) {
            // Not JSON, use raw text
          }
          
          // Enhanced error logging with more context
          console.error("provider_fetch_error", {
            status: r.status,
            statusText: r.statusText,
            provider_url: providerUrl,
            provider_model: providerModel,
            error_details: errorDetails,
            has_key: !!key,
            key_prefix: key ? key.substring(0, 8) + "..." : "none",
            session,
            attempt: keyAttempt + 1
          });
          
          // RATE LIMIT FAILOVER: If this key is rate-limited, try another one
          if (r.status === 429 && keyAttempt < Math.min(keyPool.length, 3) - 1) {
            console.warn("provider_rate_limited_failover", {
              key_prefix: key ? key.substring(0, 8) + "..." : "none",
              attempt: keyAttempt + 1,
              next_attempt: keyAttempt + 2
            });
            excludedKeys.push(key);
            continue; // Try next key
          }
          
          // Throw error with both status and details
          const err = new Error(`provider_http_${r.status}`);
          err.providerStatus = r.status;
          err.providerError = errorDetails;
          throw err;
        }
        
        const j = await r.json();
        return j?.choices?.[0]?.message?.content || j?.content || "";
      } finally {
        clearTimeout(timeout);
      }
    } catch (e) {
      // Handle timeout errors specifically
      if (e.name === 'AbortError') {
        console.error("provider_timeout", {
          provider_url: providerUrl,
          session,
          attempt: keyAttempt + 1,
          timeout_ms: TIMEOUT_PROVIDER_CHAT
        });
        // Use specific error type for timeouts to distinguish from other network issues
        const err = new Error("provider_timeout_error");
        err.originalError = `Request timeout after ${TIMEOUT_PROVIDER_CHAT / 1000} seconds`;
        throw err;
      }
      
      // NETWORK ERROR HANDLING: Catch fetch failures (network errors, timeouts, etc.)
      if (e.providerStatus) {
        // Already a provider HTTP error, re-throw if not retryable
        if (e.providerStatus !== 429 || keyAttempt >= Math.min(keyPool.length, 3) - 1) {
          throw e;
        }
        // Rate limit - try next key
        excludedKeys.push(key);
        continue;
      }
      // Network or other fetch error
      console.error("provider_network_error", {
        message: e.message,
        provider_url: providerUrl,
        session,
        attempt: keyAttempt + 1
      });
      const err = new Error("provider_network_error");
      err.originalError = e.message;
      throw err;
    }
  }
  
  // If we get here, all keys were rate-limited
  const err = new Error("provider_http_429");
  err.providerStatus = 429;
  err.providerError = "All provider keys are rate-limited";
  throw err;
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
    const { mode = "sales-coach", disease = "", persona = "", goal = "", topic = "" } = body || {};

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
      fsm: FSM[mode] || FSM["sales-coach"]
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
 * @param {string} mode - Current mode (sales-coach, role-play, emotional-assessment, product-knowledge)
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
  if (mode === "sales-coach") {
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
    "sales-coach": ["scores", "worked", "improve", "feedback"],
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

    // FIX: Add timeout to Alora requests (shorter timeout for site assistant)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_ALORA_CHAT);

    try {
      const providerResp = await fetch(env.PROVIDER_URL || "https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${key}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      if (!providerResp.ok) {
        const errText = await providerResp.text();
        console.error("alora_provider_error", { status: providerResp.status, error: errText });
        throw new Error(`Provider error: ${providerResp.status}`);
      }

      const data = await providerResp.json();
      const reply = data.choices?.[0]?.message?.content || "I'm having trouble responding right now. Please try again or contact our team.";

      return json({ reply: reply.trim() }, 200, env, req);
    } finally {
      clearTimeout(timeout);
    }
  } catch (e) {
    // Handle timeout errors
    if (e.name === 'AbortError') {
      console.error("alora_timeout", { timeout_ms: TIMEOUT_ALORA_CHAT });
      return json({
        error: "alora_timeout",
        message: "Request timeout",
        reply: "I'm taking a bit longer than usual. Please try again or request a demo to speak with our team."
      }, 500, env, req);
    }
    
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
    // Defensive check: ensure provider is properly configured
    const keyPool = getProviderKeyPool(env);
    if (!keyPool.length) {
      console.error("chat_error", { step: "config_check", message: "NO_PROVIDER_KEYS" });
      return json({ error: "server_error", message: "No provider API keys configured" }, 500, env, req);
    }
    
    // Validate PROVIDER_URL and PROVIDER_MODEL are configured
    if (!env.PROVIDER_URL) {
      console.error("chat_error", { step: "config_check", message: "NO_PROVIDER_URL" });
      return json({ error: "server_error", message: "Provider URL not configured" }, 500, env, req);
    }
    if (!env.PROVIDER_MODEL) {
      console.error("chat_error", { step: "config_check", message: "NO_PROVIDER_MODEL" });
      return json({ error: "server_error", message: "Provider model not configured" }, 500, env, req);
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

      mode = body.mode || "sales-coach";
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
      mode = body.mode || "sales-coach";
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
        error: "bad_request",
        message: "User message cannot be empty or whitespace only"
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
          fsm: FSM[mode] || FSM["sales-coach"]
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
    const factsStr = activePlan.facts.map((f, idx) => `- [FACT-${idx + 1}] ${f.text}`).join("\n");
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
• [BULLET 1: Specific clinical discussion point with full context - Include "as recommended..." or "as indicated..." phrasing - 20-35 words - MUST include reference code [FACT-1]]
• [BULLET 2: Supporting strategy with rationale - Include contextual phrases like "for treatment" or "in the FDA label" - 20-35 words - MUST include reference code [FACT-2]]
• [BULLET 3: Safety/monitoring consideration with clinical detail - Include phrases like "to ensure..." or "per the FDA label" - 20-35 words - MUST include reference code [FACT-3]]
[EXACTLY 3 BULLETS - NO MORE, NO LESS - Use • or 1. 2. 3. or - format]

Impact: [ONE SENTENCE describing expected outcome - 20-35 words - Connect back to Challenge]

Suggested Phrasing: "[EXACT words rep should say - Conversational, professional tone - 25-40 words total - Include key clinical points]"

CRITICAL FORMATTING REQUIREMENTS:
- EACH SECTION MUST BE SEPARATED BY A BLANK LINE (\\n\\n)
- Format: Challenge: [text]\\n\\nRep Approach:\\n[bullets]\\n\\nImpact: [text]\\n\\nSuggested Phrasing: [text]
- DO NOT collapse sections together without blank lines
- Blank lines ensure readability and proper parsing

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
Challenge: The HCP may not be prioritizing prescriptions due to lack of awareness about the substantial risk in certain patient populations.

Rep Approach:
• Discuss the importance of assessing risk factors to identify individuals at substantial risk, as recommended for eligibility [FACT-1].
• Highlight the efficacy and safety profile of the therapy, as indicated in the FDA label [FACT-2].
• Emphasize the need for function assessment before and during treatment, considering thresholds per the FDA label, to ensure safe prescribing practices [FACT-3].

Impact: By emphasizing the importance of risk assessment, the benefits of the therapy, and the need for monitoring, the HCP will be more likely to prioritize prescriptions for at-risk patients and commit to proactive prescribing.

Suggested Phrasing: "Given the substantial risk in certain patient populations, I recommend we discuss how to identify and assess these individuals for eligibility, and consider this therapy as a safe and effective option."

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
      disease ? `Disease: ${disease}` : '',
      persona ? `Persona: ${persona}` : '',
      goal ? `Goal: ${goal}` : '',
      `Facts:\n${factsStr}\nReferences:\n${citesStr}`,
      ``,
      `CRITICAL: References are provided in markdown format [Name](URL). When you cite sources, preserve them as clickable hyperlinks. Do NOT convert to plain text.`,
      ``,
      salesContract
    ].filter(Boolean).join("\n");

    const rolePlayPrompt = [
      `You are the HCP in Role Play mode. Speak ONLY as the HCP in first person.`,
      ``,
      disease ? `Disease: ${disease}` : '',
      persona ? `Persona: ${persona}` : '',
      goal ? `Goal: ${goal}` : '',
      `Facts:\n${factsStr}\nReferences:\n${citesStr}`,
      ``,
      `CRITICAL: If you reference clinical studies or sources, use markdown hyperlink format [Name](URL). Never output plain text URLs.`,
      ``,
      `HCP BEHAVIOR:`,
      `- Respond naturally as this HCP would in a real clinical setting`,
      `- Use 1-4 sentences in conversational paragraphs`,
      `- Reflect time pressure, priorities, and decision style from persona`,
      `- Stay professional and realistic`,
      ``,
      `CRITICAL RULES:`,
      `- NO coaching language ("You should have...", "The rep...")`,
      `- NO evaluation or scores  `,
      `- NO "Suggested Phrasing:" or "Rep Approach:" meta-commentary`,
      `- STAY IN CHARACTER as HCP throughout entire conversation`,
      `- NO bullet points or lists - keep responses natural and flowing`,
      `- DO NOT output any <coach> tags, JSON metadata, or evaluation blocks`,
      ``,
      `EXAMPLE HCP RESPONSES:`,
      `"From my perspective, we evaluate high-risk patients using history, behaviors, and adherence context."`,
      `"I prioritize regular follow-up appointments to assess treatment efficacy and detect any potential issues early. I also encourage patients to report any changes in symptoms or side effects promptly. Additionally, I consider using digital tools to enhance patient engagement and monitoring."`,
      `"I appreciate your emphasis on timely interventions and proactive prescribing."`,
      `"I've got a few minutes, what's on your mind?"`,
      ``,
      `Remember: You are the HCP. Natural, brief, clinical voice only - no bullets or structured lists.`
    ].filter(Boolean).join("\n");

    const eiPrompt = [
      `You are Reflectiv Coach in Emotional Intelligence mode.`,
      ``,
      persona ? `HCP Type: ${persona}` : '',
      disease ? `Disease context: ${disease}` : '',
      ``,
      `CRITICAL: When referencing sources or studies, use markdown hyperlink format [Name](URL). Never output plain text URLs.`,
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
    ].filter(Boolean).join("\n");

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
      `CRITICAL MARKDOWN FORMATTING:`,
      `- ALWAYS preserve markdown hyperlinks in the format [Link Text](URL)`,
      `- When referencing sources from the References section, use the EXACT markdown format provided`,
      `- Example: [CDC PrEP Guidelines](https://www.cdc.gov/hiv/pdf/risk/prep/cdc-hiv-prep-guidelines-2021.pdf)`,
      `- DO NOT convert hyperlinks to plain text - keep them as clickable markdown links`,
      `- If you include a references section at the end, format each reference as a markdown hyperlink`,
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
      `CRITICAL: When references are provided above in markdown format like [Name](URL), you MUST preserve them as clickable hyperlinks in your response. Do NOT convert them to plain text.`,
      ``,
      `COMPLIANCE & QUALITY STANDARDS:`,
      `- Distinguish clearly between on-label and off-label information`,
      `- Present risks, contraindications, and safety considerations alongside benefits`,
      `- Recommend consulting official sources (FDA labels, guidelines) for prescribing decisions`,
      `- MANDATORY: Use [numbered citations] like [1], [2], [3] for ALL clinical claims when references are available`,
      `- Citation format: Use ONLY [1], [2], [3] etc. - no other formats like [1a], [REF-] or invalid patterns`,
      `- If asked about something outside your knowledge, acknowledge limitations`,
      ``,
      `CITATION REQUIREMENTS (CRITICAL):`,
      `- For product knowledge questions about therapies, efficacy, or clinical data: ALWAYS include at least one citation`,
      `- Valid formats: [1], [2], [3], [HIV-PREP-001], etc.`,
      `- Invalid formats: [REF-], [1a], [citation 1], etc.`,
      `- Place citations immediately after the relevant claim`,
      `- If references are provided in context, you MUST use them`,
      `- When including a references list at the end of your response, format each as: [1] [Reference Name](URL)`,
      `- NEVER output references as plain text URLs - ALWAYS use markdown hyperlink format [Text](URL)`,
      ``,
      `EXAMPLE INTERACTIONS:`,
      ``,
      `Q: "What are the 5 key facts I need to know about this disease state?"`,
      `A: Here are 5 essential points about [disease]:`,
      `1. **Epidemiology:** [prevalence, key populations affected] [1]`,
      `2. **Pathophysiology:** [disease mechanism, biological basis] [2]`,
      `3. **Clinical Presentation:** [symptoms, diagnostic criteria] [1]`,
      `4. **Current Standard of Care:** [first-line treatments, guidelines] [3]`,
      `5. **Emerging Approaches:** [new therapies, ongoing research] [2]`,
      ``,
      `Q: "How should I approach a busy PCP about this therapy?"`,
      `A: When engaging busy PCPs, focus on:`,
      `- **Time efficiency:** Lead with the single most relevant data point [1]`,
      `- **Practice relevance:** Connect to their patient population and workflow`,
      `- **Evidence:** Brief reference to key trial or guideline [2]`,
      `- **Action:** One clear next step (trial offer, patient identification, etc.)`,
      ``,
      `PCPs appreciate concise, practice-applicable information that respects their time constraints while addressing real clinical needs.`,
      ``,
      `Q: "What is the clinical benefit of this therapy?"`,
      `A: The therapy demonstrates [specific clinical benefit] in [patient population] [1]. Clinical trials have shown [outcome data] [2], making it an important option for [indication] [3].`,
      ``,
      `References:`,
      `[1] [CDC PrEP Guidelines](https://www.cdc.gov/hiv/pdf/risk/prep/cdc-hiv-prep-guidelines-2021.pdf)`,
      `[2] [Descovy PI](https://www.gilead.com/-/media/files/pdfs/medicines/hiv/descovy/descovy_pi.pdf)`,
      `[3] [NCI Targeted Therapies](https://www.cancer.gov/about-cancer/treatment/types/targeted-therapies)`,
      ``,
      `Q: "Tell me about the efficacy data"`,
      `A: The efficacy data shows [primary endpoint results] in the pivotal trials [1]. Key findings include [secondary endpoints] [2], with a favorable safety profile [3].`,
      ``,
      `References:`,
      `[1] [NEJM Study](https://www.nejm.org/doi/full/10.1056/example)`,
      `[2] [FDA Label](https://www.fda.gov/drugs/example)`,
      `[3] [Clinical Trial Results](https://clinicaltrials.gov/example)`,
      ``,
      `Q: "Explain the mechanism of action"`,
      `A: The mechanism of action involves [detailed MOA explanation] [1], which translates to [therapeutic benefit] in clinical practice [2].`,
      ``,
      `References:`,
      `[1] [Drug Mechanism Study](https://www.journalurl.com/article)`,
      `[2] [Clinical Pharmacology Review](https://www.fda.gov/review)`,
      ``,
      `RESPONSE LENGTH:`,
      `- Short questions: 100-200 words`,
      `- Standard questions: 200-400 words`,
      `- Complex topics: 300-600 words`,
      `- Very complex or multi-part questions: up to 800 words`,
      `- Always prioritize clarity over brevity`,
      ``,
      `YOUR GOAL: Be the most helpful, knowledgeable, and trustworthy AI thought partner possible.`
    ].join("\n");

    const generalKnowledgePrompt = [
      `You are ReflectivAI General Assistant - a helpful, knowledgeable AI that can discuss ANY topic.`,
      ``,
      `CRITICAL MARKDOWN FORMATTING:`,
      `- When citing sources, studies, or articles, ALWAYS use markdown hyperlink format: [Source Name](URL)`,
      `- NEVER output plain text URLs like "https://example.com" - always wrap them: [Example](https://example.com)`,
      `- This ensures all references are clickable hyperlinks for the user`,
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
      `- Very complex topics: up to 900 words`,
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
      `Q: "What are the latest findings on climate change?"`,
      `A: Recent climate research shows accelerating impacts across multiple domains. According to the [IPCC Sixth Assessment Report](https://www.ipcc.ch/assessment-report/ar6/), global temperatures have risen 1.1°C above pre-industrial levels, with significant consequences.`,
      ``,
      `Key findings include:`,
      `- More frequent extreme weather events [NASA Climate Data](https://climate.nasa.gov/)`,
      `- Accelerating ice sheet loss and sea level rise [NOAA Sea Level Report](https://www.noaa.gov/sea-level-rise)`,
      `- Ocean acidification affecting marine ecosystems`,
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
    } else if (mode === "sales-coach") {
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
    let lastProviderError = null;
    for (let i = 0; i < 3; i++) {
      try {
        // Token allocation prioritization
        let maxTokens;
        if (mode === "sales-coach") {
          maxTokens = 1600; // Reduced from 1700 to prevent timeout issues
        } else if (mode === "role-play") {
          maxTokens = 1500; // Higher for natural conversation flow
        } else if (mode === "emotional-assessment") {
          maxTokens = 1100; // Comprehensive EI coaching with reflective questions
        } else if (mode === "product-knowledge") {
          maxTokens = 1600; // Reduced from 1700 to prevent timeout issues
        } else if (mode === "general-knowledge") {
          maxTokens = 1600; // Reduced from 1700 to prevent timeout issues
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
        lastProviderError = e;
        console.error("chat_error", { 
          step: "provider_call", 
          attempt: i + 1, 
          message: e.message,
          provider_status: e.providerStatus,
          provider_error: e.providerError,
          original_error: e.originalError
        });
        if (i === 2) throw e;
        await new Promise(r => setTimeout(r, 300 * (i + 1)));
      }
    }

    // ERROR HANDLING: Check for empty response after all retry attempts
    // Provider may return empty string if model has no response or encounters an error
    // Use explicit null check (==) to catch both null and undefined
    if (raw == null || String(raw).trim() === "") {
      // Log diagnostic information for troubleshooting
      console.error("provider_empty_completion", {
        provider_url: env.PROVIDER_URL,
        provider_model: env.PROVIDER_MODEL,
        has_provider_keys: !!env.PROVIDER_KEYS,
        has_provider_key: !!env.PROVIDER_KEY,
        mode,
        session
      });
      
      // Return 502 Bad Gateway with user-friendly error message
      return json({
        error: "provider_empty_completion",
        message: "The language model or provider did not return a response. Please check API credentials and provider health."
      }, 502, env, req);
    }

    // VALIDATION: Sales Coach mode requires specific format (Challenge, Rep Approach, Impact, Phrasing)
    if (mode === "sales-coach") {
      const validation = validateSalesCoachContract(raw);
      if (!validation.ok) {
        console.log("Sales Coach contract validation failed, injecting placeholders", validation.missing);
        raw = fixSalesCoachContract(raw, validation);
      }
    }

    // EXTRACTION: Separate coaching metadata from user-facing reply
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
      // Remove coaching labels and strip bullets for natural conversation
      reply = reply
        .replace(/^[\s]*Suggested Phrasing:\s*/gmi, '')  // Remove "Suggested Phrasing:" labels
        .replace(/^[\s]*Coach Guidance:\s*/gmi, '')      // Remove any leaked coach headings
        .replace(/^[\s]*Challenge:\s*/gmi, '')
        .replace(/^[\s]*Rep Approach:\s*/gmi, '')
        .replace(/^[\s]*Impact:\s*/gmi, '')
        .replace(/^[\s]*Next-Move Planner:\s*/gmi, '')
        .replace(/^[\s]*Risk Flags:\s*/gmi, '')
        .replace(/^\s*[-*•]\s+/gm, '')  // Strip bullet points for natural speech
        .trim();
    }

    // Post-processing: Normalize headings and ENFORCE FORMAT for sales-coach mode
    if (mode === "sales-coach") {
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
    if (mode === "sales-coach") {
      reply = reply
        .replace(/\r\n/g, "\n")
        .replace(/\s*Challenge:/gi, "\n\nChallenge:")
        .replace(/\s*Rep Approach:/gi, "\n\nRep Approach:")
        .replace(/\s*Impact:/gi, "\n\nImpact:")
        .replace(/\s*Suggested Phrasing:/gi, "\n\nSuggested Phrasing:");
      reply = reply.replace(/\n{3,}/g, "\n\n").trim();

      // DEDUPLICATION FIX: Remove duplicate content within sections
      // Remove consecutive duplicate sentences in Suggested Phrasing
      const phrasingMatch = reply.match(/Suggested Phrasing:(.*?)$/s);
      if (phrasingMatch) {
        let phrasing = phrasingMatch[1].trim();
        // Split into sentences and remove duplicates
        const sentences = phrasing.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 0);
        const uniqueSentences = [];
        const seen = new Set();
        for (const sentence of sentences) {
          if (!seen.has(sentence.toLowerCase())) {
            seen.add(sentence.toLowerCase());
            uniqueSentences.push(sentence);
          }
        }
        const dedupedPhrasing = uniqueSentences.join('. ') + (uniqueSentences.length > 0 ? '.' : '');
        reply = reply.replace(/Suggested Phrasing:.*?$/s, `Suggested Phrasing: ${dedupedPhrasing}`);
      }
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
    const fsm = FSM[mode] || FSM["sales-coach"];
    const cap = fsm?.states?.[fsm?.start]?.capSentences || 5;
    reply = capSentences(reply, cap);

    // Loop guard vs last reply
    const state = await seqGet(env, session);
    const candNorm = norm(reply);
    if (state && candNorm && (candNorm === state.lastNorm)) {
      if (mode === "role-play") {
        reply = "In my clinic, we review history, adherence, and recent exposures before deciding. Follow-up timing guides next steps.";
      } else {
        reply = "Anchor to eligibility, one safety check, and end with a single discovery question about patient selection. Suggested Phrasing: 'For patients with consistent risk, would confirming eGFR today help you start one eligible person this month?'";
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

    // SUCCESS: Return response with reply, coaching data, and plan
    // DEBUG_BREAKPOINT: worker.chat.response
    return json({ reply, coach: coachObj, plan: { id: planId || activePlan.planId } }, 200, env, req);
  } catch (e) {
    // ERROR HANDLING: Catch-all for unexpected errors during chat processing
    console.error("chat_error", { 
      step: "general", 
      message: e.message, 
      stack: e.stack,
      provider_status: e.providerStatus,
      provider_error: e.providerError,
      original_error: e.originalError
    });

    // Classify error to return appropriate status code and message
    const isProviderError = e.message && (
      e.message.startsWith("provider_http_") ||  // Provider returned HTTP error (500, 503, etc.)
      e.message === "provider_network_error" ||  // Network error calling provider
      e.message === "provider_timeout_error" ||  // Timeout calling provider
      e.message === "provider_key_missing" ||    // No API key configured
      e.message === "plan_generation_failed"      // Plan generation failed
    );
    const isPlanError = e.message === "no_active_plan_or_facts";

    if (isProviderError) {
      // ERROR HANDLING: Provider errors - return 502 Bad Gateway with helpful diagnostics
      let errorMessage = "The AI provider is temporarily unavailable. Please try again in a moment.";
      
      // Provide more specific error messages based on the error type
      if (e.message === "provider_timeout_error") {
        errorMessage = "The AI provider request timed out. Please try again with a shorter message or simpler request.";
      } else if (e.message === "provider_key_missing") {
        errorMessage = "No AI provider API keys configured.";
      } else if (e.message === "plan_generation_failed") {
        errorMessage = "Failed to generate conversation plan.";
      }
      
      return json({
        error: "provider_error",
        message: errorMessage
      }, 502, env, req);
    } else if (isPlanError) {
      return json({
        error: "plan_error",
        message: "No valid conversation plan or facts available."
      }, 400, env, req);
    } else {
      // Generic server error
      return json({
        error: "server_error",
        message: "An unexpected error occurred. Please try again."
      }, 500, env, req);
    }
  }
}

/* ------------------------------ Coach Metrics -------------------------------- */
async function postCoachMetrics(req, env) {
  try {
    const body = await readJson(req);
    const { mode, reply, coach } = body || {};

    // Basic validation
    if (!mode || !reply) {
      return json({ error: "bad_request", message: "Mode and reply are required" }, 400, env, req);
    }

    // For now, just return success - metrics processing can be added later
    return json({ success: true, message: "Metrics recorded" }, 200, env, req);
  } catch (e) {
    console.error("postCoachMetrics error:", e);
    return json({ error: "server_error", message: "Failed to process metrics" }, 500, env, req);
  }
}

// Rate limiting utility
function rateLimit(key, env) {
  // Simple in-memory rate limiting (resets on worker restart)
  // In production, use a proper rate limiting service like Upstash Rate Limit
  const now = Date.now();
  const windowMs = (env.RATELIMIT_WINDOW_MINUTES || 1) * 60 * 1000;
  const maxRequests = env.RATELIMIT_MAX_REQUESTS || 10;

  if (!globalThis.rateLimitStore) {
    globalThis.rateLimitStore = new Map();
  }

  const store = globalThis.rateLimitStore;
  const entry = store.get(key) || { count: 0, resetTime: now + windowMs };

  // Reset if window has passed
  if (now > entry.resetTime) {
    entry.count = 0;
    entry.resetTime = now + windowMs;
  }

  // Check if limit exceeded
  const ok = entry.count < maxRequests;
  if (ok) {
    entry.count++;
  }

  store.set(key, entry);

  return {
    ok,
    remaining: Math.max(0, maxRequests - entry.count),
    limit: maxRequests,
    resetTime: entry.resetTime
  };
}

// Utility to generate random IDs
function cryptoRandomId() {
  return crypto.getRandomValues(new Uint8Array(16)).reduce((a, b) => a + b.toString(16).padStart(2, '0'), '');
}
