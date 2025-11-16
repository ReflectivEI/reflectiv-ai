// api/chat.js - Vercel Serverless Function for ReflectivAI Chat
// Ports Cloudflare Worker logic to Node.js

const FACTS_DB = [
  // Inlined facts from worker.js
  { id: "HIV-PREP-ELIG-001", text: "PrEP is recommended for individuals at substantial risk of HIV. Discuss sexual and injection risk factors.", cites: ["CDC PrEP 2024"], ta: "HIV" },
  { id: "HIV-PREP-TAF-002", text: "Descovy (emtricitabine/tenofovir alafenamide) is indicated for PrEP excluding receptive vaginal sex.", cites: ["FDA Label Descovy PrEP"], ta: "HIV" },
  { id: "HIV-PREP-SAFETY-003", text: "Assess renal function before and during PrEP. Consider eGFR thresholds per label.", cites: ["FDA Label Descovy", "CDC PrEP 2024"], ta: "HIV" },
  // Add more facts as needed
];

const FSM = {
  "sales-simulation": {
    states: {
      START: { capSentences: 5, next: "COACH" },
      COACH: { capSentences: 6, next: null }
    }
  },
  "role-play": {
    states: {
      START: { capSentences: 5, next: null }
    }
  }
};

const COACH_SCHEMA = {
  overall: 0,
  scores: { accuracy: 0, compliance: 0, discovery: 0, clarity: 0, objection_handling: 0, empathy: 0 },
  worked: [],
  improve: [],
  phrasing: "",
  feedback: "",
  context: { rep_question: "", hcp_reply: "" }
};

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

function capSentences(text, n) {
  const parts = String(text || "").replace(/\s+/g, " ").match(/[^.!?]+[.!?]?/g) || [];
  return parts.slice(0, n).join(" ").trim();
}

async function providerChat(messages, maxTokens = 900, temperature = 0.2) {
  const apiKey = process.env.PROVIDER_KEY;
  if (!apiKey) throw new Error("PROVIDER_KEY not set");

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "llama3-1-8b-instant",
      temperature,
      max_tokens: maxTokens,
      messages,
      stream: false
    })
  });

  if (!response.ok) throw new Error(`provider_http_${response.status}`);
  const data = await response.json();
  return data?.choices?.[0]?.message?.content || "";
}

function deterministicScore({ reply, usedFactIds = [] }) {
  const len = (reply || "").split(/\s+/).filter(Boolean).length;
  const base = Math.max(40, Math.min(92, 100 - Math.abs(len - 110) * 0.35));
  const factBonus = Math.min(8, usedFactIds.length * 3);
  return Math.round(base + factBonus);
}

async function postPlan(mode, disease, persona, goal) {
  const facts = FACTS_DB.filter(f => !disease || f.ta?.toLowerCase() === String(disease).toLowerCase());
  if (facts.length === 0) throw new Error("no_facts_for_request");

  return {
    planId: crypto.randomUUID(),
    mode,
    disease,
    persona,
    goal,
    facts: facts.slice(0, 8).map(f => ({ id: f.id, text: f.text, cites: f.cites }))
  };
}

async function postChat(body) {
  // Handle both formats
  let mode, user, history, disease, persona, goal, session;
  if (body.messages && Array.isArray(body.messages)) {
    const msgs = body.messages;
    const lastUserMsg = msgs.filter(m => m.role === "user").pop();
    history = msgs.filter(m => m.role !== "system" && m !== lastUserMsg);
    mode = body.mode || "sales-simulation";
    user = lastUserMsg?.content || "";
    disease = body.disease || "";
    persona = body.persona || "";
    goal = body.goal || "";
    session = body.session || "anon";
  } else {
    mode = body.mode || "sales-simulation";
    user = body.user;
    history = body.history || [];
    disease = body.disease || "";
    persona = body.persona || "";
    goal = body.goal || "";
    session = body.session || "anon";
  }

  // Normalize mode
  mode = mode === "sales-coach" ? "sales-simulation" : mode;

  // Load plan
  let activePlan;
  try {
    activePlan = await postPlan(mode, disease, persona, goal);
  } catch (e) {
    throw new Error("plan_generation_failed");
  }

  if (!activePlan || !Array.isArray(activePlan.facts) || activePlan.facts.length === 0) {
    throw new Error("no_active_plan_or_facts");
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

  // Provider call
  let raw = "";
  for (let i = 0; i < 3; i++) {
    try {
      raw = await providerChat(messages, mode === "sales-simulation" ? 700 : 500, 0.2);
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
      const contRaw = await providerChat(contMsgs, 180, 0.2);
      const contClean = sanitizeLLM(contRaw || "");
      if (contClean) reply = (reply + " " + contClean).trim();
    } catch (_) {}
  }

  // FSM clamps
  const fsm = FSM[mode] || FSM["sales-simulation"];
  const cap = fsm?.states?.[fsm?.start]?.capSentences || 5;
  reply = capSentences(reply, cap);

  // Deterministic scoring
  let coachObj = coach && typeof coach === "object" ? coach : null;
  if (!coachObj || !coachObj.scores) {
    const usedFactIds = activePlan.facts.map(f => f.id);
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

  return { reply, coach: coachObj, plan: { id: activePlan.planId } };
}

export default async function handler(req, res) {
  // CORS
  const corsOrigins = process.env.CORS_ORIGINS || "";
  const allowed = corsOrigins.split(",").map(s => s.trim()).filter(Boolean);
  const origin = req.headers.origin || "";
  const isAllowed = allowed.length === 0 || allowed.includes(origin);

  res.setHeader("Access-Control-Allow-Origin", isAllowed && origin ? origin : "");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = req.body;
    const result = await postChat(body);
    res.status(200).json(result);
  } catch (e) {
    console.error(e);
    if (e.message?.startsWith("provider_http_")) {
      res.status(502).json({ error: "provider_error", message: "External provider failed or is unavailable" });
    } else if (e.message === "plan_generation_failed" || e.message === "no_active_plan_or_facts") {
      res.status(422).json({ error: "bad_request", message: "Unable to generate or validate plan with provided parameters" });
    } else {
      res.status(400).json({ error: "bad_request", message: "Chat request failed" });
    }
  }
}