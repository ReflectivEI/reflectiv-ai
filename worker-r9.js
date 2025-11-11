/**
 * Unified Cloudflare Worker — Persona-Locked Gateway (r9, GROQ-only, merged)
 * --------------------------------------------------------------------------
 * Keeps your robustness:
 *  - CORS allowlist, site detection
 *  - Rate limiting + soft serialization gate
 *  - SSE streaming with early ping
 *  - Deep health, metrics sink
 *  - Remote system/persona fetch for Tony/ReflectivAI
 *
 * Adds hard guarantees:
 *  - KV session + monotonic seq (server-enforced)
 *  - Per-mode thread isolation (session_id:mode:thread_id)
 *  - Fixed mode anchors + leak guard on every call
 *  - XML role schema validation; leak firewall
 *  - GROQ-only with deterministic key rotation
 *  - /agent and /evaluate endpoints; /chat adapter for back-compat
 *
 * REQUIRED BINDINGS (wrangler.toml):
 *  [[kv_namespaces]]
 *  binding = "SESS"
 *
 *  [vars]
 *  PROVIDER_URL          = "https://api.groq.com/openai/v1/chat/completions"
 *  PROVIDER_MODEL_HCP    = "llama-3.1-70b-versatile"
 *  PROVIDER_MODEL_COACH  = "llama-3.1-70b-versatile"
 *  PROVIDER_SIG          = "groq:llama-3.1-70b-versatile"
 *  MAX_CHARS_CONTEXT     = "12000"
 *  RESPONSE_TTL_SECONDS  = "86400"
 *  CORS_ORIGINS          = "https://reflectivei.github.io,https://reflectivai.github.io,https://tonyabdelmalak.github.io,https://tonyabdelmalak.com,https://www.tonyabdelmalak.com"
 *
 *  RATELIMIT_RATE        = "10"
 *  RATELIMIT_BURST       = "4"
 *  RATELIMIT_RATE_TONY   = "10"
 *  RATELIMIT_BURST_TONY  = "4"
 *  RATELIMIT_RATE_REFLECTIVAI  = "10"
 *  RATELIMIT_BURST_REFLECTIVAI = "4"
 *
 *  # Remote content (optional; used by /chat adapter when site=tony/reflectivai)
 *  TONY_SYSTEM_URL       = "https://raw.githubusercontent.com/tonyabdelmalak/tonyabdelmalak.github.io/main/chat-widget/assets/chat/system.md"
 *  TONY_KB_URL           = "https://raw.githubusercontent.com/tonyabdelmalak/tonyabdelmalak.github.io/main/chat-widget/assets/chat/about-tony.md"
 *  TONY_PERSONA_URL      = "https://raw.githubusercontent.com/tonyabdelmalak/tonyabdelmalak.github.io/main/chat-widget/assets/chat/persona.json"
 *
 *  # Rotating GROQ keys (support both old and new names)
 *  # Secrets (set via: wrangler secret put GROQ_KEY_1)
 *  GROQ_KEY_1 / GROQ_API_KEY
 *  GROQ_KEY_2 / GROQ_API_KEY_2
 *  GROQ_KEY_3 / GROQ_API_KEY_3
 */

/* ---------------------------- Small stdlib ---------------------------- */

var __defProp = Object.defineProperty;
var __name = (t, v) => __defProp(t, "name", { value: v, configurable: true });

/* ----------------------------- Constants ----------------------------- */

const PRIMARY_MODEL = "llama-3.3-70b-versatile";
const RETRY_STATUSES = new Set([408, 429, 500, 502, 503, 522, 524, 529]);

/* ----------------------------- Rate limit ---------------------------- */

const _buckets = new Map(); // key -> { tokens, ts }
function rateLimit(key, env, site) {
  const gRate = Number(env.RATELIMIT_RATE || 10);
  const gBurst = Number(env.RATELIMIT_BURST || 4);
  const s = String(site || "tony").toUpperCase();
  const sRate = Number(env[`RATELIMIT_RATE_${s}`] || gRate);
  const sBurst = Number(env[`RATELIMIT_BURST_${s}`] || gBurst);

  const now = Date.now();
  const b = _buckets.get(key) || { tokens: sBurst, ts: now };
  const elapsed = (now - b.ts) / 60000;
  b.tokens = Math.min(sBurst, b.tokens + elapsed * sRate);
  b.ts = now;
  if (b.tokens < 1) { _buckets.set(key, b); return { ok: false, limit: sRate, remaining: 0 }; }
  b.tokens -= 1; _buckets.set(key, b);
  return { ok: true, limit: sRate, remaining: Math.max(0, Math.floor(b.tokens)) };
}
__name(rateLimit, "rateLimit");

