/*
 * ReflectivAI Widget — coach-v2, RP hardening (full, with history)
 * Modes: emotional-assessment | product-knowledge | sales-simulation | role-play
 * Stability measures:
 * - Persist mode & scenario in sessionStorage
 * - RP conversation cache in sessionStorage
 * - Double-send lock (3s)
 * - RP auto-trim: keep last 30 when >35
 * - Per-turn RP anchor + 10-turn reinforcement
 * - 25s rollback line if API stalls
 * - Crash-proof buildUI; surface boot errors in-modal
 * - CSP-safe style injection
 * - Model + temperature pinned per mode
 * - NEW: History builder so the model always sees prior turns
 */
(function () {
  // -------- error surfacing --------
  window.addEventListener("error", (e) => {
    try {
      const m = document.getElementById("reflectiv-widget");
      if (!m) return;
      const box = document.createElement("div");
      box.style.cssText =
        "padding:12px;border:1px solid #e33;background:#fff5f5;color:#900;border-radius:8px;margin:12px;font:13px/1.4 system-ui, -apple-system, Segoe UI, Roboto, Arial";
      box.innerHTML = `<strong>ReflectivAI boot error</strong><br>${String(e.message || e)}`;
      m.appendChild(box);
    } catch {}
  });

  // -------- safe bootstrapping --------
  let mount = null;
  function waitForMount(cb) {
    const SELECTOR = "#reflectiv-widget, #coach-widget, [data-coach-mount], .reflectiv-widget";
    const findMount = () =>
      document.getElementById("reflectiv-widget") || document.querySelector(SELECTOR);

    function bootstrap() {
      mount = findMount();
      if (!mount) {
        const host =
          document.querySelector(".modal-body, .dialog-body, .drawer-body, .modal-content") ||
          document.body;
        const m = document.createElement("div");
        m.id = "reflectiv-widget";
        host.appendChild(m);
        mount = m;
        console.warn("[ReflectivAI] Auto-created #reflectiv-widget");
      }
      cb();
    }

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", bootstrap, { once: true });
    } else {
      setTimeout(bootstrap, 50);
    }

    const obs = new MutationObserver(() => {
      if (!mount) {
        const maybe = findMount();
        if (maybe) {
          mount = maybe;
          obs.disconnect();
          cb();
        }
      }
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(() => obs.disconnect(), 15000);
  }

  // -------- config/state --------
  const LC_OPTIONS = [
    "Emotional Intelligence",
    "Product Knowledge",
    "Sales Simulation",
    "Role Play"
  ];
  const LC_TO_INTERNAL = {
    "Emotional Intelligence": "emotional-assessment",
    "Product Knowledge": "product-knowledge",
    "Sales Simulation": "sales-simulation",
    "Role Play": "role-play"
  };
  const INTERNAL_TO_LC = Object.fromEntries(
    Object.entries(LC_TO_INTERNAL).map(([k, v]) => [v, k])
  );

  let cfg = null;
  let systemPrompt = "";
  let scenarios = [];
  let scenariosById = new Map();

  let currentMode = "sales-simulation";
  let currentScenarioId = null;
  let conversation = [];
  let coachOn = true;

  const MODE_KEY = "reflectiv_last_mode";
  const SCEN_KEY = "reflectiv_last_scenario";

  // -------- RP cache (prevents mid-RP reset on remount) --------
  const RP_SESSION_KEY = "reflectiv_rp_cache_v1";
  let rpCache = null;
  function persistRolePlayState() {
    if (currentMode === "role-play" && conversation.length) {
      try {
        rpCache = JSON.parse(JSON.stringify(conversation));
        sessionStorage.setItem(RP_SESSION_KEY, JSON.stringify(rpCache));
      } catch {}
    }
  }
  function restoreRolePlayState() {
    if (currentMode === "role-play" && (!conversation || !conversation.length)) {
      if (!rpCache) {
        try {
          rpCache = JSON.parse(sessionStorage.getItem(RP_SESSION_KEY) || "null");
        } catch {
          rpCache = null;
        }
      }
      if (rpCache) {
        try {
          conversation = JSON.parse(JSON.stringify(rpCache));
        } catch {}
      }
    }
  }

  // -------- utils --------
  async function fetchLocal(path) {
    const r = await fetch(path, { cache: "no-store" });
    if (!r.ok) throw new Error(`Failed to load ${path} (${r.status})`);
    const ct = r.headers.get("content-type") || "";
    return ct.includes("application/json") ? r.json() : r.text();
  }

  const esc = (s) =>
    String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  function sanitizeLLM(raw) {
    let s = String(raw || "");
    s = s.replace(/```[\s\S]*?```/g, "");
    s = s.replace(/<pre[\s\S]*?<\/pre>/gi, "");
    s = s.replace(/^\s*#{1,6}\s+/gm, "");
    s = s.replace(/^\s*(hi|hello|hey)[^\n]*\n+/i, "");
    s = s.replace(/\n{3,}/g, "\n\n").trim();
    return s;
  }

  function clampLen(s, max) {
    s = String(s || "");
    if (s.length <= max) return s;
    return s.slice(0, max).replace(/\s+\S*$/, "").trim() + "…";
  }

  function splitSentences(text) {
    const t = String(text || "");
    return t.replace(/\s+/g, " ").match(/[^.!?]+[.!?]?/g) || [];
  }

  // ---------- history builder (NEW) ----------
  function historyAsMessages(maxTurns = 30) {
    const turns = conversation.slice(-maxTurns);
    return turns.map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content
    }));
  }

  const BRAND_RE = /\b(descovy|biktarvy|cabenuva|truvada|prep)\b/i;
  const PROMO_ARTIFACTS_RE =
    /\b(educational (resources?|materials?)|training session|in-?service|lunch-?and-?learn|handout|one-?pager|brochure|leave-?behind|job aid|script|slide deck|webinar|office hours)\b/i;
  const FIRST_PERSON_OFFER_RE =
    /\b((?:i|we)\s+(?:can\s+)?(?:provide|offer|arrange|conduct|deliver|send|share|supply|set up|schedule|organize|host|walk (?:you|your team) through|train|educate))\b/i;
  const OFFER_OR_TRAINING_WORD_RE =
    /\b(offer|provide|train|training|educate|education|materials?|resources?|handouts?|brochures?|one-?pagers?|scripts?)\b/i;
  const IDENTITY_DRIFT_RE =
    /\b(i am|i'm)\s+(?:an?\s+)?(?:ai|assistant|bot|sales\s*coach|coach)\b|\b(not a clinician|i don't interact with patients)\b/i;

  // -------- Role-play sanitizer --------
  function sanitizeRolePlayOnly(text) {
    let s = String(text || "");

    const open = s.indexOf("<coach>");
    if (open >= 0) s = s.slice(0, open);

    s = s.replace(/<coach>[\s\S]*?<\/coach>/gi, "");
    s = s.replace(
      /(?:^|\n)\s*(?:\*\*)?\s*(?:Sales\s*Guidance|Challenge|My\s*Approach|Impact)\s*(?:\*\*)?\s*:\s*[\s\S]*?(?=\n\s*\n|$)/gmi,
      ""
    );
    s = s.replace(/^(?:Assistant|Coach|System|Rep|User|Sales Rep)\s*:\s*/gmi, "");
    s = s.replace(/^\s*["“']?\s*(hi|hello|hey)\b.*$/gmi, "");

    s = s.replace(/^\s*[-*]\s+/gm, "");
    s = s.replace(/^\s*#{1,6}\s+.*$/gm, "");
    s = s.replace(/^\s*>\s?/gm, "");

    const nouns =
      "(patients?|panel|clinic|practice|workflow|nurses?|staff|team|MA|MAs|prescribing|prescriptions|criteria|approach)";
    s = s.replace(new RegExp(`\\byour\\s+${nouns}\\b`, "gi"), (m) => m.replace(/\byour\b/i, "my"));

    const IMP =
      /^(ask|emphasize|consider|provide|offer|educate|ensure|recommend|suggest|discuss|address|reinforce|encourage|support)\b/i;

    const sentences = splitSentences(s)
      .map((raw) => {
        let t = raw.trim();
        if (!t) return "";

        const isQ = /\?\s*$/.test(t);
        const hasYou = /\byou(r)?\b/i.test(t);
        const repCue =
          /(how\s+do\s+you|can\s+we\s+review\s+your|can\s+you\s+(?:share|explain|present|go over)|help\s+me\s+understand\s+your|what\s+do\s+you\s+do|how\s+are\s+you\s+identif|walk\s+me\s+through)/i.test(
            t
          );

        if (isQ && (hasYou || /walk\s+me\s+through/i.test(t)) && repCue) {
          t = t
            .replace(/\bcan\s+we\s+review\s+your\s+approach\b/i, "In my clinic, we review our approach")
            .replace(/\bhow\s+do\s+you\s+identif(?:y|ies)\b/gi, "Here is how I identify")
            .replace(/\bhelp\s+me\s+understand\s+your\b/gi, "I consider my")
            .replace(/\b(can|could)\s+you\s+(share|explain|present|go over)\b/gi, "I would like to review")
            .replace(/\bwalk\s+me\s+through\b/gi, "review")
            .replace(/\byour\b/gi, "my")
            .replace(/\byou\b/gi, "I")
            .replace(/\?\s*$/, ".")
            .trim();
        }

        if (IMP.test(t)) {
          const rest = t.replace(IMP, "").replace(/^[:,\s]+/, "");
          t = `In my clinic, I ${rest}`.replace(/\?\s*$/, ".").trim();
        }

        if (
          FIRST_PERSON_OFFER_RE.test(t) ||
          (/(?:^|\b)(?:i|we)\b/i.test(t) && OFFER_OR_TRAINING_WORD_RE.test(t))
        ) {
          t =
            "In my clinic, I rely on our internal processes and current guidelines; my focus is on patient selection and follow-up.";
        }

        t = t
          .replace(/\bcan\s+i\s+walk\s+me\s+through\b/gi, "I would like to review")
          .replace(/\bi\s+walk\s+me\s+through\b/gi, "I review")
          .replace(/\bwalk\s+me\s+through\b/gi, "review")
          .replace(/\bcan\s+i\s+(share|explain|present|go\s+over)\b/gi, "I would like to review");

        if (/I would like to review/i.test(t)) t = t.replace(/\?\s*$/, ".").trim();

        return t;
      })
      .filter(Boolean);

    s = sentences.join(" ").trim();

    s = s.replace(/\bcan you tell me\b/gi, "I’m considering");
    s = s.replace(/\bhelp me understand\b/gi, "I want to understand");
    s = s.replace(/\bwhat would it take to\b/gi, "Here’s what I’d need to");

    s = s.replace(/\*\*(?=\s|$)/g, "");
    s = s.replace(/^[“"']|[”"']$/g, "");
    s = s.replace(/\s{2,}/g, " ").trim();

    if (!s)
      s =
        "From my perspective, we evaluate high-risk patients using history, behaviors, and adherence context.";
    return s;
  }

  function isGuidanceLeak(txt) {
    const t = String(txt || "");
    const imp =
      /(?:^|\s[.“"'])\s*(ask|emphasize|consider|provide|offer|educate|ensure|recommend|suggest|discuss|address|reinforce|encourage|support)\b/i;
    const second =
      /\b(emphasize|ensure|educate|recommend|suggest|encourage|support|provide|offer)\b.*\b(you|your)\b/i;

    const cues = [
      /\b(you should|you can|i recommend|i suggest|best practice|here'?s how|you’ll want to)\b/i,
      /\b(coaching|guidance|sales guidance|coach)\b/i,
      second,
      /^[-*]\s/m,
      /<coach>|\bworked:|\bimprove:/i,
      imp,
      IDENTITY_DRIFT_RE
    ];

    const generalHits = cues.filter((re) => re.test(t)).length >= 2;

    const offerHit =
      FIRST_PERSON_OFFER_RE.test(t) ||
      ((/^(?:i|we)\b/i.test(t)) &&
        OFFER_OR_TRAINING_WORD_RE.test(t) &&
        /staff|team|your\s+staff/i.test(t));

    const artifactHit = PROMO_ARTIFACTS_RE.test(t) || BRAND_RE.test(t);

    return generalHits || offerHit || artifactHit;
  }

  function correctiveRails(sc) {
    const personaLine =
      sc && (sc.hcpRole || sc.label)
        ? `HCP Persona: ${sc.hcpRole || sc.label}. Disease: ${
            sc.therapeuticArea || sc.diseaseState || "—"
          }.`
        : "";
    return [
      `Reply strictly as the HCP clinician. Never say you are a coach, assistant, or AI. Never claim you are not a clinician.`,
      `First-person. 2–5 sentences. No advice to the rep. No “you/your” guidance.`,
      `No lists, headings, rubrics, JSON, or "<coach>".`,
      `No offers to provide/arrange training, resources, handouts, or scripts.`,
      `Describe your own clinical approach. Questions must be about your clinic/patients.`,
      personaLine
    ].join("\n");
  }

  async function enforceHcpOnly(replyText, sc, messages, callModelFn) {
    let out = sanitizeRolePlayOnly(replyText);
    const leaked = () => isGuidanceLeak(out) || IDENTITY_DRIFT_RE.test(out);
    if (!leaked()) return out;

    try {
      const r1 = await callModelFn([
        { role: "system", content: correctiveRails(sc) },
        { role: "user", content: out }
      ]);
      out = sanitizeRolePlayOnly(r1);
      if (!leaked()) return out;
    } catch {}

    try {
      const r2 = await callModelFn([
        { role: "system", content: correctiveRails(sc) },
        ...messages
      ]);
      out = sanitizeRolePlayOnly(r2);
      if (!leaked()) return out;
    } catch {}

    out = out
      .replace(
        IDENTITY_DRIFT_RE,
        "In my clinic, I focus on patient selection and follow-up."
      )
      .replace(
        new RegExp(
          String.raw`(?:^|\s)(?:I|We)\s+(?:can\s+)?(?:provide|offer|arrange|conduct|deliver|send|share|supply|set up|schedule|organize|host|walk (?:you|your team) through|train|educate)\b[^.!?]*[.!?]\s*`,
          "gi"
        ),
        ""
      )
      .replace(
        new RegExp(String.raw`${PROMO_ARTIFACTS_RE.source}[^.!?]*[.!?]\s*`, "gi"),
        ""
      )
      .replace(
        /\b(i recommend|i suggest|consider|you should|you can|best practice)\b[^.!?]*[.!?]\s*/gi,
        ""
      )
      .replace(
        /\b(emphasize|ensure|educate|recommend|suggest|encourage|support|provide|offer)\b[^.!?]*\b(you|your)\b[^.!?]*[.!?]\s*/gi,
        ""
      )
      .replace(
        /^(ask|emphasize|consider|provide|offer|educate|ensure|recommend|suggest|discuss|address|reinforce|encourage|support)\b[^.!?]*[.!?]\s*/gim,
        ""
      )
      .trim();

    if (!out) {
      out =
        "From my perspective, we review patient histories and behaviors to understand risk patterns.";
    }
    return out;
  }

  // -------- light HTML renderer --------
  function md(text) {
    if (!text) return "";
    let s = esc(String(text)).replace(/\r\n?/g, "\n");
    s = s.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
    s = s.replace(
      /^(?:-\s+|\*\s+).+(?:\n(?:-\s+|\*\s+).+)*/gm,
      (blk) => {
        const items = blk
          .split("\n")
          .map((l) => l.replace(/^(?:-\s+|\*\s+)(.+)$/, "<li>$1</li>"))
          .join("");
        return `<ul>${items}</ul>`;
      }
    );
    return s
      .split(/\n{2,}/)
      .map((p) => (p.startsWith("<ul>") ? p : `<p>${p.replace(/\n/g, "<br>")}</p>`))
      .join("\n");
  }
  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  // -------- extract coach JSON --------
  function extractCoach(raw) {
    const s = String(raw || "");
    const open = s.indexOf("<coach>");
    if (open === -1) return { coach: null, clean: sanitizeLLM(s) };

    const cleanText = sanitizeLLM(s.slice(0, open).trim());
    let tail = s.slice(open + "<coach>".length);

    const close = tail.indexOf("</coach>");
    let block = close >= 0 ? tail.slice(0, close) : tail;

    const braceStart = block.indexOf("{");
    if (braceStart === -1) return { coach: null, clean: cleanText };

    let depth = 0,
      end = -1;
    for (let i = braceStart; i < block.length; i++) {
      const ch = block[i];
      if (ch === "{") depth++;
      if (ch === "}") {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    if (end === -1) return { coach: null, clean: cleanText };

    let jsonTxt = block
      .slice(braceStart, end + 1)
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'");
    let coach = null;
    try {
      coach = JSON.parse(jsonTxt);
    } catch {}
    return { coach, clean: cleanText };
  }

  // -------- simple local scoring --------
  function scoreReply(userText, replyText) {
    const t = String(replyText || "");
    const words = t.split(/\s+/).filter(Boolean).length;
    const q = /\?\s*$/.test(t);
    const label = /(fda|guideline|indication|boxed warning)/i.test(t) ? 5 : 3;
    const accuracy = /(safety|adherence|coverage|contraindication|interaction)/i.test(t)
      ? Math.max(4, label)
      : 3;
    const empathy = /(i understand|appreciate|thanks|i hear)/i.test(t) ? 3 : 2;
    const clarity = words > 180 ? 2 : words >= 45 && words <= 120 ? 4 : 3;
    const discovery = q ? 4 : 2;
    const objection = /(concern|barrier|risk|auth|workflow)/i.test(t) ? 3 : 2;
    let overall = Math.round(
      (accuracy * 26 +
        label * 22 +
        discovery * 16 +
        objection * 14 +
        clarity * 12 +
        empathy * 10) /
        100 *
        20
    );
    if (words >= 45 && words <= 120) overall += 3;
    if (q) overall += 3;
    if (words > 180) overall -= 6;
    overall = Math.max(0, Math.min(100, overall));
    return {
      overall,
      scores: {
        accuracy,
        empathy,
        clarity,
        compliance: label,
        discovery,
        objection_handling: objection
      },
      score: overall,
      subscores: {
        accuracy,
        empathy,
        clarity,
        compliance: label,
        discovery,
        objection_handling: objection
      },
      context: { rep_question: String(userText || ""), hcp_reply: String(t) },
      worked: [],
      improve: [],
      phrasing: ""
    };
  }

  // -------- EI helpers --------
  let personaSelectElem = null,
    eiFeatureSelectElem = null,
    feedbackDisplayElem = null,
    personaLabelElem = null,
    featureLabelElem = null,
    lastUserMessage = "";

  const DEFAULT_PERSONAS = [
    { key: "difficult", label: "Difficult HCP" },
    { key: "busy", label: "Busy HCP" },
    { key: "engaged", label: "Engaged HCP" },
    { key: "indifferent", label: "Indifferent HCP" }
  ];
  const DEFAULT_EI_FEATURES = [
    { key: "empathy", label: "Empathy Rating" },
    { key: "stress", label: "Stress Level Indicator" },
    { key: "listening", label: "Active Listening Hints" },
    { key: "validation", label: "Validation & Reframing Tips" }
  ];

  function calculateEmpathyRating(personaKey, message) {
    if (!message) return 0;
    const text = String(message || "").toLowerCase();
    let score = { difficult: 1, busy: 2, engaged: 4, indifferent: 3 }[personaKey] ?? 3;
    [
      "understand",
      "appreciate",
      "concern",
      "feel",
      "sorry",
      "hear",
      "sounds like",
      "empathize",
      "thanks",
      "acknowledge"
    ].forEach((kw) => {
      if (text.includes(kw)) score++;
    });
    return Math.min(5, score);
  }

  function calculateStressRating(personaKey, message) {
    if (!message) return 0;
    const text = String(message || "").toLowerCase();
    let score = { difficult: 4, busy: 5, engaged: 2, indifferent: 3 }[personaKey] ?? 3;
    ["stress", "busy", "overwhelmed", "frustrated", "tired", "pressure", "deadline"].forEach(
      (kw) => {
        if (text.includes(kw)) score++;
      }
    );
    return Math.min(5, score);
  }

  function generateDynamicFeedback(personaKey, featureKey) {
    if (!personaKey || !featureKey) return "";
    if (featureKey === "empathy")
      return (
        {
          difficult: "Acknowledge frustration first; short validating phrase, then next step.",
          busy: "One-line empathy, then bottom line.",
          engaged: "Reinforce collaboration; ask one next question.",
          indifferent: "Validate neutrality; pivot to patient impact."
        }[personaKey] || "Match tone and show understanding before proposing."
      );
    if (featureKey === "stress")
      return (
        {
          difficult: "Keep brief and reassuring; remove jargon.",
          busy: "Bottom line first; one low-effort step.",
          engaged: "Provide clear info; invite collaboration.",
          indifferent: "Build rapport via patient-centered framing."
        }[personaKey] || "Reduce cognitive load and give clear choices."
      );
    if (featureKey === "listening")
      return (
        {
          difficult: "Reflect back their words; confirm; ask a short clarifier.",
          busy: "Summarize in one sentence; yes/no clarifier.",
          engaged: "Affirm insights; use clarifiers to deepen.",
          indifferent: "Light affirmations; ask a patient-impact question."
        }[personaKey] || "Use reflective and clarifying questions."
      );
    if (featureKey === "validation")
      return (
        {
          difficult: "Validate frustration; reframe to shared goals.",
          busy: "Validate time constraints; reframe to workflow fit.",
          engaged: "Validate expertise; reframe to partnership.",
          indifferent: "Validate neutrality; reframe to a meaningful benefit."
        }[personaKey] || "Validate perspective; reframe to patient value."
      );
    return "Select a valid EI feature.";
  }

  function generateFeedback() {
    if (!feedbackDisplayElem) return;

    if (currentMode !== "emotional-assessment") {
      feedbackDisplayElem.innerHTML = "";
      return;
    }

    const personaKey = personaSelectElem && personaSelectElem.value;
    const featureKey = eiFeatureSelectElem && eiFeatureSelectElem.value;

    if (!personaKey || !featureKey || !lastUserMessage) {
      feedbackDisplayElem.innerHTML = `<span class="muted">Select a persona and EI feature, then send a message to see feedback.</span>`;
      return;
    }

    const rating =
      featureKey === "empathy"
        ? calculateEmpathyRating(personaKey, lastUserMessage)
        : featureKey === "stress"
        ? calculateStressRating(personaKey, lastUserMessage)
        : null;

    const featureList =
      cfg?.eiFeatures && cfg.eiFeatures.length ? cfg.eiFeatures : DEFAULT_EI_FEATURES;
    const featureObj = featureList.find(
      (f) => f.key === featureKey || f.value === featureKey || f.id === featureKey
    );
    const featureLabel = featureObj ? featureObj.label || featureKey : featureKey;
    const fbTxt = generateDynamicFeedback(personaKey, featureKey);

    feedbackDisplayElem.innerHTML =
      rating == null
        ? `<strong>${esc(featureLabel)}</strong><br><p>${esc(fbTxt)}</p>`
        : `<strong>${esc(featureLabel)}: ${rating}/5</strong><br><p>${esc(fbTxt)}</p>`;
  }

  // -------- persona context --------
  function currentPersonaHint() {
    const sc = scenariosById.get(currentScenarioId);
    if (sc && (sc.hcpRole || sc.label)) {
      const dz = sc.therapeuticArea || sc.diseaseState || "—";
      const who = sc.hcpRole || sc.label;
      return `HCP Persona: ${who}. Disease: ${dz}.`;
    }
    return "";
  }

  function buildPreface(mode, sc) {
    const personaLine = currentPersonaHint();

    if (mode === "sales-simulation")
      return `# Role
You are a virtual pharma coach. Be direct, label-aligned, and safe.

# Scenario
${personaLine}
${
  sc
    ? [
        `Therapeutic Area: ${sc.therapeuticArea || "—"}`,
        `HCP Role: ${sc.hcpRole || "—"}`,
        `Background: ${sc.background || "—"}`,
        `Today’s Goal: ${sc.goal || "—"}`
      ].join("\n")
    : ""
}

# Style
- 3–6 sentences and one closing question.
- Label-aligned facts only. No PHI or pricing.
`;

    if (mode === "product-knowledge")
      return `Return a concise educational overview with reputable citations. Structure: key takeaways; mechanism/indications; safety/contraindications; efficacy; access notes; references.`;

    if (mode === "role-play")
      return `# Role Play Contract — HCP Only
You are the Healthcare Provider. Reply ONLY as the HCP. First-person. Concise clinical dialogue.
${personaLine}
If the user types "Evaluate this exchange" or "Give feedback", step out of role and reflect.

Hard bans:
- No coaching/rubrics/scores/JSON/"<coach>".
- No headings or bullet lists.
- No guidance to the rep about their process.
- No offers to provide/arrange training, resources, handouts, scripts.
- Never say you are a coach/assistant/AI or “not a clinician”.

Allowable questions reflect the HCP’s POV. Output only the HCP utterance.`;

    return `Provide brief self-reflection tips tied to HCP communication. 3–5 sentences, then one reflective question.`;
  }

  // -------- UI --------
  let modeSel, diseaseSelect, hcpSelect;

  function buildUI() {
    try {
      mount.innerHTML = "";
      if (!mount.classList.contains("cw")) mount.classList.add("cw");

      const STYLE_ID = "reflectiv-widget-inline-style";
      let style = document.getElementById(STYLE_ID);
      if (!style) {
        style = document.createElement("style");
        style.id = STYLE_ID;
        style.textContent = `
#reflectiv-widget .reflectiv-chat{display:flex;flex-direction:column;gap:12px;border:3px solid #bfc7d4;border-radius:14px;background:#fff;overflow:hidden}
#reflectiv-widget .chat-toolbar{display:block;padding:14px 16px;background:#f6f8fb;border-bottom:1px solid #e1e6ef}
#reflectiv-widget .sim-controls{display:grid;grid-template-columns:220px 1fr 220px 1fr;gap:12px 16px;align-items:center}
#reflectiv-widget .sim-controls label{font-size:13px;font-weight:600;color:#2f3a4f;justify-self:end;white-space:nowrap}
#reflectiv-widget .sim-controls select{width:100%;height:38px;padding:6px 10px;font-size:14px;border:1px solid #cfd6df;border-radius:8px;background:#fff}
#reflectiv-widget .chat-messages{min-height:220px;overflow:auto;padding:12px 14px;background:#fafbfd}
#reflectiv-widget .message{margin:8px 0;display:flex}
#reflectiv-widget .message.user{justify-content:flex-end}
#reflectiv-widget .message.assistant{justify-content:flex-start}
#reflectiv-widget .message .content{max-width:85%;line-height:1.45;font-size:14px;padding:10px 12px;border-radius:14px;border:1px solid #d6dbe3;color:#0f1522;background:#e9edf3}
#reflectiv-widget .message.user .content{background:#e0e0e0;color:#000}
#reflectiv-widget .chat-input{display:flex;gap:8px;padding:10px 12px;border-top:1px solid #e1e6ef;background:#fff}
#reflectiv-widget .chat-input textarea{flex:1;resize:none;min-height:44px;max-height:120px;padding:10px 12px;border:1px solid #cfd6df;border-radius:10px;outline:none}
#reflectiv-widget .chat-input .btn{min-width:86px;border:0;border-radius:999px;background:#2f3a4f;color:#fff;font-weight:600}
#reflectiv-widget .coach-section{margin-top:0;padding:12px 14px;border:1px solid #e1e6ef;border-radius:12px;background:#fffbe8}
#reflectiv-widget .hidden{display:none!important}
#reflectiv-widget .speaker{display:inline-block;margin:0 0 6px 2px;padding:2px 8px;font-size:11px;font-weight:700;border-radius:999px;border:1px solid #cfd6df}
#reflectiv-widget .speaker.hcp{background:#eef4ff;color:#0f2a6b;border-color:#c9d6ff}
#reflectiv-widget .speaker.rep{background:#e8fff2;color:#0b5a2a;border-color:#bfeacc}
        `;
        try {
          document.head.appendChild(style);
        } catch {
          console.warn("[ReflectivAI] inline style blocked by CSP");
        }
      }

      const shell = el("div", "reflectiv-chat");
      shell.innerHTML = `
        <div class="chat-toolbar"><div class="sim-controls"></div></div>
        <div class="scenario-meta"></div>
        <div class="chat-messages">
          <div class="message assistant"><div class="content">Loading ReflectivAI Coach…</div></div>
        </div>
        <div class="chat-input">
          <textarea placeholder="Type your message…"></textarea>
          <button class="btn">Send</button>
        </div>
      `;
      mount.appendChild(shell);

      const bar = el("div", "chat-toolbar");
      const simControls = el("div", "sim-controls");

      const lcLabel = el("label", "", "Learning Center");
      lcLabel.htmlFor = "cw-mode";
      modeSel = el("select");
      modeSel.id = "cw-mode";
      LC_OPTIONS.forEach((name) => {
        const o = el("option");
        o.value = name;
        o.textContent = name;
        modeSel.appendChild(o);
      });

      // restore persisted mode
      const persistedMode = sessionStorage.getItem(MODE_KEY);
      const initialLc = persistedMode
        ? INTERNAL_TO_LC[persistedMode] || "Sales Simulation"
        : Object.keys(LC_TO_INTERNAL).find(
            (k) => LC_TO_INTERNAL[k] === (cfg?.defaultMode || "sales-simulation")
          ) || "Sales Simulation";
      modeSel.value = initialLc;
      currentMode = LC_TO_INTERNAL[modeSel.value];

      const coachLabel = el("label", "", "Coach");
      coachLabel.htmlFor = "cw-coach";
      const coachSel = el("select");
      coachSel.id = "cw-coach";
      [
        { v: "on", t: "Coach On" },
        { v: "off", t: "Coach Off" }
      ].forEach(({ v, t }) => {
        const o = el("option");
        o.value = v;
        o.textContent = t;
        coachSel.appendChild(o);
      });
      coachSel.value = coachOn ? "on" : "off";
      coachSel.onchange = () => {
        coachOn = coachSel.value === "on";
        renderCoach();
      };

      const diseaseLabel = el("label", "", "Disease State");
      diseaseLabel.htmlFor = "cw-disease";
      diseaseSelect = el("select");
      diseaseSelect.id = "cw-disease";

      const hcpLabel = el("label", "", "HCP Profiles");
      hcpLabel.htmlFor = "cw-hcp";
      hcpSelect = el("select");
      hcpSelect.id = "cw-hcp";

      // EI controls
      const personaLabel = el("label", "", "HCP Persona");
      personaLabel.htmlFor = "cw-ei-persona";
      const personaSelect = el("select");
      personaSelect.id = "cw-ei-persona";
      personaSelectElem = personaSelect;
      personaLabelElem = personaLabel;
      personaSelect.addEventListener("change", generateFeedback);

      const featureLabel = el("label", "", "EI Feature");
      featureLabel.htmlFor = "cw-ei-feature";
      const featureSelect = el("select");
      featureSelect.id = "cw-ei-feature";
      eiFeatureSelectElem = featureSelect;
      featureLabelElem = featureLabel;
      featureSelect.addEventListener("change", generateFeedback);

      // EI options
      const PERSONAS_ALL =
        Array.isArray(cfg?.eiProfiles) && cfg.eiProfiles.length
          ? cfg.eiProfiles
          : DEFAULT_PERSONAS;
      const FEATURES_ALL_RAW =
        (Array.isArray(cfg?.eiFeatures) && cfg.eiFeatures.length && cfg.eiFeatures) ||
        (Array.isArray(cfg?.features) && cfg.features.length && cfg.features) ||
        DEFAULT_EI_FEATURES;
      const FEATURES_ALL = FEATURES_ALL_RAW.map((f) =>
        typeof f === "string"
          ? { key: f.toLowerCase().replace(/\s+/g, "-"), label: f }
          : f
      );
      function hydrateEISelects() {
        if (!personaSelectElem || !eiFeatureSelectElem) return;
        personaSelectElem.innerHTML = "";
        eiFeatureSelectElem.innerHTML = "";
        const opt = (txt, val = "") => {
          const o = document.createElement("option");
          o.value = val;
          o.textContent = txt;
          return o;
        };
        personaSelectElem.appendChild(opt("Select...", ""));
        eiFeatureSelectElem.appendChild(opt("Select...", ""));
        PERSONAS_ALL.forEach((p) => {
          const o = document.createElement("option");
          o.value =
            p.key || p.value || p.id || String(p).toLowerCase().replace(/\s+/g, "-");
          o.textContent = p.label || p.name || p.title || String(p);
          personaSelectElem.appendChild(o);
        });
        FEATURES_ALL.forEach((f) => {
          const o = document.createElement("option");
          o.value = f.key || f.value || f.id || String(f).toLowerCase().replace(/\s+/g, "-");
          o.textContent = f.label || f.name || f.title || String(f);
          eiFeatureSelectElem.appendChild(o);
        });
      }

      simControls.appendChild(lcLabel);
      simControls.appendChild(modeSel);
      simControls.appendChild(coachLabel);
      simControls.appendChild(coachSel);
      simControls.appendChild(diseaseLabel);
      simControls.appendChild(diseaseSelect);
      simControls.appendChild(hcpLabel);
      simControls.appendChild(hcpSelect);
      simControls.appendChild(personaLabel);
      simControls.appendChild(personaSelect);
      simControls.appendChild(featureLabel);
      simControls.appendChild(featureSelect);
      bar.appendChild(simControls);

      shell.innerHTML = "";
      shell.appendChild(bar);
      const meta = el("div", "scenario-meta");
      shell.appendChild(meta);
      const msgs = el("div", "chat-messages");
      shell.appendChild(msgs);

      const inp = el("div", "chat-input");
      const ta = el("textarea");
      ta.placeholder = "Type your message…";
      let lastKeyTs = 0;
      ta.addEventListener("keydown", (e) => {
        const now = Date.now();
        if (e.key === "Enter" && !e.shiftKey) {
          if (now - lastKeyTs < 250) return;
          lastKeyTs = now;
          e.preventDefault();
          send.click();
        }
      });
      const send = el("button", "btn", "Send");
      send.onclick = () => {
        const t = ta.value.trim();
        if (!t) return;
        sendMessage(t);
        ta.value = "";
      };
      inp.appendChild(ta);
      inp.appendChild(send);
      shell.appendChild(inp);

      const coach = el("div", "coach-section");
      coach.innerHTML =
        `<h3>Coach Feedback</h3><div class="coach-body muted">Awaiting the first assistant reply…</div>`;
      shell.appendChild(coach);

      feedbackDisplayElem = el("div", "ei-feedback");
      feedbackDisplayElem.id = "feedback-display";
      feedbackDisplayElem.style.marginTop = "8px";
      feedbackDisplayElem.style.padding = "8px";
      feedbackDisplayElem.style.borderTop = "1px solid #e1e6ef";
      feedbackDisplayElem.style.fontSize = "14px";
      coach.appendChild(feedbackDisplayElem);

      function getDiseaseStates() {
        let ds = Array.isArray(cfg?.diseaseStates) ? cfg.diseaseStates.slice() : [];
        if (!ds.length && Array.isArray(scenarios) && scenarios.length) {
          ds = Array.from(
            new Set(
              scenarios
                .map((s) => (s.therapeuticArea || s.diseaseState || "").trim())
                .filter(Boolean)
            )
          );
        }
        ds = ds.map((x) => x.replace(/\bhiv\b/gi, "HIV"));
        return ds;
      }

      function elOption(select, val, label) {
        const o = document.createElement("option");
        o.value = val;
        o.textContent = label;
        select.appendChild(o);
      }
      function setSelectOptions(select, values, withPlaceholder) {
        select.innerHTML = "";
        if (withPlaceholder) {
          const p = document.createElement("option");
          p.value = "";
          p.textContent = "Select…";
          p.disabled = true;
          p.selected = true;
          select.appendChild(p);
        }
        values.forEach((v) => {
          if (!v) return;
          if (typeof v === "string") elOption(select, v, v);
          else
            elOption(
              select,
              v.value || v.id || v.key || v.label,
              v.label || v.value || v.id || v.key
            );
        });
      }

      function populateDiseases() {
        const ds = getDiseaseStates();
        setSelectOptions(diseaseSelect, ds.length ? ds : ["General"], true);
      }

      function populateHcpForDisease(ds) {
        const dsKey = (ds || "").trim();
        const scen = scenarios.filter((s) => {
          const area = (s.therapeuticArea || s.diseaseState || "").trim();
          return area.toLowerCase() === dsKey.toLowerCase();
        });
        if (scen.length) {
          setSelectOptions(
            hcpSelect,
            scen.map((s) => ({ value: s.id, label: s.label || s.id })),
            true
          );
          hcpSelect.disabled = false;
        } else {
          setSelectOptions(
            hcpSelect,
            [{ value: "", label: "No scenarios for this disease" }],
            true
          );
          hcpSelect.disabled = true;
        }
      }

      function renderMeta() {
        const sc = scenariosById.get(currentScenarioId);
        const show = currentMode === "sales-simulation" || currentMode === "role-play";
        if (!sc || !currentScenarioId || !show) {
          meta.innerHTML = "";
          return;
        }
        meta.innerHTML = `<div class="meta-card" style="padding:10px 12px;background:#f7f9fc;border:1px solid #e1e6ef;border-radius:10px">
          <div><strong>Therapeutic Area:</strong> ${esc(sc.therapeuticArea || sc.diseaseState || "—")}</div>
          <div><strong>HCP Role:</strong> ${esc(sc.hcpRole || "—")}</div>
          <div><strong>Background:</strong> ${esc(sc.background || "—")}</div>
          <div><strong>Today’s Goal:</strong> ${esc(sc.goal || "—")}</div>
        </div>`;
      }

      function renderMessages() {
        const msgsEl = shell.querySelector(".chat-messages");
        msgsEl.innerHTML = "";
        const rp = currentMode === "role-play";

        for (const m of conversation) {
          const row = el("div", `message ${m.role}`);
          const c = el("div", "content");

          if (rp) {
            const chipText =
              m._speaker === "hcp"
                ? "HCP"
                : m._speaker === "rep"
                ? "Rep"
                : m.role === "assistant"
                ? "Assistant"
                : "You";
            const chipCls =
              m._speaker === "hcp"
                ? "speaker hcp"
                : m._speaker === "rep"
                ? "speaker rep"
                : "speaker";
            const chip = el("div", chipCls, chipText);
            c.appendChild(chip);
          }

          const body = el("div");
          body.innerHTML = md(m.content);
          c.appendChild(body);

          row.appendChild(c);
          msgsEl.appendChild(row);
        }
        msgsEl.scrollTop = msgsEl.scrollHeight;
      }

      function orderedPills(scores) {
        const order = [
          "accuracy",
          "empathy",
          "clarity",
          "compliance",
          "discovery",
          "objection_handling"
        ];
        return order
          .filter((k) => k in (scores || {}))
          .map((k) => `<span class="pill">${esc(k)}: ${(scores || {})[k]}</span>`)
          .join(" ");
      }

      function renderCoach() {
        const body = coach.querySelector(".coach-body");
        if (!coachOn || currentMode === "product-knowledge") {
          coach.style.display = "none";
          return;
        }
        coach.style.display = "";

        if (currentMode === "role-play") {
          const last = conversation[conversation.length - 1];
          if (!last || !last._finalEval) {
            body.innerHTML = `<span class="muted">Type “Evaluate this exchange” for a final assessment.</span>`;
            return;
          }
        }

        const last = conversation[conversation.length - 1];
        if (!(last && last.role === "assistant" && last._coach)) {
          body.innerHTML = `<span class="muted">Awaiting the first assistant reply…</span>`;
          return;
        }
        const fb = last._coach,
          scores = fb.scores || fb.subscores || {};
        const workedStr =
          fb.worked && fb.worked.length ? fb.worked.join(". ") + "." : "—";
        const improveStr =
          fb.improve && fb.improve.length
            ? fb.improve.join(". ") + "."
            : fb.feedback || "—";
        body.innerHTML = `
          <div class="coach-score">Score: <strong>${
            fb.overall ?? fb.score ?? "—"
          }</strong>/100</div>
          <div class="coach-subs">${orderedPills(scores)}</div>
          <ul class="coach-list">
            <li><strong>What worked:</strong> ${esc(workedStr)}</li>
            <li><strong>What to improve:</strong> ${esc(improveStr)}</li>
            <li><strong>Suggested phrasing:</strong> ${esc(fb.phrasing || "—")}</li>
          </ul>`;
      }

      function applyModeVisibility() {
        const lc = modeSel.value;
        const nextMode = LC_TO_INTERNAL[lc];
        const wasRP = currentMode === "role-play";
        const stayingRP = wasRP && nextMode === "role-play";
        currentMode = nextMode;
        try {
          sessionStorage.setItem(MODE_KEY, currentMode);
        } catch {}

        if (stayingRP) persistRolePlayState();

        const pk = currentMode === "product-knowledge";
        coachLabel.classList.toggle("hidden", pk);
        coachSel.classList.toggle("hidden", pk);

        if (currentMode === "sales-simulation") {
          diseaseLabel.classList.remove("hidden");
          diseaseSelect.classList.remove("hidden");
          hcpLabel.classList.remove("hidden");
          hcpSelect.classList.remove("hidden");
          personaLabelElem.classList.add("hidden");
          personaSelectElem.classList.add("hidden");
          featureLabelElem.classList.add("hidden");
          eiFeatureSelectElem.classList.add("hidden");
          feedbackDisplayElem.innerHTML = "";
          populateDiseases();
        } else if (currentMode === "product-knowledge") {
          diseaseLabel.classList.remove("hidden");
          diseaseSelect.classList.remove("hidden");
          hcpLabel.classList.add("hidden");
          hcpSelect.classList.add("hidden");
          personaLabelElem.classList.add("hidden");
          personaSelectElem.classList.add("hidden");
          featureLabelElem.classList.add("hidden");
          eiFeatureSelectElem.classList.add("hidden");
          feedbackDisplayElem.innerHTML = "";
          populateDiseases();
          currentScenarioId = null;
          conversation = [];
        } else if (currentMode === "role-play") {
          diseaseLabel.classList.remove("hidden");
          diseaseSelect.classList.remove("hidden");
          hcpLabel.classList.remove("hidden");
          hcpSelect.classList.remove("hidden");
          personaLabelElem.classList.add("hidden");
          personaSelectElem.classList.add("hidden");
          featureLabelElem.classList.add("hidden");
          eiFeatureSelectElem.classList.add("hidden");
          feedbackDisplayElem.innerHTML = `<div class="coach-note"><strong>Role Play:</strong> Select Disease + HCP. Type <em>"Evaluate this exchange"</em> for final assessment.</div>`;
          populateDiseases();
          if (diseaseSelect.value) populateHcpForDisease(diseaseSelect.value);
          restoreRolePlayState();
        } else {
          diseaseLabel.classList.add("hidden");
          diseaseSelect.classList.add("hidden");
          hcpLabel.classList.add("hidden");
          hcpSelect.classList.add("hidden");
          personaLabelElem.classList.remove("hidden");
          personaSelectElem.classList.remove("hidden");
          featureLabelElem.classList.remove("hidden");
          eiFeatureSelectElem.classList.remove("hidden");
          feedbackDisplayElem.innerHTML = "";
          currentScenarioId = null;
          conversation = [];
        }

        renderMessages();
        renderCoach();
        renderMeta();

        try {
          sessionStorage.setItem(SCEN_KEY, currentScenarioId || "");
        } catch {}
      }

      modeSel.addEventListener("change", applyModeVisibility);

      diseaseSelect.addEventListener("change", () => {
        const ds = diseaseSelect.value || "";
        if (!ds) return;
        if (currentMode === "sales-simulation" || currentMode === "role-play")
          populateHcpForDisease(ds);
        else if (currentMode === "product-knowledge") currentScenarioId = null;
        try {
          sessionStorage.setItem(SCEN_KEY, currentScenarioId || "");
        } catch {}
        renderMessages();
        renderCoach();
        renderMeta();
      });

      hcpSelect.addEventListener("change", () => {
        const sel = hcpSelect.value || "";
        if (!sel) return;
        const sc = scenariosById.get(sel);
        currentScenarioId = sc ? sc.id : null;
        try {
          sessionStorage.setItem(SCEN_KEY, currentScenarioId || "");
        } catch {}
        renderMessages();
        renderCoach();
        renderMeta();
      });

      // expose for sendMessage
      shell._renderMessages = renderMessages;
      shell._renderCoach = renderCoach;
      shell._renderMeta = renderMeta;
      shell._sendBtn = send;
      shell._ta = ta;

      populateDiseases();
      hydrateEISelects();

      const persistedScenario = sessionStorage.getItem(SCEN_KEY);
      if (persistedScenario) {
        applyModeVisibility();
        const sc = scenariosById.get(persistedScenario);
        if (sc) {
          diseaseSelect.value = sc.therapeuticArea || sc.diseaseState || "";
          populateHcpForDisease(diseaseSelect.value);
          hcpSelect.value = sc.id;
          currentScenarioId = sc.id;
        }
      } else {
        applyModeVisibility();
      }
    } catch (err) {
      console.error("[ReflectivAI] buildUI failed:", err);
      mount.innerHTML = `
        <div style="padding:16px;font-family:system-ui">
          <h3 style="margin:0 0 8px">Reflectiv Coach</h3>
          <div style="padding:12px;border:1px solid #e3e8ef;border-radius:10px;background:#fff">
            Boot failed: ${String(err.message || err)} — open console for details.
          </div>
        </div>`;
    }
  }

  // -------- transport --------
  async function callModel(messages) {
    const url = (
      cfg?.apiBase ||
      cfg?.workerUrl ||
      window.COACH_ENDPOINT ||
      window.WORKER_URL ||
      ""
    ).trim();
    if (!url)
      throw new Error(
        "No API endpoint configured (set config.apiBase/workerUrl or window.COACH_ENDPOINT)."
      );

    // Pin per-mode model + temperature
    const model =
      currentMode === "role-play"
        ? "llama-3.1-8b-instant"
        : (cfg && cfg.model) || "llama-3.1-8b";
    const temperature = currentMode === "role-play" ? 0.1 : 0.2;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort("timeout"), 22000);

    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          temperature,
          stream: !!cfg?.stream,
          messages
        }),
        signal: controller.signal
      });
      if (!r.ok) {
        const txt = await r.text().catch(() => "");
        throw new Error(`HTTP ${r.status}: ${txt || "no body"}`);
      }
      const data = await r.json().catch(() => ({}));
      return (
        data?.content ||
        data?.reply ||
        data?.choices?.[0]?.message?.content ||
        ""
      );
    } finally {
      clearTimeout(timer);
    }
  }

  // -------- evaluation --------
  async function evaluateConversation() {
    const sc = scenariosById.get(currentScenarioId);
    const turns = conversation.slice(-30);
    const convoText = turns.map((m) => `${m.role}: ${m.content}`).join("\n");

    const evalMsgs = [
      systemPrompt ? { role: "system", content: systemPrompt } : null,
      { role: "system", content: buildPreface("role-play", sc) + "\nEvaluate the whole exchange now." },
      {
        role: "user",
        content:
          `Evaluate this entire exchange for EI, clarity, accuracy, compliance, discovery, and objection handling. Provide specific, actionable feedback and a 0–100 score.\n\nConversation:\n${convoText}`
      }
    ].filter(Boolean);

    const raw = await callModel(evalMsgs);
    const { coach, clean } = extractCoach(raw);
    const finalCoach = coach || scoreReply("", clean);
    conversation.push({
      role: "assistant",
      content: clean,
      _coach: finalCoach,
      _finalEval: true
    });
    persistRolePlayState();
  }

  // -------- send --------
  function norm(txt) {
    return String(txt || "").toLowerCase().replace(/\s+/g, " ").trim();
  }
  let lastAssistantNorm = "",
    recentAssistantNorms = [];
  function pushRecent(n) {
    recentAssistantNorms.push(n);
    if (recentAssistantNorms.length > 3) recentAssistantNorms.shift();
  }
  let isSending = false,
    sendInProgress = false,
    pendingRecoveryTimer = null;

  function trimConversationIfNeeded() {
    if (currentMode === "role-play" && conversation.length > 35) {
      conversation = conversation.slice(-30); // keep last 30 turns
      console.warn("[ReflectivAI] Conversation auto-trimmed to last 30 turns.");
    } else if (conversation.length > 60) {
      conversation = conversation.slice(-40);
    }
  }

  async function sendMessage(userText) {
    // Double-send guard
    if (sendInProgress) return;
    sendInProgress = true;
    setTimeout(() => (sendInProgress = false), 3000);

    if (isSending) return;
    isSending = true;

    restoreRolePlayState();

    const shellEl = mount.querySelector(".reflectiv-chat");
    const renderMessages = shellEl._renderMessages;
    const renderCoach = shellEl._renderCoach;
    const sendBtn = shellEl._sendBtn;
    const ta = shellEl._ta;
    if (sendBtn) sendBtn.disabled = true;
    if (ta) ta.disabled = true;

    try {
      userText = clampLen((userText || "").trim(), 1200);
      if (!userText) return;
      lastUserMessage = userText;

      const evalRe =
        /\b(evaluate|assessment|assess|grade|score)\b.*\b(conversation|exchange|dialog|dialogue|chat)\b|\bfinal (eval|evaluation|assessment)\b/i;
      if (evalRe.test(userText)) {
        await evaluateConversation();
        trimConversationIfNeeded();
        renderMessages();
        renderCoach();
        return;
      }

      // append user turn to our local conversation first
      conversation.push({
        role: "user",
        content: userText,
        _speaker: currentMode === "role-play" ? "rep" : "user"
      });
      persistRolePlayState();

      // trim stored conversation before building history
      trimConversationIfNeeded();
      renderMessages();
      renderCoach();

      const sc = scenariosById.get(currentScenarioId);
      const messages = [];

      // ==== SYSTEM ANCHORS FIRST ====
      if (currentMode === "role-play") {
        messages.push({
          role: "system",
          content:
            "Stay purely in character as the healthcare provider. Speak as 'I'. Do not coach the rep. Continue from your last HCP reply."
        });

        const personaLine = currentPersonaHint();
        const detail = sc
          ? `Therapeutic Area: ${sc.therapeuticArea || sc.diseaseState || "—"}. HCP Role: ${
              sc.hcpRole || "—"
            }. ${sc.background ? `Background: ${sc.background}. ` : ""}${
              sc.goal ? `Today’s Goal: ${sc.goal}.` : ""
            }`
          : "";
        const rails =
          buildPreface("role-play", sc) +
          `

Context:
${personaLine}
${detail}`;
        messages.push({ role: "system", content: rails });

        if (conversation.length % 10 === 0) {
          messages.push({
            role: "system",
            content:
              "Reminder: you are the HCP in this simulated clinical conversation. Use first-person and continue from your last answer."
          });
        }
      } else {
        if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
        messages.push({ role: "system", content: buildPreface(currentMode, sc) });
      }

      // ==== INCLUDE PRIOR TURNS (NEW) ====
      messages.push(...historyAsMessages(currentMode === "role-play" ? 30 : 40));
      // Do NOT push the current user again; it's already in conversation/history.

      // Last line of defense – short timeout rollback
      if (pendingRecoveryTimer) {
        clearTimeout(pendingRecoveryTimer);
        pendingRecoveryTimer = null;
      }
      pendingRecoveryTimer = setTimeout(() => {
        try {
          if (conversation.length && conversation.at(-1).role === "user") {
            conversation.push({
              role: "assistant",
              content: "Let’s continue where we left off—what’s next?",
              _speaker: currentMode === "role-play" ? "hcp" : "assistant"
            });
            persistRolePlayState();
            renderMessages();
            renderCoach();
          }
        } catch {}
      }, 25000);

      try {
        let raw = await callModel(messages);
        if (!raw)
          raw =
            "From my perspective, we review patient histories and adherence to guide decisions.";

        const { coach, clean } = extractCoach(raw);
        let replyText =
          currentMode === "role-play" ? sanitizeRolePlayOnly(clean) : sanitizeLLM(clean);

        if (currentMode === "role-play")
          replyText = await enforceHcpOnly(replyText, sc, messages, callModel);

        // anti-echo
        if (norm(replyText) === norm(userText)) {
          replyText =
            "From my perspective, we evaluate high-risk patients using history, behaviors, and adherence context.";
        }

        // simple dedupe
        let candidate = norm(replyText);
        if (candidate && (candidate === lastAssistantNorm || recentAssistantNorms.includes(candidate))) {
          const alts = [
            "In my clinic, we review history, behaviors, and adherence to understand risk.",
            "I rely on history and follow-up patterns to guide decisions.",
            "We focus on adherence and recent exposures when assessing candidacy."
          ];
          replyText = alts[Math.floor(Math.random() * alts.length)];
          candidate = norm(replyText);
        }
        lastAssistantNorm = candidate;
        pushRecent(candidate);

        replyText = clampLen(replyText, 1400);

        const computed = scoreReply(userText, replyText, currentMode);
        const finalCoach = (() => {
          if (coach && (coach.scores || coach.subscores) && currentMode !== "role-play") {
            const scores = coach.scores || coach.subscores;
            const overall =
              typeof coach.overall === "number"
                ? coach.overall
                : typeof coach.score === "number"
                ? coach.score
                : undefined;
            return {
              overall: overall ?? computed.overall,
              scores,
              feedback: coach.feedback || computed.feedback,
              worked: coach.worked?.length ? coach.worked : computed.worked,
              improve: coach.improve?.length ? coach.improve : computed.improve,
              phrasing: coach.phrasing || computed.phrasing,
              context: coach.context || { rep_question: userText, hcp_reply: replyText },
              score: overall ?? computed.overall,
              subscores: scores
            };
          }
          return computed;
        })();

        conversation.push({
          role: "assistant",
          content: replyText,
          _coach: finalCoach,
          _speaker: currentMode === "role-play" ? "hcp" : "assistant"
        });
        persistRolePlayState();
        trimConversationIfNeeded();
        renderMessages();
        renderCoach();
      } catch (e) {
        if (currentMode === "role-play") restoreRolePlayState();
        conversation.push({
          role: "assistant",
          content: `Model error: ${String(e.message || e)}`
        });
        trimConversationIfNeeded();
        renderMessages();
      } finally {
        if (pendingRecoveryTimer) {
          clearTimeout(pendingRecoveryTimer);
          pendingRecoveryTimer = null;
        }
      }
    } finally {
      const shellEl2 = mount.querySelector(".reflectiv-chat");
      const sendBtn2 = shellEl2?._sendBtn;
      const ta2 = shellEl2?._ta;
      if (sendBtn2) sendBtn2.disabled = false;
      if (ta2) {
        ta2.disabled = false;
        ta2.focus();
      }
      isSending = false;
    }
  }

  // -------- scenarios loader --------
  async function loadScenarios() {
    try {
      if (cfg && cfg.scenariosUrl) {
        const payload = await fetchLocal(cfg.scenariosUrl);
        const arr = Array.isArray(payload) ? payload : payload.scenarios || [];
        scenarios = arr.map((s) => ({
          id: String(s.id),
          label: s.label || String(s.id),
          therapeuticArea: s.therapeuticArea || s.diseaseState || "",
          hcpRole: s.hcpRole || "",
          background: s.background || "",
          goal: s.goal || ""
        }));
      } else if (Array.isArray(cfg?.scenarios)) {
        scenarios = cfg.scenarios.map((s) => ({
          id: String(s.id),
          label: s.label || String(s.id),
          therapeuticArea: s.therapeuticArea || s.diseaseState || "",
          hcpRole: s.hcpRole || "",
          background: s.background || "",
          goal: s.goal || ""
        }));
      } else {
        scenarios = [];
      }
    } catch (e) {
      console.error("scenarios load failed:", e);
      scenarios = [];
    }

    scenarios.forEach((s) => {
      if (s.therapeuticArea)
        s.therapeuticArea = s.therapeuticArea.replace(/\bhiv\b/gi, "HIV");
    });

    const byId = new Map();
    for (const s of scenarios) byId.set(s.id, s);
    scenarios = Array.from(byId.values());
    scenariosById = byId;
  }

  // -------- init --------
  async function init() {
    try {
      try {
        cfg = await fetchLocal("./assets/chat/config.json");
      } catch {
        cfg = await fetchLocal("./config.json");
      }
    } catch (e) {
      console.error("config load failed:", e);
      cfg = { defaultMode: "sales-simulation" };
    }

    if (!cfg.apiBase && !cfg.workerUrl)
      cfg.apiBase = (window.COACH_ENDPOINT || window.WORKER_URL || "").trim();

    try {
      systemPrompt = await fetchLocal("./assets/chat/system.md");
    } catch (e) {
      console.error("system.md load failed:", e);
      systemPrompt = "";
    }

    // restore persisted keys early
    try {
      const m = sessionStorage.getItem(MODE_KEY);
      if (m) currentMode = m;
      const cs = sessionStorage.getItem(SCEN_KEY);
      if (cs) currentScenarioId = cs || null;
    } catch {}

    await loadScenarios();
    buildUI();

    if (currentMode === "role-play") restoreRolePlayState();
  }

  // -------- start --------
  console.log("[ReflectivAI] script loaded");
  waitForMount(init);
})();
