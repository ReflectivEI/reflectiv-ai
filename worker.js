// src/utils/helpers.ts
function cors(env, req) {
  const reqOrigin = req.headers.get("Origin") || "";
  const allowed = String(env.CORS_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
  const isAllowed = allowed.length === 0 || allowed.includes(reqOrigin);
  const allowOrigin = isAllowed ? reqOrigin || "*" : "null";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "content-type,authorization,x-req-id,x-ei-emit",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin"
  };
}
function json(body, status, env, req) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...cors(env, req) }
  });
}
async function readJson(req) {
  const txt = await req.text();
  if (!txt)
    return {};
  try {
    return JSON.parse(txt);
  } catch {
    return {};
  }
}
function capSentences(text, n) {
  const parts = String(text || "").replace(/\s+/g, " ").match(/[^.!?]+[.!?]?/g) || [];
  return parts.slice(0, n).join(" ").trim();
}
function sanitizeLLM(s) {
  return String(s || "").replace(/```[\s\S]*?```/g, "").replace(/<pre[\s\S]*?<\/pre>/gi, "").replace(/^\s*#{1,6}\s+/gm, "").replace(/\n{3,}/g, "\n\n").trim();
}
function extractCoach(raw) {
  const s = String(raw || "");
  const open = s.indexOf("<coach>");
  if (open < 0)
    return { coach: null, clean: sanitizeLLM(s) };
  const head = s.slice(0, open);
  const tail = s.slice(open + 7);
  const close = tail.indexOf("</coach>");
  const body = close >= 0 ? tail.slice(0, close) : tail;
  const start = body.indexOf("{");
  if (start < 0)
    return { coach: null, clean: sanitizeLLM(head) };
  let depth = 0, end = -1;
  for (let i = start; i < body.length; i++) {
    const ch = body[i];
    if (ch === "{")
      depth++;
    if (ch === "}")
      depth--;
    if (depth === 0) {
      end = i;
      break;
    }
  }
  if (end < 0)
    return { coach: null, clean: sanitizeLLM(head) };
  let coach = null;
  try {
    coach = JSON.parse(body.slice(start, end + 1));
  } catch {
  }
  const after = close >= 0 ? tail.slice(close + 8) : "";
  return { coach, clean: sanitizeLLM((head + " " + after).trim()) };
}
function cryptoRandomId() {
  const a = new Uint8Array(8);
  crypto.getRandomValues(a);
  return [...a].map((x) => x.toString(16).padStart(2, "0")).join("");
}
var norm = (s) => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();

// src/data.ts
var FACTS_DB = [
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
var FSM = {
  "sales-simulation": {
    states: {
      START: { capSentences: 5, next: "COACH" },
      COACH: { capSentences: 6, next: "COACH" }
    },
    start: "START"
  },
  "role-play": {
    states: {
      START: { capSentences: 4, next: "HCP" },
      HCP: { capSentences: 4, next: "HCP" }
    },
    start: "START"
  }
};

// src/routes/facts-plan.ts
async function postFacts(req, env) {
  const { disease, topic, limit = 6 } = await readJson(req);
  const out = FACTS_DB.filter((f) => {
    const dOk = !disease || f.ta?.toLowerCase() === String(disease).toLowerCase();
    const tOk = !topic || f.topic?.toLowerCase().includes(String(topic).toLowerCase());
    return dOk && tOk;
  }).slice(0, limit);
  return json({ facts: out }, 200, env, req);
}
async function postPlan(req, env) {
  const body = await readJson(req);
  const { mode = "sales-simulation", disease = "", persona = "", goal = "", topic = "" } = body || {};
  const factsRes = FACTS_DB.filter((f) => {
    const dOk = !disease || f.ta?.toLowerCase() === String(disease).toLowerCase();
    const tOk = !topic || f.topic?.toLowerCase().includes(String(topic).toLowerCase());
    return dOk && tOk;
  });
  const facts = factsRes.slice(0, 8);
  if (env.REQUIRE_FACTS === "true" && facts.length === 0)
    return json({ error: "no_facts_for_request" }, 422, env, req);
  const plan = {
    planId: cryptoRandomId(),
    mode,
    disease,
    persona,
    goal,
    facts: facts.map((f) => ({ id: f.id, text: f.text, cites: f.cites || [] })),
    fsm: FSM[mode] || FSM["sales-simulation"]
  };
  const valid = Array.isArray(plan.facts) && plan.facts.length > 0 && typeof plan.mode === "string";
  if (!valid)
    return json({ error: "invalid_plan" }, 422, env, req);
  return json(plan, 200, env, req);
}

// src/config.ts
function fromRequest(req) {
  const url = new URL(req.url);
  const queryParam = url.searchParams.get("emitEi");
  if (queryParam === "true" || queryParam === "1") {
    return { emitEi: true };
  }
  const headerValue = req.headers.get("x-ei-emit");
  if (headerValue === "1") {
    return { emitEi: true };
  }
  return { emitEi: false };
}

// src/ei/eiRules.ts
function scoreEi({ text, mode }) {
  const words = text.split(/\s+/).filter(Boolean);
  const sentences = text.match(/[^.!?]+[.!?]?/g) || [];
  const avgSentenceLength = sentences.length > 0 ? words.length / sentences.length : 0;
  const questions = (text.match(/\?/g) || []).length;
  const questionDensity = words.length > 0 ? questions / sentences.length : 0;
  const empathyKeywords = [
    "understand",
    "feel",
    "appreciate",
    "concern",
    "care",
    "patient",
    "important",
    "help",
    "support",
    "experience"
  ];
  const empathyCount = empathyKeywords.filter(
    (kw) => text.toLowerCase().includes(kw)
  ).length;
  const discoveryKeywords = [
    "would",
    "could",
    "might",
    "consider",
    "think",
    "what if",
    "have you",
    "would you",
    "tell me",
    "how"
  ];
  const discoveryCount = discoveryKeywords.filter(
    (kw) => text.toLowerCase().includes(kw)
  ).length;
  const complianceAnchors = [
    "per label",
    "according to",
    "fda",
    "cdc",
    "ias",
    "indicated",
    "approved",
    "guideline",
    "recommendation"
  ];
  const complianceCount = complianceAnchors.filter(
    (anchor) => text.toLowerCase().includes(anchor)
  ).length;
  const prohibitedClaims = [
    "cure",
    "guarantee",
    "best",
    "only",
    "always works",
    "no side effects",
    "completely safe",
    "never fails"
  ];
  const prohibitedCount = prohibitedClaims.filter(
    (claim) => text.toLowerCase().includes(claim)
  ).length;
  const clarityScore = clamp(
    Math.round(5 - Math.abs(avgSentenceLength - 18) / 8),
    1,
    5
  );
  const empathyScore = clamp(
    Math.round(2 + empathyCount * 0.8),
    1,
    5
  );
  const discoveryScore = clamp(
    Math.round(2 + questionDensity * 8 + discoveryCount * 0.5),
    1,
    5
  );
  const complianceScore = clamp(
    Math.round(3 + complianceCount * 0.8 - prohibitedCount * 2),
    1,
    5
  );
  const accuracyScore = clamp(
    Math.round(5 - Math.abs(words.length - 100) / 40),
    1,
    5
  );
  const scores = {
    empathy: empathyScore,
    discovery: discoveryScore,
    compliance: complianceScore,
    clarity: clarityScore,
    accuracy: accuracyScore
  };
  const rationales = {
    empathy: empathyScore >= 4 ? "Good use of patient-centered language" : "Consider more empathetic phrasing",
    discovery: discoveryScore >= 4 ? "Strong discovery questions present" : "Add more open-ended questions to engage",
    compliance: complianceScore >= 4 ? "Well-anchored to label and guidelines" : "Strengthen label references",
    clarity: clarityScore >= 4 ? "Clear and concise messaging" : "Simplify sentence structure for clarity",
    accuracy: accuracyScore >= 4 ? "Appropriate level of detail" : "Adjust detail level for better accuracy"
  };
  const tips = [];
  if (empathyScore < 4) {
    tips.push("Use more patient-centered language to show empathy");
  }
  if (discoveryScore < 4) {
    tips.push("End with a specific discovery question");
  }
  if (complianceScore < 4) {
    tips.push("Anchor claims to FDA label or guidelines");
  }
  if (clarityScore < 4) {
    tips.push("Keep sentences concise (15-20 words average)");
  }
  if (accuracyScore < 4) {
    tips.push("Balance detail level - not too brief, not too lengthy");
  }
  return {
    scores,
    rationales,
    tips: tips.slice(0, 5),
    rubric_version: "v1.2"
  };
}
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// src/validator.ts
function validateEiPayload(payload) {
  try {
    if (!payload || typeof payload !== "object") {
      return false;
    }
    if (!payload.scores || typeof payload.scores !== "object") {
      return false;
    }
    if (!payload.rubric_version || typeof payload.rubric_version !== "string") {
      return false;
    }
    const requiredScores = ["empathy", "discovery", "compliance", "clarity", "accuracy"];
    for (const score of requiredScores) {
      const value = payload.scores[score];
      if (typeof value !== "number" || value < 1 || value > 5 || !Number.isInteger(value)) {
        return false;
      }
    }
    if (payload.rationales !== void 0) {
      if (typeof payload.rationales !== "object" || Array.isArray(payload.rationales)) {
        return false;
      }
      for (const key in payload.rationales) {
        if (typeof payload.rationales[key] !== "string") {
          return false;
        }
      }
    }
    if (payload.tips !== void 0) {
      if (!Array.isArray(payload.tips) || payload.tips.length > 5) {
        return false;
      }
      for (const tip of payload.tips) {
        if (typeof tip !== "string") {
          return false;
        }
      }
    }
    return true;
  } catch {
    return false;
  }
}

// src/metrics.ts
var metrics = {
  ei_emitted_total: 0,
  ei_validation_failed_total: 0,
  ei_latency_histogram: []
};
function incrementEiEmitted() {
  metrics.ei_emitted_total++;
}
function incrementEiValidationFailed() {
  metrics.ei_validation_failed_total++;
}
function recordEiLatency(latencyMs) {
  metrics.ei_latency_histogram.push(latencyMs);
  if (metrics.ei_latency_histogram.length > 1e3) {
    metrics.ei_latency_histogram.shift();
  }
}
function getMetrics() {
  return {
    ei_emitted_total: metrics.ei_emitted_total,
    ei_validation_failed_total: metrics.ei_validation_failed_total,
    ei_latency_histogram: [...metrics.ei_latency_histogram]
  };
}
async function withTiming(fn) {
  const start = Date.now();
  const result = await fn();
  const latencyMs = Date.now() - start;
  return { result, latencyMs };
}

// src/utils/redact.ts
function redactPII(text) {
  if (!text)
    return text;
  let redacted = text;
  redacted = redacted.replace(
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    "[EMAIL]"
  );
  redacted = redacted.replace(
    /\b(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b/g,
    "[PHONE]"
  );
  redacted = redacted.replace(
    /\b[A-Z0-9]{6,12}\b/g,
    (match) => {
      if (/[A-Z]/.test(match) && /[0-9]/.test(match)) {
        return "[MRN]";
      }
      return match;
    }
  );
  redacted = redacted.replace(
    /\b(?:Dr\.?|Doctor)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b/gi,
    "[HCP_NAME]"
  );
  return redacted;
}

// src/routes/chat.ts
async function seqGet(env, session) {
  if (!env.SESS)
    return { lastNorm: "", fsm: {} };
  const k = `state:${session}`;
  const v = await env.SESS.get(k, "json");
  return v || { lastNorm: "", fsm: {} };
}
async function seqPut(env, session, state) {
  if (!env.SESS)
    return;
  await env.SESS.put(`state:${session}`, JSON.stringify(state), { expirationTtl: 60 * 60 * 12 });
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
  if (!r.ok)
    throw new Error(`provider_http_${r.status}`);
  const j = await r.json().catch(() => ({}));
  return j?.choices?.[0]?.message?.content || j?.content || "";
}
function deterministicScore({ reply, usedFactIds = [] }) {
  const len = (reply || "").split(/\s+/).filter(Boolean).length;
  const base = Math.max(40, Math.min(92, 100 - Math.abs(len - 110) * 0.35));
  const factBonus = Math.min(8, usedFactIds.length * 3);
  return Math.round(base + factBonus);
}
async function getPlan(body, env, req) {
  if (body.plan)
    return body.plan;
  const { mode = "sales-simulation", disease = "", persona = "", goal = "", topic = "" } = body;
  const factsRes = FACTS_DB.filter((f) => {
    const dOk = !disease || f.ta?.toLowerCase() === String(disease).toLowerCase();
    const tOk = !topic || f.topic?.toLowerCase().includes(String(topic).toLowerCase());
    return dOk && tOk;
  });
  const facts = factsRes.slice(0, 8);
  if (env.REQUIRE_FACTS === "true" && facts.length === 0) {
    throw new Error("no_facts_for_request");
  }
  return {
    planId: cryptoRandomId(),
    mode,
    disease,
    persona,
    goal,
    facts: facts.map((f) => ({ id: f.id, text: f.text, cites: f.cites || [] })),
    fsm: FSM[mode] || FSM["sales-simulation"]
  };
}
async function postChat(req, env) {
  try {
    const config = fromRequest(req);
    const body = await readJson(req);
    const {
      mode = "sales-simulation",
      user,
      history = [],
      disease = "",
      persona = "",
      goal = "",
      planId
    } = body || {};
    const session = body.session || "anon";
    const acceptHeader = req.headers.get("accept") || "";
    const isSSE = acceptHeader.includes("text/event-stream");
    const activePlan = await getPlan(body, env, req);
    const factsStr = activePlan.facts.map((f) => `- [${f.id}] ${f.text}`).join("\n");
    const citesStr = activePlan.facts.flatMap((f) => f.cites || []).slice(0, 6).map((c) => `- ${c}`).join("\n");
    const commonContract = `
Return exactly two parts. No code blocks or headings.

1) Sales Guidance: short, accurate, label-aligned guidance (3\u20135 sentences) and a "Suggested Phrasing:" single-sentence line.
2) <coach>{
  "scores":{"accuracy":0-5,"compliance":0-5,"discovery":0-5,"clarity":0-5,"objection_handling":0-5,"empathy":0-5},
  "worked":["\u2026"],"improve":["\u2026"],"phrasing":"\u2026","feedback":"\u2026",
  "context":{"rep_question":"...","hcp_reply":"..."}
}</coach>

Use only the Facts IDs provided when making claims.`.trim();
    const sys = mode === "role-play" ? [
      `You are the HCP. First-person only. No coaching. No lists. No "<coach>".`,
      `Disease: ${disease || "\u2014"}; Persona: ${persona || "\u2014"}; Goal: ${goal || "\u2014"}.`,
      `Facts:
${factsStr}
References:
${citesStr}`,
      `Speak concisely.`
    ].join("\n") : [
      `You are the ReflectivAI Sales Coach. Be label-aligned and specific to the facts.`,
      `Disease: ${disease || "\u2014"}; Persona: ${persona || "\u2014"}; Goal: ${goal || "\u2014"}.`,
      `Facts:
${factsStr}
References:
${citesStr}`,
      commonContract
    ].join("\n");
    const messages = [
      { role: "system", content: sys },
      ...history.map((m) => ({ role: m.role, content: String(m.content || "") })).slice(-18),
      { role: "user", content: String(user || "") }
    ];
    let raw = "";
    for (let i = 0; i < 3; i++) {
      try {
        raw = await providerChat(env, messages, {
          maxTokens: mode === "sales-simulation" ? 1200 : 900,
          temperature: 0.2
        });
        if (raw)
          break;
      } catch (e) {
        if (i === 2)
          throw e;
        await new Promise((r) => setTimeout(r, 300 * (i + 1)));
      }
    }
    const { coach, clean } = extractCoach(raw);
    let reply = clean;
    const cutOff = (t) => {
      const s = String(t || "").trim();
      return s.length > 200 && !/[.!?]"?\s*$/.test(s);
    };
    if (cutOff(reply)) {
      const contMsgs = [
        ...messages,
        { role: "assistant", content: reply },
        { role: "user", content: "Continue the same answer. Finish in 1\u20132 sentences. No new sections." }
      ];
      try {
        const contRaw = await providerChat(env, contMsgs, { maxTokens: 360, temperature: 0.2 });
        const contClean = sanitizeLLM(contRaw || "");
        if (contClean)
          reply = (reply + " " + contClean).trim();
      } catch (_) {
      }
    }
    const fsm = FSM[mode] || FSM["sales-simulation"];
    const cap = fsm?.states?.[fsm?.start]?.capSentences || 5;
    reply = capSentences(reply, cap);
    const state = await seqGet(env, session);
    const candNorm = norm(reply);
    if (state && candNorm && candNorm === state.lastNorm) {
      if (mode === "role-play") {
        reply = "In my clinic, we review history, adherence, and recent exposures before deciding. Follow-up timing guides next steps.";
      } else {
        reply = 'Anchor to eligibility, one safety check, and end with a single discovery question about patient selection. Suggested Phrasing: "For patients with consistent risk, would confirming eGFR today help you start one eligible person this month?"';
      }
    }
    state.lastNorm = norm(reply);
    await seqPut(env, session, state);
    let coachObj = coach && typeof coach === "object" ? coach : null;
    if (!coachObj || !coachObj.scores) {
      const usedFactIds = (activePlan.facts || []).map((f) => f.id);
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
    let eiPayload = null;
    if (config.emitEi && mode === "sales-simulation") {
      try {
        const { result: ei, latencyMs } = await withTiming(() => scoreEi({ text: reply, mode }));
        recordEiLatency(latencyMs);
        if (validateEiPayload(ei)) {
          eiPayload = ei;
          incrementEiEmitted();
        } else {
          incrementEiValidationFailed();
          console.warn("EI validation failed:", redactPII(JSON.stringify(ei)));
        }
      } catch (e) {
        incrementEiValidationFailed();
        console.error("EI scoring error:", redactPII(String(e)));
      }
    }
    const response = {
      reply,
      coach: coachObj,
      plan: { id: planId || activePlan.planId }
    };
    if (eiPayload) {
      response._coach = { ei: eiPayload };
    }
    if (isSSE && eiPayload) {
      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();
      const encoder = new TextEncoder();
      (async () => {
        try {
          await writer.write(encoder.encode(`data: ${JSON.stringify({ type: "reply", content: reply })}

`));
          await writer.write(encoder.encode(`event: coach.partial
data: ${JSON.stringify({ scores: eiPayload.scores })}

`));
          await new Promise((r) => setTimeout(r, 50));
          await writer.write(encoder.encode(`event: coach.final
data: ${JSON.stringify(eiPayload)}

`));
          await writer.write(encoder.encode("data: [DONE]\n\n"));
          await writer.close();
        } catch (e) {
          console.error("SSE streaming error:", e);
          await writer.abort(e);
        }
      })();
      return new Response(readable, {
        headers: {
          "content-type": "text/event-stream",
          "cache-control": "no-cache",
          "connection": "keep-alive",
          ...cors(env, req)
        }
      });
    }
    return json(response, 200, env, req);
  } catch (e) {
    return json({ error: "server_error", detail: String(e?.message || e) }, 500, env, req);
  }
}

// src/index.ts
var src_default = {
  async fetch(req, env, ctx) {
    try {
      const url = new URL(req.url);
      if (req.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: cors(env, req) });
      }
      if (url.pathname === "/health" && req.method === "GET") {
        return new Response("ok", { status: 200, headers: cors(env, req) });
      }
      if (url.pathname === "/version" && req.method === "GET") {
        return json({ version: "r10.2" }, 200, env, req);
      }
      if (url.pathname === "/metrics" && req.method === "GET") {
        const metrics2 = getMetrics();
        return json(metrics2, 200, env, req);
      }
      if (url.pathname === "/facts" && req.method === "POST") {
        return postFacts(req, env);
      }
      if (url.pathname === "/plan" && req.method === "POST") {
        return postPlan(req, env);
      }
      if (url.pathname === "/chat" && req.method === "POST") {
        return postChat(req, env);
      }
      return json({ error: "not_found" }, 404, env, req);
    } catch (e) {
      return json({ error: "server_error", detail: String(e?.message || e) }, 500, env, req);
    }
  }
};
export {
  src_default as default
};