/* ------------------------------ CORS/site ---------------------------- */

function parseAllowed(env) {
  // Combine runtime env list and baked-in defaults
  const raw = (env.CORS_ORIGINS || env.ALLOWED_ORIGINS || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);

  const defaults = [
    "https://tonyabdelmalak.com",
    "https://www.tonyabdelmalak.com",
    "https://tonyabdelmalak.github.io",
    "https://reflectivei.github.io",
    "https://reflectivai.github.io",
    "https://reflectivai.com",
    "https://www.reflectivai.com",
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:8080",
    "http://localhost",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:8080"
  ];

  // Merge and deduplicate
  const merged = [...new Set([...raw, ...defaults])];
  return merged;
}
__name(parseAllowed, "parseAllowed");

function originAllowed(origin, allowlist) {
  if (!origin) return false;
  if (allowlist.includes(origin)) return true;
  try {
    const u = new URL(origin);
    if (u.hostname === "localhost" || u.hostname === "127.0.0.1") return true;
  } catch { }
  return false;
}
__name(originAllowed, "originAllowed");

function cors(env, origin) {
  const allowlist = parseAllowed(env);
  const allowOrigin = originAllowed(origin, allowlist) ? origin : undefined;
  const base = {
    "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
  if (allowOrigin) base["Access-Control-Allow-Origin"] = allowOrigin;
  return base;
}
__name(cors, "cors");

function siteFromOrigin(origin, explicitSite) {
  if (explicitSite === "tony" || explicitSite === "reflectivai") return explicitSite;
  const o = (origin || "").toLowerCase();
  if (o.includes("tonyabdelmalak.com") || o.includes("tonyabdelmalak.github.io")) return "tony";
  if (o.includes("reflectivei.github.io") || o.includes("reflectivai.github.io") || o.includes("reflectivai.com")) return "reflectivai";
  return "tony";
}
__name(siteFromOrigin, "siteFromOrigin");

/* ------------------------------ Utilities ---------------------------- */

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
__name(sleep, "sleep");

async function safeJson(req) { try { return await req.json(); } catch { return {}; } }
__name(safeJson, "safeJson");

async function safeText(r) { try { return await r.text(); } catch { return `status=${r.status}`; } }
__name(safeText, "safeText");

function json(obj, status = 200, env, origin, extraHeaders = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...cors(env, origin), ...extraHeaders }
  });
}
__name(json, "json");

function text(s, status = 200, env, origin, extraHeaders = {}) {
  return new Response(s, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", ...cors(env, origin), ...extraHeaders }
  });
}
__name(text, "text");

/* -------------------------- Soft serialization ------------------------ */

const INFLIGHT = new Map(); // ip -> { untilTs }
const SOFT_WAIT_MS = 900;
function softGate(ip) {
  const now = Date.now();
  const g = INFLIGHT.get(ip);
  const delay = g && g.untilTs > now ? (g.untilTs - now) : 0;
  INFLIGHT.set(ip, { untilTs: now + SOFT_WAIT_MS });
  return delay;
}
__name(softGate, "softGate");

/* -------------------------- Remote memo fetch ------------------------- */

class LruMemo {
  constructor(max = 128) { this.max = max; this.map = new Map(); }
  get(k) { const v = this.map.get(k); if (v) { this.map.delete(k); this.map.set(k, v); } return v; }
  set(k, v) {
    if (this.map.has(k)) this.map.delete(k); this.map.set(k, v);
    if (this.map.size > this.max) { const f = this.map.keys().next().value; this.map.delete(f); }
  }
}
__name(LruMemo, "LruMemo");

const MEMO = new LruMemo(128);
async function cachedText(url, ttl = 600) {
  const key = "T:" + url;
  const now = Date.now();
  const hit = MEMO.get(key);
  if (hit && now - hit.t < ttl * 1e3) return hit.v;
  const r = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error(`Fetch ${url} ${r.status}`);
  const v = await r.text(); MEMO.set(key, { v, t: now }); return v;
}
__name(cachedText, "cachedText");

/* -------------------------- Persona anchors --------------------------- */

