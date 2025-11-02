/* widget.js
 * ReflectivAI Chat/Coach — drop-in (coach-v2, deterministic scoring v3) + RP hardening r10
 * Modes: emotional-assessment | product-knowledge | sales-simulation | role-play
 *
 * FIXED ROOT CAUSES:
 * 1) HCP-only enforcement in RP (multi-pass rewrite + imperative/pronoun repair + final strip) – only triggers on leak
 * 2) Robust <coach>{...}</coach> parsing with brace-matching (truncation tolerant)
 * 3) Mode drift guardrails + speaker chips + per-mode prefaces
 * 4) Duplicate/cycling response lock with semantic similarity + anti-echo + clamps
 * 5) Network/timeout hardening (3 tries, 45s timeout, safe fallbacks)
 * 6) Scenario cascade (Disease → HCP) with resilient loaders + de-dupe
 * 7) Rep-only evaluation command (“Evaluate Rep”) with side-panel injection
 * 8) EI quick panel (persona/feature → empathy/stress + hints)
 * 9) Mode-aware fallbacks to stop HCP-voice leakage in Sales Simulation
 */
(function () {
  // ---------- safe bootstrapping ----------
  let mount = null;

  function onReady(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn, { once: true });
    } else {
      fn();
    }
  }

  function waitForMount(cb) {
    const findMount = () =>
      document.getElementById("reflectiv-widget") ||
      document.querySelector("#coach-widget, [data-coach-mount], .reflectiv-widget");

    const tryGet = () => {
      mount = findMount();
      if (mount) return cb();

      const obs = new MutationObserver(() => {
        mount = findMount();
        if (mount) {
          obs.disconnect();
          cb();
        }
      });

      obs.observe(document.documentElement, { childList: true, subtree: true });
      setTimeout(() => obs.disconnect(), 15000);
    };

    onReady(tryGet);
  }

  // ---------- config/state ----------
  const LC_OPTIONS = ["Emotional Intelligence", "Product Knowledge", "Sales Simulation", "Role Play"];
  const LC_TO_INTERNAL = {
    "Emotional Intelligence": "emotional-assessment",
    "Product Knowledge": "product-knowledge",
    "Sales Simulation": "sales-simulation",
    "Role Play": "role-play"
  };

  let cfg = null;
  let systemPrompt = "";
  let eiHeuristics = "";
  let scenarios = [];
  let scenariosById = new Map();

  let currentMode = "sales-simulation";
  let currentScenarioId = null;
  let conversation = [];
  let coachOn = true;

  // ---------- EI globals ----------
  let personaSelectElem = null;
  let eiFeatureSelectElem = null;
  let feedbackDisplayElem = null;
  let personaLabelElem = null;
  let featureLabelElem = null;
  let lastUserMessage = "";

  // ---------- Rep-only eval panel store ----------
  let repOnlyPanelHTML = "";

  // ---------- EI defaults ----------
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

  // ---------- utils ----------
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

  // --- Worker base normalizer + tiny JSON fetch helper ---
  // Ensures add-on calls like jfetch("/plan") hit the base (…/plan), even when config points to …/chat
  function getWorkerBase() {
    const raw =
      (window.COACH_ENDPOINT || window.WORKER_URL || (cfg && (cfg.apiBase || cfg.workerUrl)) || "").trim();
    if (!raw) return "";
    // Strip trailing /chat (with or without slash), then trailing slashes
    return raw.replace(/\/chat\/?$/i, "").replace(/\/+$/g, "");
  }

  async function jfetch(path, payload) {
    const base = getWorkerBase();
    if (!base) throw new Error("worker_base_missing");
    const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
    
    // Retry logic with exponential backoff for 429/5xx errors
    const delays = [300, 800, 1500];
    let lastError = null;
    
    for (let attempt = 0; attempt < delays.length + 1; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort("timeout"), 10000); // 10s timeout
      
      try {
        const r = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload || {}),
          signal: controller.signal
        });
        
        clearTimeout(timeout);
        
        if (r.ok) {
          return await r.json();
        }
        
        // Check if we should retry (429 or 5xx errors)
        if (attempt < delays.length && (r.status === 429 || r.status >= 500)) {
          lastError = new Error(`${path}_http_${r.status}`);
          await new Promise(resolve => setTimeout(resolve, delays[attempt]));
          continue;
        }
        
        throw new Error(`${path}_http_${r.status}`);
      } catch (e) {
        clearTimeout(timeout);
        
        // Retry on timeout or network errors
        if (attempt < delays.length && /timeout|TypeError|NetworkError/i.test(String(e))) {
          lastError = e;
          await new Promise(resolve => setTimeout(resolve, delays[attempt]));
          continue;
        }
        
        throw e;
      }
    }
    
    throw lastError || new Error(`${path}_failed_after_retries`);
  }

  // mode-aware fallback lines
  function fallbackText(mode){
    if(mode === "sales-simulation"){
      return "Keep it concise. Acknowledge the HCP’s context, give one actionable tip, then end with a single discovery question.";
    }
    if(mode === "product-knowledge"){
      return "Brief overview: indication, one efficacy point, one safety consideration. Cite label or guideline.";
    }
    if(mode === "role-play"){
      return "In my clinic, we review histories, behaviors, and adherence to guide decisions.";
    }
    // emotional-assessment
    return "Reflect on tone. Note one thing that worked and one to improve, then ask yourself one next question.";
  }

  // sentence helpers
  function splitSentences(text) {
    const t = String(text || "");
    return t.replace(/\s+/g, " ").match(/[^.!?]+[.!?]?/g) || [];
  }

  // --- shared leak patterns
  const BRAND_RE = /\b(descovy|biktarvy|cabenuva|truvada|prep)\b/i;
  const PROMO_ARTIFACTS_RE =
    /\b(educational (resources?|materials?)|training session|in-?service|lunch-?and-?learn|handout|one-?pager|brochure|leave-?behind|job aid|script|slide deck|webinar|office hours)\b/i;
  const FIRST_PERSON_OFFER_RE =
    /\b((?:i|we)\s+(?:can\s+)?(?:provide|offer|arrange|conduct|deliver|send|share|supply|set up|schedule|organize|host|walk (?:you|your team) through|train|educate))\b/i;
  const OFFER_OR_TRAINING_WORD_RE =
    /\b(offer|provide|train|training|educate|education|materials?|resources?|handouts?|brochures?|one-?pagers?|scripts?)\b/i;

  // ---------- Role-play sanitizer ----------
  function sanitizeRolePlayOnly(text) {
    let s = String(text || "");

    // drop everything after accidental <coach>
    const coachIdx = s.indexOf("<coach>");
    if (coachIdx >= 0) s = s.slice(0, coachIdx);

    s = s.replace(/<coach>[\s\S]*?<\/coach>/gi, "");
    s = s.replace(
      /(?:^|\n)\s*(?:\*\*)?\s*(?:Sales\s*Guidance|Challenge|(?:My|Rep)\s*Approach|Impact)\s*(?:\*\*)?\s*:\s*[\s\S]*?(?=\n\s*\n|$)/gmi,
      ""
    );

    // strip speaker/meta
    s = s.replace(/^(?:Assistant|Coach|System|Rep|User|Sales Rep)\s*:\s*/gmi, "");
    s = s.replace(/^\s*["“']?\s*(hi|hello|hey)\b.*$/gmi, "");

    // markdown cleanup
    s = s.replace(/^\s*[-*]\s+/gm, "");
    s = s.replace(/^\s*#{1,6}\s+.*$/gm, "");
    s = s.replace(/^\s*>\s?/gm, "");

    // POV convert “your clinic” nouns
    const nouns =
      "(patients?|panel|clinic|practice|workflow|nurses?|staff|team|MA|MAs|prescribing|prescriptions|criteria|approach)";
    s = s.replace(new RegExp(`\\byour\\s+${nouns}\\b`, "gi"), (m) => m.replace(/\byour\b/i, "my"));

    const IMPERATIVE_START =
      /^(ask|emphasize|consider|provide|offer|educate|ensure|recommend|suggest|discuss|address|reinforce|encourage|support)\b/i;

    const sentences = splitSentences(s)
      .map((sentRaw) => {
        let sent = sentRaw.trim();
        if (!sent) return "";

        const isQ = /\?\s*$/.test(sent);
        const hasYou = /\byou(r)?\b/i.test(sent);
        const repDiscoveryCue =
          /(how\s+do\s+you|can\s+we\s+review\s+your|can\s+you\s+(?:share|explain|present|go over)|help\s+me\s+understand\s+your|what\s+do\s+you\s+do|how\s+are\s+you\s+identif|walk\s+me\s+through)/i.test(
            sent
          );

        // Normalize rep-facing asks to HCP statements
        if (isQ && (hasYou || /walk\s+me\s+through/i.test(sent)) && repDiscoveryCue) {
          sent = sent
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

        // convert imperative openings to first-person
        if (IMPERATIVE_START.test(sent)) {
          const rest = sent.replace(IMPERATIVE_START, "").replace(/^[:,\s]+/, "");
          sent = `In my clinic, I ${rest}`.replace(/\?\s*$/, ".").trim();
        }

        // rewrite first-person offers or training talk
        if (FIRST_PERSON_OFFER_RE.test(sent) || (/(?:^|\b)(?:i|we)\b/i.test(sent) && OFFER_OR_TRAINING_WORD_RE.test(sent))) {
          sent =
            "In my practice, I rely on our internal processes and current guidelines. My focus is on patient selection and follow-up.";
        }

        // repair malformed pronouns from rewrites
        sent = sent
          .replace(/\bcan\s+i\s+walk\s+me\s+through\b/gi, "I would like to review")
          .replace(/\bi\s+walk\s+me\s+through\b/gi, "I review")
          .replace(/\bwalk\s+me\s+through\b/gi, "review")
          .replace(/\bcan\s+i\s+(share|explain|present|go\s+over)\b/gi, "I would like to review");

        if (/I would like to review/i.test(sent)) sent = sent.replace(/\?\s*$/, ".").trim();

        return sent;
      })
      .filter(Boolean);

    s = sentences.join(" ").trim();

    // de-coachify generic prompts
    s = s.replace(/\bcan you tell me\b/gi, "I’m considering");
    s = s.replace(/\bhelp me understand\b/gi, "I want to understand");
    s = s.replace(/\bwhat would it take to\b/gi, "Here’s what I’d need to");

    s = s.replace(/\*\*(?=\s|$)/g, "");
    s = s.replace(/^[“"']|[”"']$/g, "");
    s = s.replace(/\s{2,}/g, " ").trim();

    if (!s) s = "From my perspective, we evaluate high-risk patients using history, behaviors, and adherence context.";
    return s;
  }

  // --------- COACH/GUIDANCE LEAK GUARD (Role Play only) ----------
  function isGuidanceLeak(txt) {
    const t = String(txt || "");

    const imperativeStart =
      /(?:^|\s[.“"'])\s*(ask|emphasize|consider|provide|offer|educate|ensure|recommend|suggest|discuss|address|reinforce|encourage|support)\b/i;

    const secondPersonGuidance = /\b(emphasize|ensure|educate|recommend|suggest|encourage|support|provide|offer)\b.*\b(you|your)\b/i;

    const cues = [
      /\b(you should|you can|i recommend|i suggest|best practice|here'?s how|you’ll want to)\b/i,
      /\b(coaching|guidance|sales guidance|coach)\b/i,
      secondPersonGuidance,
      /^[-*]\s/m,
      /<coach>|\bworked:|\bimprove:/i,
      imperativeStart
    ];

    const generalHits = cues.filter((re) => re.test(t)).length >= 2;

    const offerHit =
      FIRST_PERSON_OFFER_RE.test(t) ||
      ((/^(?:i|we)\b/i.test(t)) && OFFER_OR_TRAINING_WORD_RE.test(t) && /staff|team|your\s+staff/i.test(t));

    const artifactHit = PROMO_ARTIFACTS_RE.test(t) || BRAND_RE.test(t);

    return generalHits || offerHit || artifactHit;
  }

  function correctiveRails(sc) {
    const personaLine =
      sc && (sc.hcpRole || sc.label)
        ? `HCP Persona: ${sc.hcpRole || sc.label}. Disease: ${sc.therapeuticArea || sc.diseaseState || "—"}.`
        : "";
    return [
      `Rewrite strictly as the HCP.`,
      `First-person. 2–4 sentences. No advice to the rep. No “you/your” guidance.`,
      `No lists, no headings, no rubric, no JSON, no "<coach>".`,
      `Do not make offers like "I can provide/offer/arrange training, resources, handouts, or scripts," and do not propose to educate the rep or their staff.`,
      `Describe your own clinical approach. If you ask a question, it must be about your clinic/patients.`,
      personaLine
    ].join("\n");
  }

  async function enforceHcpOnly(replyText, sc, messages, callModelFn) {
    // PATCH A: only rewrite if a leak is detected
    let out = String(replyText || "").trim();
    if (!isGuidanceLeak(out)) return sanitizeLLM(out);
    out = sanitizeRolePlayOnly(out);

    // Pass 1: rewrite under stricter rails
    const rewriteMsgs = [
      { role: "system", content: correctiveRails(sc) },
      { role: "user", content: out }
    ];
    try {
      const r1 = await callModelFn(rewriteMsgs);
      out = sanitizeRolePlayOnly(r1);
      if (!isGuidanceLeak(out)) return out;
    } catch (_) {}

    // Pass 2: fresh completion with corrective rails prepended to original convo
    try {
      const hardened = [{ role: "system", content: correctiveRails(sc) }, ...messages];
      const r2 = await callModelFn(hardened);
      out = sanitizeRolePlayOnly(r2);
      if (!isGuidanceLeak(out)) return out;
    } catch (_) {}

    // Pass 3: last-ditch strip + diversified variants (PATCH D)
    out = out.replace(
      new RegExp(
        String.raw`(?:^|\s)(?:I|We)\s+(?:can\s+)?(?:provide|offer|arrange|conduct|deliver|send|share|supply|set up|schedule|organize|host|walk (?:you|your team) through|train|educate)\b[^.!?]*[.!?]\s*`,
        "gi"
      ),
      ""
    );
    out = out.replace(new RegExp(String.raw`${PROMO_ARTIFACTS_RE.source}[^.!?]*[.!?]\s*`, "gi"), "");
    out = out
      .replace(/\b(i recommend|i suggest|consider|you should|you can|best practice)\b[^.!?]*[.!?]\s*/gi, "")
      .replace(/\b(emphasize|ensure|educate|recommend|suggest|encourage|support|provide|offer)\b[^.!?]*\b(you|your)\b[^.!?]*[.!?]\s*/gi, "")
      .replace(
        /^(ask|emphasize|consider|provide|offer|educate|ensure|recommend|suggest|discuss|address|reinforce|encourage|support)\b[^.!?]*[.!?]\s*/gim,
        ""
      )
      .trim();

    if (!out) {
      const variants = [
        "In my clinic, initial risk assessment drives the plan; we confirm eligibility, counsel, and arrange an early follow-up.",
        "I look at recent exposures and adherence risks, choose an appropriate option, and schedule a check-in within a month.",
        "We review history and labs, agree on an initiation pathway, and monitor early to ensure tolerability and adherence."
      ];
      out = variants[Math.floor(Math.random() * variants.length)];
    }
    return out;
  }

  // --- label normalizer: convert any “My Approach” text to “Rep Approach”
  function normalizeGuidanceLabels(text) {
    if (!text) return "";
    return String(text).replace(/\bMy\s*Approach\b/gi, "Rep Approach");
  }

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

  // ---------- Legacy Coach Renderer (RESTORED UI) ----------
  const USE_LEGACY_COACH_UI = true;

  function renderLegacyCoachCard(coachObj) {
    const challenge =
      coachObj.challenge || coachObj.feedback || "Focus on label-aligned guidance and one clear question.";
    const repApproach = Array.isArray(coachObj.worked) && coachObj.worked.length
      ? coachObj.worked
      : ["Acknowledge context", "Cite one fact", "End with a discovery question"];
    const impact = Array.isArray(coachObj.improve) && coachObj.improve.length
      ? coachObj.improve
      : ["Drive a next step", "One idea per sentence", "Avoid off-label statements"];
    const phrasing =
      coachObj.phrasing || "Would confirming eGFR today help you identify one patient to start this month?";

    const card = document.createElement("div");
    card.className = "coach-card legacy";
    card.innerHTML = `
      <div class="coach-head">
        <span class="coach-badge">Sales Coach</span>
      </div>

      <div class="coach-section">
        <div class="coach-label">Challenge:</div>
        <div class="coach-body">${esc(challenge)}</div>
      </div>

      <div class="coach-section">
        <div class="coach-label">Rep Approach:</div>
        <ul class="coach-list">
          ${repApproach.map(i => `<li>${esc(i)}</li>`).join("")}
        </ul>
      </div>

      <div class="coach-section">
        <div class="coach-label">Impact:</div>
        <ul class="coach-list">
          ${impact.map(i => `<li>${esc(i)}</li>`).join("")}
        </ul>
      </div>

      ${(() => {
        const phr = (coachObj.suggested_phrasing || coachObj.phrasing || "").trim();
        return phr ? `<p><strong>Suggested Phrasing:</strong> "${esc(phr)}"</p>` : "";
      })()}

      <div class="coach-section">
        <div class="coach-label">Suggested Phrasing:</div>
        <div class="coach-quote">“${esc(phrasing)}”</div>
      </div>
    `;
    return card;
  }

  // Call this when you want to inject a coach card into the thread container
  function renderCoachMessage(container, coachObj) {
    if (USE_LEGACY_COACH_UI) {
      container.appendChild(renderLegacyCoachCard(coachObj || {}));
      return;
    }
    // keep your newer renderer here if you want it as a fallback
  }

  // --- Parse labeled text format (e.g., "Challenge: ...\nRep Approach: ...")
  function parseLabeledText(text) {
    const s = String(text || "").trim();
    if (!s) return null;

    const parsed = {};
    
    // Try to extract Challenge
    const challengeMatch = s.match(/(?:^|\n)\s*Challenge\s*:\s*(.+?)(?=\n\s*(?:Rep Approach|Impact|Suggested Phrasing):|$)/is);
    if (challengeMatch) parsed.challenge = challengeMatch[1].trim();
    
    // Try to extract Rep Approach (as array of items)
    const repApproachMatch = s.match(/(?:^|\n)\s*Rep Approach\s*:\s*(.+?)(?=\n\s*(?:Impact|Suggested Phrasing):|$)/is);
    if (repApproachMatch) {
      const items = repApproachMatch[1]
        .split(/\n/)
        .map(x => x.trim().replace(/^[-•*]\s*/, ''))
        .filter(Boolean);
      parsed.rep_approach = items.length > 0 ? items : [repApproachMatch[1].trim().replace(/\n/g, ' ')];
    }
    
    // Try to extract Impact (as array of items)
    const impactMatch = s.match(/(?:^|\n)\s*Impact\s*:\s*(.+?)(?=\n\s*Suggested Phrasing:|$)/is);
    if (impactMatch) {
      const items = impactMatch[1]
        .split(/\n/)
        .map(x => x.trim().replace(/^[-•*]\s*/, ''))
        .filter(Boolean);
      parsed.impact = items.length > 0 ? items : [impactMatch[1].trim().replace(/\n/g, ' ')];
    }
    
    // Try to extract Suggested Phrasing (may span multiple lines)
    const phrasingMatch = s.match(/(?:^|\n)\s*Suggested Phrasing\s*:\s*(.+?)(?=\n\s*(?:Challenge|Rep Approach|Impact):|$)/is);
    if (phrasingMatch) parsed.suggested_phrasing = phrasingMatch[1].trim().replace(/^["']|["']$/g, '').replace(/\n/g, ' ');
    
    return Object.keys(parsed).length > 0 ? parsed : null;
  }

  // --- Normalize coach data from different formats
  function normalizeCoachData(coach) {
    if (!coach) return null;
    
    const normalized = { ...coach };
    
    // Map alternative field names to standard names
    if (coach.challenge && !coach.feedback) {
      normalized.feedback = coach.challenge;
    }
    if (coach.rep_approach && !coach.worked) {
      normalized.worked = Array.isArray(coach.rep_approach) ? coach.rep_approach : [coach.rep_approach];
    }
    if (coach.impact && !coach.improve) {
      normalized.improve = Array.isArray(coach.impact) ? coach.impact : [coach.impact];
    }
    if (coach.suggested_phrasing && !coach.phrasing) {
      normalized.phrasing = coach.suggested_phrasing;
    }
    
    return normalized;
  }

  // --- robust extractor: tolerates missing </coach> and truncation
  function extractCoach(raw) {
    const s = String(raw || "");
    const openIdx = s.indexOf("<coach>");
    if (openIdx === -1) return { coach: null, clean: sanitizeLLM(s) };

    const head = s.slice(0, openIdx);
    const tail = s.slice(openIdx + "<coach>".length);

    const closeIdx = tail.indexOf("</coach>");
    let block = closeIdx >= 0 ? tail.slice(0, closeIdx) : tail;

    const braceStart = block.indexOf("{");
    if (braceStart === -1) {
      // Try parsing as labeled text
      const labeled = parseLabeledText(block);
      if (labeled) {
        return { coach: normalizeCoachData(labeled), clean: sanitizeLLM(head) };
      }
      return { coach: null, clean: sanitizeLLM(head) };
    }

    let depth = 0, end = -1;
    for (let i = braceStart; i < block.length; i++) {
      const ch = block[i];
      if (ch === "{") depth++;
      if (ch === "}") depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
    if (end === -1) return { coach: null, clean: sanitizeLLM(head) };

    const jsonTxt = block.slice(braceStart, end + 1);
    let coach = {};
    try {
      coach = JSON.parse(jsonTxt);
      coach = normalizeCoachData(coach);
    } catch (e) {
      console.warn("Coach JSON parse error", e);
      // Try parsing as labeled text as fallback
      const labeled = parseLabeledText(block);
      if (labeled) {
        coach = normalizeCoachData(labeled);
      }
    }
    const after = closeIdx >= 0 ? tail.slice(closeIdx + "</coach>".length) : "";
    const clean = sanitizeLLM((head + " " + after).trim());
    return { coach, clean };
  }

  // ---------- local scoring (deterministic v3) ----------
  function scoreReply(userText, replyText) {
    const text = String(replyText || "");
    const t = text.toLowerCase();
    const words = text.split(/\s+/).filter(Boolean).length;
    const endsWithQ = /\?\s*$/.test(text);
    const inRange = (n, a, b) => n >= a && n <= b;

    const sig = {
      label: /(per label|fda\s*label|indication|contraindication|boxed warning|guideline|fda)/i.test(text),
      discovery: endsWithQ || /(how|what|could you|can you|help me understand|walk me|clarify)\b/i.test(t),
      objection: /(concern|barrier|risk|coverage|auth|denied|cost|workflow|adherence|side effect|safety)/i.test(t),
      empathy: /(i understand|appreciate|given your time|thanks for|i hear|it sounds like)/i.test(t),
      accuracyCue:
        /(renal|egfr|creatinine|bmd|resistance|ddi|interaction|efficacy|safety|adherence|formulary|access|prior auth|prep|tdf|taf|bictegravir|cabotegravir|rilpivirine|descovy|biktarvy|cabenuva)/i.test(
          t
        ),
      tooLong: words > 220,
      idealLen: inRange(words, 45, 160)
    };

    const accuracy = sig.accuracyCue ? (sig.label ? 5 : 4) : 3;
    const compliance = sig.label ? 5 : 3;
    const discovery = sig.discovery ? 4 : 2;
    const objection_handling = sig.objection ? (sig.accuracyCue ? 4 : 3) : 2;
    const empathy = sig.empathy ? 3 : 2;
    const clarity = sig.tooLong ? 2 : sig.idealLen ? 4 : 3;

    const W = { accuracy: 0.26, compliance: 0.22, discovery: 0.16, objection_handling: 0.14, clarity: 0.12, empathy: 0.1 };
    const toPct = (v) => v * 20;

    let overall =
      toPct(accuracy) * W.accuracy +
      toPct(compliance) * W.compliance +
      toPct(discovery) * W.discovery +
      toPct(objection_handling) * W.objection_handling +
      toPct(clarity) * W.clarity +
      toPct(empathy) * W.empathy;
    if (sig.idealLen) overall += 3;
    if (endsWithQ) overall += 3;
    if (sig.tooLong) overall -= 6;
    overall = Math.max(0, Math.min(100, Math.round(overall)));

    const worked = [
      sig.empathy ? "Acknowledge HCP context" : null,
      sig.discovery ? "Close with a clear discovery question" : null,
      sig.label ? "Reference label or guidelines" : null,
      sig.accuracyCue ? "Tie points to clinical cues" : null
    ].filter(Boolean);

    const improve = [
      sig.tooLong ? "Keep to 3–5 sentences" : null,
      sig.discovery ? null : "End with one specific question",
      sig.label ? null : "Anchor claims to label or guideline",
      clarity < 4 ? "Use one idea per sentence" : null
    ].filter(Boolean);

    const phrasing = sig.discovery
      ? "Given your criteria, which patients would be the best fit to start, and what would help you try one this month?"
      : "Would it help to align on eligibility criteria and agree on one next step for your earliest appropriate patient?";

    return {
      overall,
      scores: { accuracy, empathy, clarity, compliance, discovery, objection_handling },
      feedback:
        "Be concise, cite label or guidelines for clinical points, ask one focused discovery question, and propose a concrete next step.",
      worked,
      improve,
      phrasing,
      context: { rep_question: String(userText || ""), hcp_reply: String(replyText || "") },
      score: overall,
      subscores: { accuracy, empathy, clarity, compliance, discovery, objection_handling }
    };
  }

  // ---------- EI scoring ----------
  function calculateEmpathyRating(personaKey, message) {
    if (!message) return 0;
    const text = String(message || "").toLowerCase();
    let score = 0;
    switch (personaKey) {
      case "difficult": score = 1; break;
      case "busy": score = 2; break;
      case "engaged": score = 4; break;
      case "indifferent": score = 3; break;
      default: score = 3;
    }
    ["understand","appreciate","concern","feel","sorry","hear","sounds like","empathize","thanks","acknowledge"].forEach((kw)=>{ if(text.includes(kw)) score++; });
    return Math.min(5, score);
  }

  function calculateStressRating(personaKey, message) {
    if (!message) return 0;
    const text = String(message || "").toLowerCase();
    let score = 0;
    switch (personaKey) {
      case "difficult": score = 4; break;
      case "busy": score = 5; break;
      case "engaged": score = 2; break;
      case "indifferent": score = 3; break;
      default: score = 3;
    }
    ["stress","busy","overwhelmed","frustrated","tired","pressure","deadline"].forEach((kw)=>{ if(text.includes(kw)) score++; });
    return Math.min(5, score);
  }

  // ---------- EI feedback text ----------
  function generateDynamicFeedback(personaKey, featureKey) {
    if (!personaKey || !featureKey) return "";
    if (featureKey === "empathy") {
      if (personaKey === "difficult") return "Acknowledge frustration and keep voice calm. Use short validating phrases before you propose next steps.";
      if (personaKey === "busy") return "Empathize in one line, then get to the point. Lead with the outcome and time saved.";
      if (personaKey === "engaged") return "Reinforce collaboration. Thank them for input and ask one specific next question.";
      if (personaKey === "indifferent") return "Validate neutrality, then pivot to patient impact and one meaningful benefit.";
      return "Match tone to the HCP and show you understand their context before offering guidance.";
    }
    if (featureKey === "stress") {
      if (personaKey === "difficult") return "Stress likely high. Keep it brief and reassuring. Remove jargon.";
      if (personaKey === "busy") return "Time pressure high. Bottom line first. Offer one low-effort next step.";
      if (personaKey === "engaged") return "Moderate stress. Provide clear info and invite collaboration.";
      if (personaKey === "indifferent") return "Average stress. Build rapport through patient-centered framing.";
      return "Adjust tone to stress level. Reduce cognitive load and give clear choices.";
    }
    if (featureKey === "listening") {
      if (personaKey === "difficult") return "Reflect back their words. Confirm you got it right, then ask a short clarifier.";
      if (personaKey === "busy") return "Summarize their point in one sentence. Ask one yes or no clarifier.";
      if (personaKey === "engaged") return "Affirm insights and build on them. Use clarifying questions to deepen trust.";
      if (personaKey === "indifferent") return "Use light affirmations to draw them in. Ask a simple patient-impact question.";
      return "Use reflective and clarifying questions. Keep it concise.";
    }
    if (featureKey === "validation") {
      if (personaKey === "difficult") return "Validate frustration first. Reframe around shared goals and patient outcomes.";
      if (personaKey === "busy") return "Validate time constraints. Reframe to efficiency and workflow fit.";
      if (personaKey === "engaged") return "Validate expertise. Reframe to partnership and quick experimentation.";
      if (personaKey === "indifferent") return "Validate neutrality. Reframe to meaningful benefits for a typical patient.";
      return "Validate perspective and reframe to collaboration and patient value.";
    }
    return "Select a valid EI feature for targeted guidance.";
  }

  // ---------- EI feedback render ----------
  function generateFeedback() {
    if (!feedbackDisplayElem) return;
    if (currentMode !== "emotional-assessment") { feedbackDisplayElem.innerHTML = ""; return; }

    const personaKey = personaSelectElem && personaSelectElem.value;
    const featureKey = eiFeatureSelectElem && eiFeatureSelectElem.value;

    if (!personaKey || !featureKey || !lastUserMessage) {
      feedbackDisplayElem.innerHTML = `<span class="muted">Select a persona and EI feature, then send a message to see feedback.</span>`;
      return;
    }

    let rating = null;
    if (featureKey === "empathy") rating = calculateEmpathyRating(personaKey, lastUserMessage);
    else if (featureKey === "stress") rating = calculateStressRating(personaKey, lastUserMessage);

    const featureList = (cfg?.eiFeatures && cfg.eiFeatures.length ? cfg.eiFeatures : DEFAULT_EI_FEATURES);
    const featureObj = featureList.find((f) => f.key === featureKey || f.value === featureKey || f.id === featureKey);
    const featureLabel = featureObj ? featureObj.label || featureKey : featureKey;
    const fbTxt = generateDynamicFeedback(personaKey, featureKey);

    feedbackDisplayElem.innerHTML =
      rating == null
        ? `<strong>${esc(featureLabel)}</strong><br><p>${esc(fbTxt)}</p>`
        : `<strong>${esc(featureLabel)}: ${rating}/5</strong><br><p>${esc(fbTxt)}</p>`;
  }

  // ---------- persona context ----------
  function currentPersonaHint() {
    const sc = scenariosById.get(currentScenarioId);
    if (sc && (sc.hcpRole || sc.label)) {
      const dz = sc.therapeuticArea || sc.diseaseState || "—";
      const who = sc.hcpRole || sc.label;
      return `HCP Persona: ${who}. Disease: ${dz}.`;
    }
    const p = personaSelectElem && personaSelectElem.value;
    if (p) return `HCP Persona: ${p}.`;
    return "";
  }

  // ---------- prompt preface ----------
  function buildPreface(mode, sc) {
    const COMMON = `# ReflectivAI — Output Contract
Return exactly two parts. No code blocks. No markdown headings.
1) Sales Guidance: short, actionable, accurate guidance.
2) <coach>{
     "overall": 0-100,
     "scores": { "accuracy":0-5,"empathy":0-5,"clarity":0-5,"compliance":0-5,"discovery":0-5,"objection_handling":0-5 },
     "worked": ["…"],
     "improve": ["…"],
     "phrasing": "…",
     "feedback": "one concise paragraph",
     "context": { "rep_question":"...", "hcp_reply":"..." }
   }</coach>`;

    const personaLine = currentPersonaHint();

    if (mode === "sales-simulation") {
      return (
        `# Role
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
- 3–4 sentences and one closing question. No lists longer than 2 bullets.
- Only appropriate, publicly known, label-aligned facts.
- No pricing advice or PHI. No off-label.
- Include a clearly labeled "Suggested Phrasing:" section as part of the chat response.

${COMMON}`
      ).trim();
    }

    if (mode === "product-knowledge") {
      return `Return a concise educational overview with reputable citations. Structure: key takeaways; mechanism/indications; safety/contraindications; efficacy; access notes; references.`.trim();
    }

    if (mode === "role-play") {
      return (
        `# Role Play Contract — HCP Only
You are the Healthcare Provider. Reply ONLY as the HCP. First-person. Realistic, concise clinical dialogue.
${personaLine}
If the user types "Evaluate this exchange" or "Give feedback", step out of role and return EI-based reflection.

Hard bans:
- Do NOT output coaching, rubrics, scores, JSON, or any "<coach>" block.
- Do NOT output headings or bullet lists.
- Do NOT ask the rep about the rep’s process, approach, or clinic metrics.
- Do NOT interview the rep with sales-discovery prompts.
- Do NOT make offers like "I can provide/offer/arrange training, resources, handouts, or scripts," and do NOT propose to educate the rep or their staff.
- Do NOT propose support, resources, training, education, materials, webinars, or handouts for the rep or their staff.

Allowable questions from HCP:
- Clarify therapy, safety, logistics, coverage, workflow impact.
- Questions must reflect HCP’s POV (“my clinic”, “my patients”, “our team”).

Output only the HCP utterance.`
      ).trim();
    }

    // emotional-assessment
    return (
      `Provide brief self-reflection tips tied to HCP communication.
- 3–5 sentences, then one reflective question.

${COMMON}`
    ).trim();
  }

  // ---------- UI ----------
  function buildUI() {
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
#reflectiv-widget .chat-messages{min-height:220px;height:auto;max-height:none;overflow:auto;padding:12px 14px;background:#fafbfd}
#reflectiv-widget .message{margin:8px 0;display:flex}
#reflectiv-widget .message.user{justify-content:flex-end}
#reflectiv-widget .message.assistant{justify-content:flex-start}
#reflectiv-widget .message .content{max-width:85%;line-height:1.45;font-size:14px;padding:10px 12px;border-radius:14px;border:1px solid #d6dbe3;color:#0f1522;background:#e9edf3}
#reflectiv-widget .message.user .content{background:#e0e0e0;color:#000}
#reflectiv-widget .chat-input{display:flex;gap:8px;padding:10px 12px;border-top:1px solid #e1e6ef;background:#fff}
#reflectiv-widget .chat-input textarea{flex:1;resize:none;min-height:44px;max-height:120px;padding:10px 12px;border:1px solid #cfd6df;border-radius:10px;outline:none}
#reflectiv-widget .chat-input .btn{min-width:86px;border:0;border-radius:999px;background:#2f3a4f;color:#fff;font-weight:600}
#reflectiv-widget .coach-section{margin-top:0;padding:12px 14px;border:1px solid #e1e6ef;border-radius:12px;background:#fffbe8}
#reflectiv-widget .coach-subs .pill{display:inline-block;padding:2px 8px;margin-right:6px;font-size:12px;background:#f1f3f7;border:1px solid #d6dbe3;border-radius:999px}
#reflectiv-widget .scenario-meta .meta-card{padding:10px 12px;background:#f7f9fc;border:1px solid #e1e6ef;border-radius:10px}
#reflectiv-widget .hidden{display:none!important}
#reflectiv-widget .speaker{display:inline-block;margin:0 0 6px 2px;padding:2px 8px;font-size:11px;font-weight:700;border-radius:999px;border:1px solid #cfd6df}
#reflectiv-widget .speaker.hcp{background:#eef4ff;color:#0f2a6b;border-color:#c9d6ff}
#reflectiv-widget .speaker.rep{background:#e8fff2;color:#0b5a2a;border-color:#bfeacc}
#reflectiv-widget .speaker.coach{background:#fff0cc;color:#5a3d00;border-color:#ffe3a1}
#reflectiv-widget .typing-dots{display:inline-flex;gap:4px;align-items:center}
#reflectiv-widget .typing-dots span{display:inline-block;width:6px;height:6px;border-radius:50%;background:#2f3a4f;animation:typing-bounce 1.4s infinite ease-in-out both}
#reflectiv-widget .typing-dots span:nth-child(1){animation-delay:-0.32s}
#reflectiv-widget .typing-dots span:nth-child(2){animation-delay:-0.16s}
@keyframes typing-bounce{0%,80%,100%{transform:scale(0)}40%{transform:scale(1)}}
#reflectiv-widget .retry-ui .retry-btn{cursor:pointer;transition:background 0.2s}
#reflectiv-widget .retry-ui .retry-btn:hover{background:#1f2a3f}
#reflectiv-widget .streaming .content{background:#f0f7ff;border-color:#b3d9ff}
@media (max-width:900px){#reflectiv-widget .sim-controls{grid-template-columns:1fr;gap:8px}#reflectiv-widget .sim-controls label{justify-self:start}}
@media (max-width:520px){#reflectiv-widget .chat-messages{height:46vh}}
      `;
      document.head.appendChild(style);
    }

    // shell + skeleton
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

    // rebuild real UI
    const bar = el("div", "chat-toolbar");
    const simControls = el("div", "sim-controls");

    const lcLabel = el("label", "", "Learning Center");
    lcLabel.htmlFor = "cw-mode";
    const modeSel = el("select");
    modeSel.id = "cw-mode";
    LC_OPTIONS.forEach((name) => {
      const o = el("option");
      o.value = name;
      o.textContent = name;
      modeSel.appendChild(o);
    });
    const initialLc =
      Object.keys(LC_TO_INTERNAL).find((k) => LC_TO_INTERNAL[k] === (cfg?.defaultMode || "sales-simulation")) ||
      "Sales Simulation";
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
    const diseaseSelect = el("select");
    diseaseSelect.id = "cw-disease";

    const hcpLabel = el("label", "", "HCP Profiles");
    hcpLabel.htmlFor = "cw-hcp";
    const hcpSelect = el("select");
    hcpSelect.id = "cw-hcp";

    // EI Persona/EI Feature
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

    const PERSONAS_ALL =
      Array.isArray(cfg?.eiProfiles) && cfg.eiProfiles.length ? cfg.eiProfiles : DEFAULT_PERSONAS;

    const FEATURES_ALL_RAW =
      (Array.isArray(cfg?.eiFeatures) && cfg.eiFeatures.length && cfg.eiFeatures) ||
      (Array.isArray(cfg?.features) && cfg.features.length && cfg.features) ||
      DEFAULT_EI_FEATURES;

    const FEATURES_ALL = FEATURES_ALL_RAW.map((f) =>
      typeof f === "string" ? { key: f.toLowerCase().replace(/\s+/g, "-"), label: f } : f
    );

    function hydrateEISelects() {
      if (!personaSelectElem || !eiFeatureSelectElem) return;
      personaSelectElem.innerHTML = "";
      eiFeatureSelectElem.innerHTML = "";
      personaSelectElem.disabled = false;
      eiFeatureSelectElem.disabled = false;

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
        const val = p.key || p.value || p.id || String(p).toLowerCase().replace(/\s+/g, "-");
        const lab = p.label || p.name || p.title || String(p);
        o.value = val;
        o.textContent = lab;
        personaSelectElem.appendChild(o);
      });

      FEATURES_ALL.forEach((f) => {
        const o = document.createElement("option");
        const val = f.key || f.value || f.id || String(f).toLowerCase().replace(/\s+/g, "-");
        const lab = f.label || f.name || f.title || String(f);
        o.value = val;
        o.textContent = lab;
        eiFeatureSelectElem.appendChild(o);
      });

      if (!FEATURES_ALL.length) console.warn("EI features list is empty; check config keys (eiFeatures/features).");
    }

    // mount controls
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

    // Enter throttle
    let lastKeyTs = 0;
    ta.addEventListener("keydown", (e) => {
      const now = Date.now();
      if (e.key === "Enter" && !e.shiftKey) {
        if (now - lastKeyTs < 250) return; // throttle
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
    coach.innerHTML = `<h3>Coach Feedback</h3><div class="coach-body muted">Awaiting the first assistant reply…</div>`;
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
          new Set(scenarios.map((s) => (s.therapeuticArea || s.diseaseState || "").trim()))
        ).filter(Boolean);
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
        else elOption(select, v.value || v.id || v.key || v.label, v.label || v.value || v.id || v.key);
      });
    }

    function populateDiseases() {
      const ds = getDiseaseStates();
      setSelectOptions(diseaseSelect, ds, true);
    }

    function populateHcpForDisease(ds) {
      const dsKey = (ds || "").trim();
      const scen = scenarios.filter((s) => {
        const area = (s.therapeuticArea || s.diseaseState || "").trim();
        return area.toLowerCase() === dsKey.toLowerCase();
      });

      if (scen.length) {
        const opts = scen.map((s) => ({ value: s.id, label: s.label || s.id }));
        setSelectOptions(hcpSelect, opts, true);
        hcpSelect.disabled = false;
      } else {
        setSelectOptions(hcpSelect, [{ value: "", label: "No scenarios for this disease" }], true);
        hcpSelect.disabled = true;
      }
    }

    function renderMeta() {
      const sc = scenariosById.get(currentScenarioId);
      const showMeta = currentMode === "sales-simulation" || currentMode === "role-play";
      if (!sc || !currentScenarioId || !showMeta) {
        meta.innerHTML = "";
        return;
      }
      meta.innerHTML = `
        <div class="meta-card">
          <div><strong>Today’s Goal:</strong> ${esc(sc.goal || "—")}</div>
        </div>`;
    }

    function renderMessages() {
      const msgsEl = shell.querySelector(".chat-messages");
      msgsEl.innerHTML = "";

      for (const m of conversation) {
        const row = el("div", `message ${m.role}`);
        const c = el("div", "content");

        // Speaker chips: Role Play = HCP/Rep. Sales Simulation = Sales Coach/Rep.
        if (currentMode === "role-play") {
          const chipText =
            m._speaker === "hcp" ? "HCP" : m._speaker === "rep" ? "Rep" : m.role === "assistant" ? "HCP" : "Rep";
          const chipCls = m._speaker === "hcp" || m.role === "assistant" ? "speaker hcp" : "speaker rep";
          const chip = el("div", chipCls, chipText);
          c.appendChild(chip);
        } else if (currentMode === "sales-simulation") {
          const isCoach = m.role === "assistant";
          const chip = el("div", isCoach ? "speaker coach" : "speaker rep", isCoach ? "Sales Coach" : "Rep");
          c.appendChild(chip);
        }

        const body = el("div");
        const normalized = normalizeGuidanceLabels(m.content);
        body.innerHTML = md(normalized);
        c.appendChild(body);

        row.appendChild(c);
        msgsEl.appendChild(row);
      }
      msgsEl.scrollTop = msgsEl.scrollHeight;
    }

    function orderedPills(scores) {
      const order = ["accuracy", "empathy", "clarity", "compliance", "discovery", "objection_handling"];
      return order
        .filter((k) => k in (scores || {}))
        .map((k) => `<span class="pill">${esc(k)}: ${scores[k]}</span>`)
        .join(" ");
    }

    function renderCoach() {
      const body = coach.querySelector(".coach-body");
      if (!coachOn || currentMode === "product-knowledge") {
        coach.style.display = "none";
        return;
      }
      coach.style.display = "";

      // Role Play: hide until final eval
      if (currentMode === "role-play") {
        const last = conversation[conversation.length - 1];
        if (!last || !last._finalEval) {
          const extra = repOnlyPanelHTML
            ? `<div style="margin-top:10px;padding-top:10px;border-top:1px dashed #e1e6ef">${repOnlyPanelHTML}</div>`
            : "";
          body.innerHTML = `<span class="muted">Final evaluation will appear after you request it by typing “Evaluate this exchange”.</span>${extra}`;
          return;
        }
      }

      const last = conversation[conversation.length - 1];
      if (!(last && last.role === "assistant" && last._coach)) {
        body.innerHTML = `<span class="muted">Awaiting the first assistant reply…</span>`;
        return;
      }
      const fb = last._coach;
      const scores = fb.scores || fb.subscores || {};

      // Sales Simulation yellow panel spec:
      if (currentMode === "sales-simulation") {
        const workedStr = fb.worked && fb.worked.length ? `<ul>${fb.worked.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>` : "—";
        const improveStr = fb.improve && fb.improve.length ? `<ul>${fb.improve.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>` : "—";
        const phrasingStr = fb.phrasing || "—";
        body.innerHTML = `
          <div class="coach-subs" style="display:none">${orderedPills(scores)}</div>
          <ul class="coach-list">
            <li><strong>Focus:</strong> ${workedStr}</li>
            <li><strong>Strategy:</strong> ${improveStr}</li>
            <li><strong>Suggested Phrasing:</strong>
              <div class="mono">${esc(phrasingStr)}</div>
            </li>
          </ul>
          ${repOnlyPanelHTML ? `<div style="margin-top:10px;padding-top:10px;border-top:1px dashed #e1e6ef">${repOnlyPanelHTML}</div>` : ""}`;
        return;
      }

      // Emotional-assessment and Role Play final eval keep score view
      const workedStr = fb.worked && fb.worked.length ? fb.worked.join(". ") + "." : "—";
      const improveStr = fb.improve && fb.improve.length ? fb.improve.join(". ") + "." : fb.feedback || "—";
      body.innerHTML = `
        <div class="coach-score">Score: <strong>${fb.overall ?? fb.score ?? "—"}</strong>/100</div>
        <div class="coach-subs">${orderedPills(scores)}</div>
        <ul class="coach-list">
          <li><strong>What worked:</strong> ${esc(workedStr)}</li>
          <li><strong>What to improve:</strong> ${esc(improveStr)}</li>
          <li><strong>Suggested phrasing:</strong> ${esc(fb.phrasing || "—")}</li>
        </ul>
        ${repOnlyPanelHTML ? `<div style="margin-top:10px;padding-top:10px;border-top:1px dashed #e1e6ef">${repOnlyPanelHTML}</div>` : ""}`;
    }

    function applyModeVisibility() {
      const lc = modeSel.value;
      currentMode = LC_TO_INTERNAL[lc];
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
        repOnlyPanelHTML = "";
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
        repOnlyPanelHTML = "";
        populateDiseases();
      } else if (currentMode === "role-play") {
        diseaseLabel.classList.remove("hidden");
        diseaseSelect.classList.remove("hidden");
        hcpLabel.classList.remove("hidden");
        hcpSelect.classList.remove("hidden");
        personaLabelElem.classList.add("hidden");
        personaSelectElem.classList.add("hidden");
        featureLabelElem.classList.add("hidden");
        eiFeatureSelectElem.classList.add("hidden");
        repOnlyPanelHTML = "";
        feedbackDisplayElem.innerHTML = `
          <div class="coach-note">
            <strong>Role Play Mode:</strong> You chat with an HCP persona selected by Disease + HCP.
            Type <em>"Evaluate this exchange"</em> for a full assessment, or <em>"Evaluate Rep"</em> for a Rep-only review.
          </div>`;
        populateDiseases();
        if (diseaseSelect.value) populateHcpForDisease(diseaseSelect.value);
        renderMessages();
        renderCoach();
        renderMeta();
      } else {
        // emotional-assessment
        diseaseLabel.classList.add("hidden");
        diseaseSelect.classList.add("hidden");
        hcpLabel.classList.add("hidden");
        hcpSelect.classList.add("hidden");
        personaLabelElem.classList.remove("hidden");
        personaSelectElem.classList.remove("hidden");
        featureLabelElem.classList.remove("hidden");
        eiFeatureSelectElem.classList.remove("hidden");
        feedbackDisplayElem.innerHTML = "";
        repOnlyPanelHTML = "";
        currentScenarioId = null;
        conversation = [];
        renderMessages();
        renderCoach();
        renderMeta();
      }

      if (currentMode === "product-knowledge" || currentMode === "emotional-assessment") {
        currentScenarioId = null;
        conversation = [];
        renderMessages();
        renderCoach();
        renderMeta();
      }
    }

    modeSel.addEventListener("change", applyModeVisibility);

    diseaseSelect.addEventListener("change", () => {
      const ds = diseaseSelect.value || "";
      if (!ds) return;
      if (currentMode === "sales-simulation" || currentMode === "role-play") {
        populateHcpForDisease(ds);
      } else if (currentMode === "product-knowledge") {
        currentScenarioId = null;
      }
      renderMessages();
      renderCoach();
      renderMeta();
    });

    hcpSelect.addEventListener("change", () => {
      const sel = hcpSelect.value || "";
      if (!sel) return;
      const sc = scenariosById.get(sel);
      currentScenarioId = sc ? sc.id : null;
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
    applyModeVisibility();
  }

  // ---------- callModel (hardened with retries, timeout, SSE streaming, and backoff) ----------
  function rid() {
    return Math.random().toString(36).slice(2);
  }

  // Helper to show typing indicator
  function showTypingIndicator() {
    const shellEl = mount.querySelector(".reflectiv-chat");
    const msgsEl = shellEl?.querySelector(".chat-messages");
    if (!msgsEl) return null;
    
    const typingRow = el("div", "message assistant typing-indicator");
    const typingContent = el("div", "content");
    typingContent.innerHTML = '<span class="typing-dots"><span>.</span><span>.</span><span>.</span></span>';
    typingRow.appendChild(typingContent);
    msgsEl.appendChild(typingRow);
    msgsEl.scrollTop = msgsEl.scrollHeight;
    
    return typingRow;
  }
  
  // Helper to remove typing indicator
  function removeTypingIndicator(indicator) {
    if (indicator && indicator.parentNode) {
      indicator.parentNode.removeChild(indicator);
    }
  }

  // SSE streaming handler with requestAnimationFrame batching
  async function streamWithSSE(url, payload, onToken) {
    return new Promise((resolve, reject) => {
      let accumulated = "";
      let pendingUpdate = false;
      let updateScheduled = false;
      
      // Validate payload size to prevent URL length issues
      const payloadStr = JSON.stringify(payload);
      if (payloadStr.length > 8000) {
        reject(new Error("payload_too_large_for_sse"));
        return;
      }
      
      // Create EventSource URL with payload as query params
      const sseUrl = new URL(url);
      sseUrl.searchParams.set("stream", "true");
      sseUrl.searchParams.set("data", btoa(payloadStr));
      
      const eventSource = new EventSource(sseUrl.toString());
      const startTime = Date.now();
      let lastTokenTime = Date.now();
      
      // 8s total timeout from start (not reset per message)
      const failTimeout = setTimeout(() => {
        cleanup();
        if (accumulated) {
          resolve(accumulated);
        } else {
          reject(new Error("stream_timeout_8s"));
        }
      }, 8000);
      
      // Heartbeat check - if no data for 8s, fail
      const heartbeat = setInterval(() => {
        if (Date.now() - lastTokenTime > 8000) {
          cleanup();
          if (accumulated) {
            resolve(accumulated);
          } else {
            reject(new Error("sse_heartbeat_timeout"));
          }
        }
      }, 1000);
      
      // Cleanup function to clear all timers and close connection
      const cleanup = () => {
        clearTimeout(failTimeout);
        clearInterval(heartbeat);
        eventSource.close();
      };
      
      // Batched DOM update using requestAnimationFrame
      const scheduleDOMUpdate = () => {
        if (updateScheduled) return;
        updateScheduled = true;
        
        requestAnimationFrame(() => {
          if (pendingUpdate && accumulated) {
            onToken(accumulated);
            pendingUpdate = false;
          }
          updateScheduled = false;
        });
      };
      
      eventSource.onmessage = (event) => {
        lastTokenTime = Date.now();
        
        try {
          const data = JSON.parse(event.data);
          const token = data.token || data.content || data.delta || "";
          
          if (token) {
            accumulated += token;
            pendingUpdate = true;
            scheduleDOMUpdate();
          }
          
          if (data.done) {
            cleanup();
            // Final update
            if (pendingUpdate) {
              onToken(accumulated);
            }
            resolve(accumulated);
          }
        } catch (e) {
          console.warn("SSE parse error:", e);
        }
      };
      
      eventSource.onerror = (err) => {
        cleanup();
        
        if (accumulated) {
          resolve(accumulated);
        } else {
          reject(new Error("sse_connection_failed"));
        }
      };
    });
  }

  async function callModel(messages) {
    const url = (cfg?.apiBase || cfg?.workerUrl || window.COACH_ENDPOINT || window.WORKER_URL || "").trim();
    const useStreaming = cfg?.stream === true;
    
    // Show typing indicator within 100ms
    const typingIndicator = showTypingIndicator();
    
    const payload = {
      model: (cfg?.model) || "llama-3.1-8b-instant",
      temperature: (currentMode === "role-play" ? 0.35 : 0.2),
      top_p: 0.9,
      stream: useStreaming,
      max_output_tokens: (cfg?.max_output_tokens || cfg?.maxTokens) || (currentMode === "sales-simulation" ? 1000 : 1200),
      messages
    };

    // SSE Streaming branch
    if (useStreaming) {
      try {
        let streamedContent = "";
        const shellEl = mount.querySelector(".reflectiv-chat");
        const msgsEl = shellEl?.querySelector(".chat-messages");
        
        // Create a temporary message element for streaming updates
        const streamRow = el("div", "message assistant streaming");
        const streamContent = el("div", "content");
        const streamBody = el("div");
        streamContent.appendChild(streamBody);
        streamRow.appendChild(streamContent);
        
        // Remove typing indicator and add stream element
        removeTypingIndicator(typingIndicator);
        msgsEl?.appendChild(streamRow);
        
        const result = await streamWithSSE(url, payload, (content) => {
          streamedContent = content;
          streamBody.innerHTML = md(sanitizeLLM(content));
          if (msgsEl) {
            msgsEl.scrollTop = msgsEl.scrollHeight;
          }
        });
        
        // Remove streaming element - the actual message will be added by sendMessage
        if (streamRow.parentNode) {
          streamRow.parentNode.removeChild(streamRow);
        }
        
        return result || streamedContent;
      } catch (e) {
        removeTypingIndicator(typingIndicator);
        console.warn("SSE streaming failed, falling back to regular fetch:", e);
        // Fall through to regular fetch with retry
      }
    }

    // Regular fetch with exponential backoff retries (300ms → 800ms → 1.5s)
    const delays = [300, 800, 1500];
    let lastError = null;
    
    for (let attempt = 0; attempt < delays.length + 1; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort("timeout"), 10000); // 10s timeout
      
      try {
        const r = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Req-Id": rid()
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        });

        clearTimeout(timeout);
        removeTypingIndicator(typingIndicator);

        if (r.ok) {
          const data = await r.json().catch(() => ({}));
          return (
            data?.content ||
            data?.reply ||
            data?.choices?.[0]?.message?.content ||
            ""
          );
        }
        
        // Check if we should retry (429 or 5xx errors)
        if (attempt < delays.length && (r.status === 429 || r.status >= 500)) {
          lastError = new Error("HTTP " + r.status);
          await new Promise((res) => setTimeout(res, delays[attempt]));
          continue;
        }
        
        throw new Error("HTTP " + r.status);
      } catch (e) {
        clearTimeout(timeout);
        
        // Retry on timeout or network errors
        if (attempt < delays.length && /timeout|TypeError|NetworkError/i.test(String(e))) {
          lastError = e;
          await new Promise((res) => setTimeout(res, delays[attempt]));
          continue;
        }
        
        removeTypingIndicator(typingIndicator);
        console.warn("Model call failed:", e);
        
        // Show retry UI if we've exhausted all retries and taken >= 8s total
        const totalElapsed = Date.now() - (window._lastCallModelAttempt || Date.now());
        if (totalElapsed >= 8000) {
          showRetryUI();
        }
        
        return "";
      }
    }

    removeTypingIndicator(typingIndicator);
    console.warn("Model call failed after all retries:", lastError);
    showRetryUI();
    return "";
  }
  
  // Show retry button UI
  function showRetryUI() {
    const shellEl = mount.querySelector(".reflectiv-chat");
    const msgsEl = shellEl?.querySelector(".chat-messages");
    if (!msgsEl) return;
    
    // Check if retry UI already exists
    if (msgsEl.querySelector(".retry-ui")) return;
    
    const retryRow = el("div", "message assistant retry-ui");
    const retryContent = el("div", "content");
    retryContent.style.background = "#fff3cd";
    retryContent.style.borderColor = "#ffc107";
    retryContent.innerHTML = `
      <p style="margin: 0 0 8px 0;"><strong>⚠️ Request timed out</strong></p>
      <p style="margin: 0 0 8px 0; font-size: 13px;">The server took too long to respond.</p>
      <button class="btn retry-btn" style="font-size: 13px; padding: 6px 16px;">Retry</button>
    `;
    retryRow.appendChild(retryContent);
    msgsEl.appendChild(retryRow);
    msgsEl.scrollTop = msgsEl.scrollHeight;
    
    // Add retry click handler
    const retryBtn = retryContent.querySelector(".retry-btn");
    if (retryBtn) {
      retryBtn.onclick = () => {
        retryRow.parentNode.removeChild(retryRow);
        // Re-send last user message
        const lastUserMsg = conversation.filter(m => m.role === "user").pop();
        if (lastUserMsg) {
          sendMessage(lastUserMsg.content);
        }
      };
    }
  }

  // ---------- final-eval helper ----------
  async function evaluateConversation() {
    const sc = scenariosById.get(currentScenarioId);
    const turns = conversation.length ? conversation : [{ role: "system", content: "No prior turns." }];
    const convoText = turns.map((m) => `${m.role}: ${m.content}`).join("\n").slice(0, 24000);

    const evalMsgs = [
      systemPrompt ? { role: "system", content: systemPrompt } : null,
      { role: "system", content: buildPreface("role-play", sc) + "\nEvaluate the whole exchange now." },
      {
        role: "user",
        content:
          `Evaluate this entire exchange for EI, clarity, accuracy, compliance, discovery, and objection handling. ` +
          `Provide specific, actionable feedback and a 0-100 score.\n\nConversation:\n${convoText}`
      }
    ].filter(Boolean);

    const raw = await callModel(evalMsgs);
    const { coach, clean } = extractCoach(raw);
    const finalCoach = coach || scoreReply("", clean);
    conversation.push({ role: "assistant", content: clean, _coach: finalCoach, _finalEval: true });
  }

  /* ---------- Rep-only evaluation helpers ---------- */
  function repTurns(history, max = 12) {
    const repLike = ["rep", "user"];
    const seq = (history || []).filter(
      (m) => repLike.includes(String(m._speaker || "").toLowerCase()) || repLike.includes(String(m.role || "").toLowerCase())
    );
    return seq.slice(-max).map(({ role, content, _speaker }) => ({
      role: (role || _speaker || "user"),
      content: String(content || "")
    }));
  }

  async function evaluateRepOnly({ history, personaLabel, goal }) {
    const transcript = repTurns(history);

    const sys = [
      "You are the ReflectivAI Coach.",
      "Evaluate ONLY the Rep’s utterances.",
      "Ignore HCP content except as context.",
      `Persona: ${personaLabel || "unspecified persona"}.`,
      `Scenario Goal: ${goal || "unspecified goal"}.`,
      "Rubric: Accuracy, Compliance, Discovery, Clarity, Objection Handling, Empathy.",
      "Return JSON with keys: scores{accuracy,compliance,discovery,clarity,objectionHandling,empathy}, summary, strengths[], improvements[], actionable[]. Scores 1–5 integers."
    ].join(" ");

    const user = {
      role: "user",
      content: JSON.stringify({
        mode: "rep_only",
        rubric: ["Accuracy", "Compliance", "Discovery", "Clarity", "Objection Handling", "Empathy"],
        transcript
      })
    };

    let raw = "";
    try {
      raw = await callModel([{ role: "system", content: sys }, user]);
    } catch (e) {
      return { html: `<div class='coach-panel'><h4>Rep-only Evaluation</h4><p>Unavailable now. Try again.</p></div>` };
    }

    let data = null;
    try { data = JSON.parse(raw); } catch (_) {}

    if (!data || !data.scores) {
      const safe = sanitizeLLM(raw || "Rep-only evaluation unavailable.");
      return { html: `<div class='coach-panel'><h4>Rep-only Evaluation</h4><p>${esc(safe)}</p></div>` };
    }

    const s = data.scores || {};
    const list = (arr) => Array.isArray(arr) && arr.length ? `<ul>${arr.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>` : "—";
    const html = `
      <div class="coach-panel">
        <h4>Rep-only Evaluation</h4>
        <div class="coach-subs">
          <span class="pill">Accuracy: ${s.accuracy ?? "—"}</span>
          <span class="pill">Compliance: ${s.compliance ?? "—"}</span>
          <span class="pill">Discovery: ${s.discovery ?? "—"}</span>
          <span class="pill">Clarity: ${s.clarity ?? "—"}</span>
          <span class="pill">Objection Handling: ${s.objectionHandling ?? "—"}</span>
          <span class="pill">Empathy: ${s.empathy ?? "—"}</span>
        </div>
        ${data.summary ? `<p>${esc(data.summary)}</p>` : ""}
        <h5>Strengths</h5>${list(data.strengths)}
        <h5>Improvements</h5>${list(data.improvements)}
        <h5>Actionable Feedback</h5>${list(data.actionable)}
      </div>`;
    return { html };
  }

  // ---------- send ----------
  function norm(txt){return String(txt||"").toLowerCase().replace(/\s+/g," ").trim();}

  // PATCH B: semantic duplicate detection (4-gram Jaccard)
  function jaccard4gram(a,b){
    const grams = s => {
      const t = String(s||"").toLowerCase().replace(/\s+/g," ").trim();
      if (t.length < 4) return new Set([t]);
      const g = new Set();
      for (let i=0;i<=t.length-4;i++) g.add(t.slice(i,i+4));
      return g;
    };
    const A = grams(a), B = grams(b);
    let inter=0; for (const x of A) if (B.has(x)) inter++;
    const union = A.size + B.size - inter;
    return union ? inter/union : 0;
  }

  let lastAssistantNorm = "";
  let recentAssistantNorms = [];
  function pushRecent(n){ recentAssistantNorms.push(n); if(recentAssistantNorms.length>6) recentAssistantNorms.shift(); }
  function isRecent(n){ return recentAssistantNorms.includes(n); }
  function isTooSimilar(n){ return recentAssistantNorms.some(p => jaccard4gram(p,n) >= 0.88); }

  let isSending = false;

  function trimConversationIfNeeded() {
    if (conversation.length <= 30) return;
    conversation = conversation.slice(-30);
  }

  async function sendMessage(userText) {
    if (isSending) return;
    isSending = true;
    
    // Track timing for auto-fail feature
    window._lastCallModelAttempt = Date.now();

    const shellEl = mount.querySelector(".reflectiv-chat");
    const renderMessages = shellEl._renderMessages;
    const renderCoach = shellEl._renderCoach;
    const sendBtn = shellEl._sendBtn;
    const ta = shellEl._ta;
    if (sendBtn) sendBtn.disabled = true;
    if (ta) ta.disabled = true;

    try {
      userText = clampLen((userText || "").trim(), 1600);
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

      const repEvalRe = /^\s*(evaluate\s+rep|rep\s+only\s+eval(?:uation)?|evaluate\s+the\s+rep)\s*$/i;
      if (repEvalRe.test(userText)) {
        const sc = scenariosById.get(currentScenarioId);
        const persona = sc?.hcpRole || sc?.label || "";
        const goal = sc?.goal || "";
        const res = await evaluateRepOnly({ history: conversation, personaLabel: persona, goal });
        repOnlyPanelHTML = res?.html || "<div class='coach-panel'><h4>Rep-only Evaluation</h4><p>Unavailable.</p></div>";
        renderCoach();
        return;
      }

      conversation.push({
        role: "user",
        content: userText,
        _speaker: currentMode === "role-play" ? "rep" : "user"
      });
      trimConversationIfNeeded();
      renderMessages();
      renderCoach();

      if (currentMode === "emotional-assessment") generateFeedback();

      const sc = scenariosById.get(currentScenarioId);
      const messages = [];

      if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
      if ((currentMode === "sales-simulation" || currentMode === "role-play") && eiHeuristics) {
        messages.push({ role: "system", content: eiHeuristics });
      }

      if (currentMode === "role-play") {
        const personaLine = currentPersonaHint();
        const detail = sc
          ? `Therapeutic Area: ${sc.therapeuticArea || sc.diseaseState || "—"}. HCP Role: ${sc.hcpRole || "—"}. ${
              sc.background ? `Background: ${sc.background}. ` : ""
            }${sc.goal ? `Today’s Goal: ${sc.goal}.` : ""}`
          : "";
        const roleplayRails = buildPreface("role-play", sc) + `

Context:
${personaLine}
${detail}`;
        messages.push({ role: "system", content: roleplayRails });
      } else {
        messages.push({ role: "system", content: buildPreface(currentMode, sc) });
      }

      messages.push({ role: "user", content: userText });

      try {
        if (currentMode !== "role-play") {
          const sysExtras =
            typeof EIContext !== "undefined" && EIContext?.getSystemExtras
              ? await EIContext.getSystemExtras().catch(() => null)
              : null;
          if (sysExtras) messages.unshift({ role: "system", content: sysExtras });
        }

        let raw = await callModel(messages);
        if (!raw) raw = fallbackText(currentMode);

        let { coach, clean } = extractCoach(raw);
        
        // Re-ask once if phrasing is missing in sales-simulation mode
        const phrasing = coach?.phrasing;
        if (currentMode === "sales-simulation" && coach && (!phrasing || !phrasing.trim())) {
          const correctiveHint = `
IMPORTANT: The response must include a "phrasing" field in the <coach> JSON block.
The phrasing should be a concrete, actionable question or statement the rep can use with the HCP.
Example: "Given your criteria, which patients would be the best fit to start, and what would help you try one this month?"
Please provide your response again with all required fields including phrasing.`;
          
          const retryMessages = [
            ...messages,
            { role: "assistant", content: raw },
            { role: "system", content: correctiveHint }
          ];
          
          try {
            const retryRaw = await callModel(retryMessages);
            if (retryRaw) {
              const retryResult = extractCoach(retryRaw);
              // Use the retry result if it has phrasing, otherwise keep original
              if (retryResult.coach && retryResult.coach.phrasing && retryResult.coach.phrasing.trim()) {
                coach = retryResult.coach;
                clean = retryResult.clean;
              }
            }
          } catch (retryErr) {
            console.warn("Retry for missing phrasing failed:", retryErr);
          }
        }
        
let replyText = currentMode === "role-play" ? sanitizeRolePlayOnly(clean) : sanitizeLLM(clean);

// Mid-sentence cut-off guard + one-pass auto-continue
const cutOff = (t) => {
  const s = String(t || "").trim();
  return s.length > 200 && !/[.!?]"?\s*$/.test(s);
};
if (cutOff(replyText)) {
  const contMsgs = [
    ...messages,
    { role: "assistant", content: replyText },
    { role: "user", content: "Continue the same answer. Finish the thought in 1–2 sentences max. No new sections." }
  ];
  try {
    let contRaw = await callModel(contMsgs);
    let contClean = currentMode === "role-play" ? sanitizeRolePlayOnly(contRaw) : sanitizeLLM(contRaw);
    if (contClean) replyText = (replyText + " " + contClean).trim();
  } catch (_) { /* no-op */ }
}

if (currentMode === "role-play") {
  replyText = await enforceHcpOnly(replyText, sc, messages, callModel);
}

if (norm(replyText) === norm(userText)) {
  replyText = fallbackText(currentMode);
}

        // PATCH B: semantic duplicate handling with vary pass
        let candidate = norm(replyText);
        if (candidate && (candidate === lastAssistantNorm || isRecent(candidate) || isTooSimilar(candidate))) {
          const varyMsgs = [
            ...messages.slice(0,-1),
            { role:"system", content:"Do not repeat prior wording. Provide a different HCP reply with one concrete example, one criterion, and one follow-up step. 2–4 sentences." },
            messages[messages.length-1]
          ];
          let varied = await callModel(varyMsgs);
          varied = currentMode === "role-play" ? sanitizeRolePlayOnly(varied || "") : sanitizeLLM(varied || "");
          if (!varied || isTooSimilar(norm(varied))) {
            const alts = [
              "In my clinic, initial risk assessment drives the plan; we confirm eligibility, counsel, and arrange an early follow-up.",
              "I look at recent exposures and adherence risks, choose an appropriate option, and schedule a check-in within a month.",
              "We review history and labs, agree on an initiation pathway, and monitor early to ensure tolerability and adherence."
            ];
            varied = alts.find(a => !isTooSimilar(norm(a))) || alts[0];
          }
          replyText = varied;
          candidate = norm(replyText);
        }
        lastAssistantNorm = candidate;
        pushRecent(candidate);

        replyText = clampLen(replyText, currentMode === "sales-simulation" ? 1200 : 1400);

        const computed = scoreReply(userText, replyText, currentMode);

        const finalCoach = (() => {
          if (coach && (coach.scores || coach.subscores) && currentMode !== "role-play") {
            const scores = coach.scores || coach.subscores;
            const overall =
              typeof coach.overall === "number" ? coach.overall : typeof coach.score === "number" ? coach.score : undefined;
            return {
              overall: overall ?? computed.overall,
              scores,
              feedback: coach.feedback || computed.feedback,
              worked: coach.worked && coach.worked.length ? coach.worked : computed.worked,
              improve: coach.improve && coach.improve.length ? coach.improve : computed.improve,
              phrasing: typeof coach.phrasing === "string" && coach.phrasing ? coach.phrasing : computed.phrasing,
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
        trimConversationIfNeeded();
        renderMessages();
        renderCoach();

        if (currentMode === "emotional-assessment") generateFeedback();

        if (cfg && cfg.analyticsEndpoint) {
          fetch(cfg.analyticsEndpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ts: Date.now(),
              schema: cfg.schemaVersion || "coach-v2",
              mode: currentMode,
              scenarioId: currentScenarioId,
              turn: conversation.length,
              context: finalCoach.context || { rep_question: userText, hcp_reply: replyText },
              overall: finalCoach.overall,
              scores: finalCoach.scores
            })
          }).catch(() => {});
        }
      } catch (e) {
        conversation.push({ role: "assistant", content: `Model error: ${String(e.message || e)}` });
        trimConversationIfNeeded();
        renderMessages();
      }
    } finally {
      const shellEl2 = mount.querySelector(".reflectiv-chat");
      const sendBtn2 = shellEl2?._sendBtn;
      const ta2 = shellEl2?._ta;
      if (sendBtn2) sendBtn2.disabled = false;
      if (ta2) { ta2.disabled = false; ta2.focus(); }
      isSending = false;
    }
  }

  // ---------- scenarios loader ----------
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
      if (s.therapeuticArea) s.therapeuticArea = s.therapeuticArea.replace(/\bhiv\b/gi, "HIV");
    });

    const byId = new Map();
    for (const s of scenarios) byId.set(s.id, s);
    scenarios = Array.from(byId.values());
    scenariosById = byId;
  }

  // ---------- init ----------
  async function init() {
    try {
      try {
        cfg = await fetchLocal("./assets/chat/config.json");
      } catch (e) {
        cfg = await fetchLocal("./config.json");
      }
    } catch (e) {
      console.error("config load failed:", e);
      cfg = { defaultMode: "sales-simulation" };
    }

    if (!cfg.apiBase && !cfg.workerUrl) {
      cfg.apiBase = (window.COACH_ENDPOINT || window.WORKER_URL || "").trim();
    }

    try {
      systemPrompt = await fetchLocal("./assets/chat/system.md");
    } catch (e) {
      console.error("system.md load failed:", e);
      systemPrompt = "";
    }

    try {
      eiHeuristics = await fetchLocal("./assets/chat/about-ei.md");
    } catch (e) {
      console.warn("about-ei.md load failed:", e);
      eiHeuristics = "";
    }

    await loadScenarios();
    buildUI();
  }

  // ---------- start ----------
  waitForMount(init);
})();