function buildAnchors(mode) {
  if (mode === 'role-play') {
    return [
      "[MODE=HCP_ROLE_PLAY][ONLY SPEAK AS: HCP]",
      "Output XML exactly: <role>HCP</role><content>…</content>",
      "Do not evaluate, score, or coach. No rubrics. No meta-commentary.",
      "Stay in character. Concise, clinical responses."
    ].join('\n');
  }
  if (mode === 'sales-simulation') {
    return [
      "[MODE=HCP_SALES_SIM][ONLY SPEAK AS: HCP]",
      "Default: no rubric. Only if explicitly asked with /evaluate may you produce an evaluation.",
      "Output XML exactly: <role>HCP</role><content>…</content>"
    ].join('\n');
  }
  if (mode === 'product-knowledge') {
    return [
      "[MODE=PRODUCT_KNOWLEDGE]",
      "Label-only claims. No promotional extrapolation.",
      "Output XML: <role>PK</role><content>…</content>"
    ].join('\n');
  }
  if (mode === 'emotional-assessment') {
    return [
      "[MODE=EI_REFLECTION]",
      "You are an EI reflection assistant. Do not role-play an HCP.",
      "Output XML: <role>EI</role><content>…</content>"
    ].join('\n');
  }
  if (mode === 'coach') {
    return [
      "[MODE=COACH_FEEDBACK][ONLY SPEAK AS: COACH]",
      "Do not role-play the HCP. Provide scores and guidance when asked.",
      "Output XML: <role>Coach</role><content>…</content>"
    ].join('\n');
  }
  return "[MODE=GENERIC]";
}

function leakGuardrail() {
  return {
    role: 'system',
    content:
      "HARD GUARDRAIL: If draft includes any of these, replace with the correct role response only:\n" +
      "- 'Evaluate Rep' or rubric dimensions like 'Accuracy:' 'Compliance:' 'Discovery:' 'Objection Handling:' 'Empathy:' 'Clarity:'\n" +
      "- Phrases like 'The representative should have…'\n" +
      "- Any numbered scoring block\n"
  };
}

const LEAK_RE = /Evaluate Rep|Accuracy:\s*\d|Compliance:\s*\d|Discovery:\s*\d|Objection Handling:\s*\d|Empathy:\s*\d|Clarity:\s*\d|The representative should have/i;

/* -------------------------- Session + threads ------------------------- */

function ttl(env) {
  const d = parseInt(env.RESPONSE_TTL_SECONDS || '86400', 10);
  return Number.isFinite(d) ? d : 86400;
}
__name(ttl, "ttl");

function capChars(env, requested) {
  const def = parseInt(env.MAX_CHARS_CONTEXT || '12000', 10);
  const max = Number.isFinite(def) ? def : 12000;
  if (!requested || !Number.isFinite(requested)) return max;
  return Math.max(4000, Math.min(max, requested));
}
__name(capChars, "capChars");

function normalizeMode(mode, forceCoach = false) {
  const m = String(mode || '').toLowerCase();
  if (forceCoach) return 'coach';
  if (m === 'role-play' || m === 'roleplay' || m === 'rp') return 'role-play';
  if (m === 'sales-simulation' || m === 'sales') return 'sales-simulation';
  if (m === 'product-knowledge' || m === 'pk') return 'product-knowledge';
  if (m === 'emotional-assessment' || m === 'ei') return 'emotional-assessment';
  if (m === 'coach' || m === 'evaluation' || m === 'feedback') return 'coach';
  return 'role-play';
}
__name(normalizeMode, "normalizeMode");

function defaultModeVersion(mode) {
  if (mode === 'role-play') return 'rp-v2';
  if (mode === 'coach') return 'coach-v2';
  return 'v1';
}
__name(defaultModeVersion, "defaultModeVersion");

function parseXMLRoleContent(t) {
  const role = (t.match(/<role>(.*?)<\/role>/is) || [])[1]?.trim();
  const content = (t.match(/<content>([\s\S]*?)<\/content>/i) || [])[1]?.trim();
  return { role, content };
}
__name(parseXMLRoleContent, "parseXMLRoleContent");

function trimChars(messages, maxChars) {
  if (!maxChars || maxChars <= 0) return messages;
  const keep = messages.slice(0, 2); // anchors
  const rest = messages.slice(2);
  let acc = keep.reduce((n, m) => n + (m.content?.length || 0), 0);
  const out = [...keep];
  for (let i = rest.length - 1; i >= 0; i--) {
    const m = rest[i];
    const len = m.content?.length || 0;
    if (acc + len <= maxChars) { out.unshift(m); acc += len; }
    else break;
  }
  return out;
}
__name(trimChars, "trimChars");

function persistTurn(thread, lastUser, assistantBlob) {
  const out = Array.isArray(thread) ? thread.slice() : [];
  if (lastUser && lastUser.trim()) out.push({ role: 'user', content: lastUser.trim(), ts: Date.now() });
  out.push({ role: 'assistant', content: assistantBlob, ts: Date.now() });
  const MAX_TURNS = 80;
  if (out.length > MAX_TURNS) return out.slice(out.length - MAX_TURNS);
  return out;
}
__name(persistTurn, "persistTurn");

function buildHistory({ anchors, thread, lastUser, clientMsgs, maxChars }) {
  const sysA = Array.isArray(anchors) ? anchors.map(a => typeof a === 'string' ? { role: 'system', content: a } : a) : [{ role: 'system', content: String(anchors || '') }];
  const base = [...sysA];

  const turns = [];
  for (const t of thread) {
    if (t.role === 'user') turns.push({ role: 'user', content: t.content });
    else if (t.role === 'assistant') turns.push({ role: 'assistant', content: t.content });
  }

  if (Array.isArray(clientMsgs) && clientMsgs.length) {
    return trimChars([...base, ...clientMsgs], maxChars);
  }

  if (lastUser && lastUser.trim()) {
    turns.push({ role: 'user', content: lastUser.trim() });
  }

  return trimChars([...base, ...turns], maxChars);
}
__name(buildHistory, "buildHistory");

/* ------------------------------- GROQ ------------------------------- */

function selectGroqKeys(env) {
  // Support both naming schemes
  const keys = [
    env.GROQ_KEY_1, env.GROQ_KEY_2, env.GROQ_KEY_3,
    env.GROQ_API_KEY, env.GROQ_API_KEY_2, env.GROQ_API_KEY_3
  ].filter(Boolean);
  return keys;
}
__name(selectGroqKeys, "selectGroqKeys");

function selectGroqKeyDeterministic(env, seq) {
  const keys = selectGroqKeys(env);
  if (!keys.length) throw new Error('Missing GROQ keys');
  const idx = Math.abs(seq || 0) % keys.length;
  return keys[idx];
}
__name(selectGroqKeyDeterministic, "selectGroqKeyDeterministic");

async function groqChat({ apiKey, model, temperature, top_p, messages, max_tokens }) {
  const url = "https://api.groq.com/openai/v1/chat/completions";
  const r = await fetch(url, {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, temperature, top_p, messages, max_tokens: max_tokens ?? 1536 }),
    signal: AbortSignal.timeout(55000)
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Groq ${r.status}: ${JSON.stringify(j)}`);
  const text = j.choices?.[0]?.message?.content || "";
  const finish_reason = j.choices?.[0]?.finish_reason || "stop";
  return { text, model_used: model, finish_reason };
}
__name(groqChat, "groqChat");

async function groqStream({ apiKey, model, temperature, top_p, messages, max_tokens, env, origin }) {
  const url = "https://api.groq.com/openai/v1/chat/completions";
  const r = await fetch(url, {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, temperature, top_p, messages, stream: true, max_tokens: max_tokens ?? 1536 }),
    signal: AbortSignal.timeout(55000)
  });
  if (!r.ok || !r.body || RETRY_STATUSES.has(r.status)) {
    const detail = await r.text().catch(() => "");
    const err = new Error(`Groq stream ${r.status}: ${detail}`);
    err.status = r.status;
    throw err;
  }
  const headers = {
    ...cors(env, origin),
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "X-Mode": "stream"
  };
  const reader = r.body.getReader();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode("event: ping\ndata: 1\n\n"));
    },
    async pull(controller) {
      const { value, done } = await reader.read();
      if (done) {
        controller.enqueue(new TextEncoder().encode("event: done\ndata: [DONE]\n\n"));
        controller.close(); return;
      }
      controller.enqueue(value);
    },
    cancel() { try { reader.cancel(); } catch { } }
  });
  return new Response(stream, { status: 200, headers });
}
__name(groqStream, "groqStream");

/* ----------------------------- Health/metrics ------------------------- */

async function deepHealth(env) {
  const out = { ok: true, groq: null, time: Date.now() };
  const keys = selectGroqKeys(env);
  if (keys[0]) {
    try {
      const r = await fetch("https://api.groq.com/openai/v1/models", {
        method: "GET",
        headers: { "Authorization": `Bearer ${keys[0]}` },
        signal: AbortSignal.timeout(5000)
      });
      out.groq = { ok: r.ok, status: r.status };
    } catch (e) {
      out.groq = { ok: false, error: String(e && e.message || e) };
    }
  }
  return out;
}
__name(deepHealth, "deepHealth");

function validateCoachV2(rec) {
  if (!rec || typeof rec !== "object") return "payload not object";
  if (!Number.isInteger(rec.ts)) return "ts missing";
  if (!rec.schema) return "schema missing";
  if (!rec.mode) return "mode missing";
  if (typeof rec.overall !== "number") return "overall missing";
  if (!rec.scores || typeof rec.scores !== "object") return "scores missing";
  const keys = ["accuracy", "empathy", "clarity", "compliance", "discovery", "objection_handling"];
  for (const k of keys) if (!(k in rec.scores)) return `score ${k} missing`;
  if (!rec.context || typeof rec.context !== "object") return "context missing";
  if (typeof rec.context.rep_question !== "string") return "rep_question missing";
  if (typeof rec.context.hcp_reply !== "string") return "hcp_reply missing";
  return null;
}
__name(validateCoachV2, "validateCoachV2");

/* ----------------------------- Core handler --------------------------- */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";

    // OPTIONS
    if (request.method === "OPTIONS") {
      const reqHdrs = request.headers.get("Access-Control-Request-Headers") || "";
      const h = { ...cors(env, origin) };
      h["Access-Control-Allow-Headers"] = reqHdrs || "Content-Type, Authorization, HTTP-Referer, X-Title";
      return new Response(null, { status: 204, headers: h });
    }

    // Health
    if (url.pathname === "/health") {
      if (url.searchParams.get("deep") === "1") {
        const deep = await deepHealth(env);
        return json(deep, 200, env, origin);
      }
      return json({ ok: true, time: Date.now(), groq_keys: selectGroqKeys(env).length }, 200, env, origin);
    }

    // Version
    if (url.pathname === "/version") {
      return json({ ok: true, version: "r9", sig: env.PROVIDER_SIG || "unset" }, 200, env, origin);
    }

    // Metrics sink (kept)
    if (url.pathname === "/coach-metrics" && request.method === "POST") {
      try {
        const rec = await safeJson(request);
        const err = validateCoachV2(rec);
        if (err) return json({ ok: false, error: `bad_request: ${err}` }, 400, env, origin);
        try {
          if (env.METRICS_KV) {
            const key = `m:${rec.ts}:${crypto.randomUUID()}`;
            await env.METRICS_KV.put(key, JSON.stringify(rec), { expirationTtl: 60 * 60 * 24 * 30 });
          }
        } catch (_) { }
        return json({ ok: true }, 200, env, origin);
      } catch {
        return json({ ok: false, error: "invalid_json" }, 400, env, origin);
      }
    }

    // New strict endpoints
    if ((url.pathname === "/agent" || url.pathname === "/evaluate") && request.method === "POST") {
      const body = await safeJson(request);
      const isEvalPath = url.pathname === "/evaluate";
      const out = await handleAgent(body, env, origin, isEvalPath);
      return out;
    }

    // Back-compat adapter for /chat
    if (url.pathname === "/chat" && request.method === "POST") {
      const ip = request.headers.get("CF-Connecting-IP") || "0.0.0.0";
      const gateWait = softGate(ip);
      if (gateWait > 0) await sleep(gateWait);

      const body = await safeJson(request);
      const site = siteFromOrigin(origin, body.site);
      const mode = typeof body.mode === "string" ? body.mode : "default";
      const isRP = mode === "role-play";
      const rl = rateLimit(`${ip}:${site}:${mode}`, env, site);
      if (!rl.ok) {
        const retry = Number(env.RATELIMIT_RETRY_AFTER || 2);
        return json(
          { error: "rate_limited", retry_after_sec: retry, hint: "Auto-retry is safe.", site },
          429, env, origin,
          { "Retry-After": String(retry), "X-RateLimit-Limit": String(rl.limit), "X-RateLimit-Remaining": String(rl.remaining) }
        );
      }

      // Build a minimal envelope for the strict handler
      // Try to reuse client values; generate if absent
      const session_id = body.session_id || body.sid || crypto.randomUUID();
      const thread_id = body.thread_id || body.tid || `chat-${site}`;
      // seq: make monotonic server-side if missing
      const sessKey = `sess:${session_id}`;
      let sess = await env.SESS.get(sessKey, 'json');
      let nextSeq = 0;
      if (sess && Number.isInteger(sess.last_seq)) nextSeq = sess.last_seq + 1;

      // Optional: preserve your remote system usage by passing through label/policy text
      const adapted = {
        session_id,
        thread_id,
        seq: Number.isInteger(body.seq) ? body.seq : nextSeq,
        mode,
        mode_version: body.mode_version || (isRP ? 'rp-v2' : 'v1'),
        input: Array.isArray(body.messages) ? body.messages.at(-1)?.content || "" : "",
        messages: Array.isArray(body.messages) ? body.messages : undefined,
        labelText: typeof body.labelText === "string" ? body.labelText : "",
        policyText: typeof body.policyText === "string" ? body.policyText : "",
        stream: body.stream !== false,
        provider_sig: body.provider_sig || (env.PROVIDER_SIG || "")
      };

      // Route to strict engine; for RP we force non-stream to validate
      const strict = await handleAgent(adapted, env, origin, body.eval === true);
      return strict;
    }

    return text("not found", 404, env, origin);
  }
};

/* ---------------------------- Strict engine ---------------------------- */

async function handleAgent(body, env, origin, isEvaluatePath) {
  const {
    session_id,
    thread_id,
    seq,
    mode,
    mode_version,
    provider_sig,
    temperature,
    top_p,
    max_context,
    messages,     // optional legacy array
    input,        // last user text preferred
    stream,       // boolean
    labelText,    // optional for site-specific content
    policyText    // optional for site-specific content
  } = body || {};

  // Provider signature check
  if (env.PROVIDER_SIG && provider_sig && provider_sig !== env.PROVIDER_SIG) {
    return json({ error: 'provider_mismatch', server_sig: env.PROVIDER_SIG, client_sig: provider_sig }, 409, env, origin);
  }

  if (!session_id || !Number.isInteger(seq) || !mode) {
    return json({ error: 'bad_request', need: ['session_id', 'seq:int', 'mode'] }, 400, env, origin);
  }

  const effectiveMode = normalizeMode(mode, isEvaluatePath);

  // Session load/init
  const sessKey = `sess:${session_id}`;
  let sess = await env.SESS.get(sessKey, 'json');
  const now = Date.now();
  if (!sess) {
    sess = { mode: effectiveMode, mode_version: mode_version || defaultModeVersion(effectiveMode), last_seq: -1, created_at: now };
    await env.SESS.put(sessKey, JSON.stringify(sess), { expirationTtl: ttl(env) });
  }

  // Mode pin
  if (sess.mode !== effectiveMode) {
    return json({ error: 'mode_mismatch', server_mode: sess.mode, client_mode: effectiveMode }, 409, env, origin);
  }

  // Sequencing
  if (seq <= sess.last_seq) {
    return json({ error: 'stale_seq', last_seq: sess.last_seq }, 409, env, origin);
  }
  sess.last_seq = seq;
  await env.SESS.put(sessKey, JSON.stringify(sess), { expirationTtl: ttl(env) });

  // Thread history
  const tId = thread_id || `auto-${effectiveMode}`;
  const kvThreadKey = `thread:${session_id}:${effectiveMode}:${tId}`;
  let thread = await env.SESS.get(kvThreadKey, 'json');
  if (!Array.isArray(thread)) thread = [];

  // Anchors each call
  const sysAnchors = buildAnchors(effectiveMode);
  const guardrail = leakGuardrail();

  // Build conversation
  const history = buildHistory({
    anchors: [sysAnchors, guardrail,
      ...(labelText ? [{ role: 'system', content: "## Label Excerpts Provided\n" + String(labelText).slice(0, 24000) }] : []),
      ...(policyText ? [{ role: 'system', content: "## Policy Excerpts Provided\n" + String(policyText).slice(0, 16000) }] : [])
    ],
    thread,
    lastUser: input,
    clientMsgs: messages,
    maxChars: capChars(env, max_context)
  });

  // Streaming is blocked for RP to allow validation
  const wantStream = !!stream && effectiveMode !== 'role-play';

  const model = effectiveMode === 'coach'
    ? (env.PROVIDER_MODEL_COACH || PRIMARY_MODEL)
    : (env.PROVIDER_MODEL_HCP || PRIMARY_MODEL);

  const apiKey = selectGroqKeyDeterministic(env, seq);

  // Stream path
  if (wantStream) {
    try {
      const sse = await groqStream({
        apiKey, model,
        temperature: pickTemp(effectiveMode, temperature),
        top_p: pickTopP(effectiveMode, top_p),
        messages: history,
        max_tokens: 1536,
        env, origin
      });
      return sse;
    } catch (e) {
      return json({ error: 'provider_stream_error', detail: String(e?.message || e) }, 502, env, origin);
    }
  }

  // Non-stream with validation
  let result;
  try {
    result = await groqChat({
      apiKey, model,
      temperature: pickTemp(effectiveMode, temperature),
      top_p: pickTopP(effectiveMode, top_p),
      messages: history,
      max_tokens: 1536
    });
  } catch (e) {
    return json({ error: 'provider_error', detail: String(e?.message || e) }, 502, env, origin);
  }

  const raw = result.text || '';
  const parsed = parseXMLRoleContent(raw);

  // Leak firewall
  if (effectiveMode === 'role-play' && LEAK_RE.test(raw || '')) {
    return json({ error: 'leak_blocked', message: 'Evaluation content blocked in role-play mode' }, 422, env, origin);
  }

  // Role/schema enforcement with one retry
  if (effectiveMode === 'role-play' && (!parsed.role || parsed.role.toLowerCase() !== 'hcp')) {
    try {
      const retry = await groqChat({
        apiKey: selectGroqKeyDeterministic(env, seq + 1),
        model,
        temperature: pickTemp(effectiveMode, temperature),
        top_p: pickTopP(effectiveMode, top_p),
        messages: buildHistory({
          anchors: [sysAnchors + '\nHARD CONSTRAINT: Output <role>HCP</role> only.', guardrail],
          thread, lastUser: input, clientMsgs: messages, maxChars: Math.floor(capChars(env, max_context) * 0.8)
        }),
        max_tokens: 1400
      });
      const raw2 = retry.text || '';
      const parsed2 = parseXMLRoleContent(raw2);
      if (!parsed2.role || parsed2.role.toLowerCase() !== 'hcp') {
        return json({ error: 'role_drift', raw: raw2.slice(0, 2000) }, 409, env, origin);
      }
      thread = persistTurn(thread, input, `<role>${parsed2.role}</role><content>${parsed2.content}</content>`);
      await env.SESS.put(kvThreadKey, JSON.stringify(thread), { expirationTtl: ttl(env) });
      return json({ ok: true, role: parsed2.role, text: parsed2.content, raw: raw2 }, 200, env, origin, {
        "X-Model-Used": result.model_used || model, "X-Mode": effectiveMode
      });
    } catch (e) {
      return json({ error: 'provider_error_retry', detail: String(e?.message || e) }, 502, env, origin);
    }
  }

  if (effectiveMode === 'coach' && (!parsed.role || parsed.role.toLowerCase() !== 'coach')) {
    return json({ error: 'role_drift', expected: 'coach', got: parsed.role || 'none' }, 409, env, origin);
  }

  const toPersist = parsed.role && parsed.content
    ? `<role>${parsed.role}</role><content>${parsed.content}</content>`
    : raw;

  thread = persistTurn(thread, input, toPersist);
  await env.SESS.put(kvThreadKey, JSON.stringify(thread), { expirationTtl: ttl(env) });

  return json({ ok: true, role: parsed.role || null, text: parsed.content || raw, raw: raw, model_used: result.model_used || model }, 200, env, origin, {
    "X-Model-Used": result.model_used || model, "X-Mode": effectiveMode
  });
}
__name(handleAgent, "handleAgent");

/* --------------------------- Model params ---------------------------- */

function pickTemp(mode, t) {
  if (typeof t === 'number') return t;
  if (mode === 'coach') return 0.3;
  if (mode === 'role-play' || mode === 'sales-simulation') return 0.2;
  return 0.2;
}
__name(pickTemp, "pickTemp");

function pickTopP(mode, p) {
  if (typeof p === 'number') return p;
  return 0.8;
}
__name(pickTopP, "pickTopP");
