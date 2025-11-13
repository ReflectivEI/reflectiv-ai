/* widget.js
 * ReflectivAI Chat/Coach — drop-in (coach-v2, deterministic scoring v3) + RP hardening r10
 * Modes: emotional-assessment | product-knowledge | sales-coach | role-play
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
 * 9) Mode-aware fallbacks to stop HCP-voice leakage in Sales Coach
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
  const LC_OPTIONS = ["Emotional Intelligence", "Product Knowledge", "Sales Coach", "Role Play", "General Assistant"];
  const LC_TO_INTERNAL = {
    "Emotional Intelligence": "emotional-assessment",
    "Product Knowledge": "product-knowledge",
    "Sales Coach": "sales-coach",
    "Role Play": "role-play",
    "General Assistant": "general-knowledge"
  };

  // ---------- SSE Configuration ----------
  // Set to false to disable SSE streaming and use regular fetch only
  // SSE streaming is disabled by default due to payload size limitations
  const USE_SSE = false;

  let cfg = null;
  let systemPrompt = "";
  let eiHeuristics = "";
  let scenarios = [];
  let scenariosById = new Map();
  let citationsDb = {}; // Citation reference database

  let currentMode = "sales-coach";
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

  // ---------- Health gate state ----------
  let isHealthy = false;
  let healthCheckInterval = null;
  let healthBanner = null;

  // ---------- EI dev shim ----------
  const DEBUG_EI_SHIM = new URLSearchParams(location.search).has('eiShim');

  // ---------- Performance telemetry ----------
  let debugMode = false;  // Only shows if ?debug=1 in URL
  let telemetryFooter = null;
  let currentTelemetry = null;
  const textEncoder = new TextEncoder(); // Reusable encoder for byte length calculations

  function isDebugMode() {
    return /[?&]debug=1/.test(window.location.search);
  }

  function initTelemetry() {
    debugMode = isDebugMode();
    currentTelemetry = {
      t_open: 0,
      t_first_byte: 0,
      t_first_chunk: 0,
      t_done: 0,
      retries: 0,
      httpStatus: "",
      mode: "",
      bytes_rx: 0,
      tokens_rx: 0
    };
  }

  function updateDebugFooter() {
    if (!debugMode || !telemetryFooter || !currentTelemetry) return;

    const t = currentTelemetry;
    const ttfb = t.t_first_byte > 0 ? ((t.t_first_byte - t.t_open) / 1000).toFixed(1) : "–.–";
    const firstChunk = t.t_first_chunk > 0 ? ((t.t_first_chunk - t.t_open) / 1000).toFixed(1) : "–.–";
    const done = t.t_done > 0 ? ((t.t_done - t.t_open) / 1000).toFixed(1) : "–.–";

    telemetryFooter.textContent = `TTFB/FirstChunk/Done: ${ttfb}s / ${firstChunk}s / ${done}s • retries:${t.retries} • ${t.httpStatus || "—"}`;
  }

  function logTelemetry() {
    if (!currentTelemetry || currentTelemetry.t_open === 0) return;

    const t = currentTelemetry;
    const row = {
      mode: t.mode,
      TTFB_s: t.t_first_byte > 0 ? ((t.t_first_byte - t.t_open) / 1000).toFixed(1) : "—",
      FirstChunk_s: t.t_first_chunk > 0 ? ((t.t_first_chunk - t.t_open) / 1000).toFixed(1) : "—",
      Done_s: t.t_done > 0 ? ((t.t_done - t.t_open) / 1000).toFixed(1) : "—",
      retries: t.retries,
      status: t.httpStatus || "—",
      bytes_rx: t.bytes_rx,
      tokens_rx: t.tokens_rx
    };
    console.table([row]);
  }

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
  const STUB_MODE = new URLSearchParams(location.search).has('stub');
  const IS_GITHUB_IO = /github\.io/i.test(location.hostname);

  async function fetchLocal(path) {
    const r = await fetch(path, { cache: "no-store" });

    // 404 handling with stub mode guard
    if (!r.ok) {
      if (r.status === 404 && IS_GITHUB_IO && STUB_MODE) {
        console.warn(`[stub mode] ${path} returned 404, returning empty stub`);
        return path.endsWith('.json') ? {} : '';
      }
      throw new Error(`Failed to load ${path} (${r.status})`);
    }

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

  // ---------- Citation Management ----------
  /**
   * Load citations database from citations.json
   */
  async function loadCitations() {
    try {
      const resp = await fetch('./citations.json?' + Date.now());
      if (resp.ok) {
        citationsDb = await resp.json();
        console.log('[Citations] Loaded', Object.keys(citationsDb).length, 'references');
      }
    } catch (e) {
      console.warn('[Citations] Failed to load citations.json:', e);
    }
  }

  /**
   * Convert citation codes [HIV-PREP-001] to clickable footnote links
   * This version escapes the text first, then unescapes and converts citations
   * @param {string} text - Text containing citation codes
   * @returns {string} HTML with citation codes converted to links
   */
  function convertCitations(text) {
    if (!text) return text;

    // Match citation codes like [HIV-PREP-001] or [HIV-TREAT-TAF-001]
    // Works on both escaped and unescaped text
    return text.replace(/\[([A-Z]{3,}-[A-Z]{2,}-[A-Z0-9-]{3,})\]/g, (match, code) => {
      const citation = citationsDb[code];
      if (!citation) {
        // Unknown code - show as-is but styled
        return `<span style="background:#fee;padding:2px 4px;border-radius:3px;font-size:11px;color:#c00" title="Citation not found">${match}</span>`;
      }

      // Create clickable footnote link
      const tooltip = citation.apa || `${citation.source}, ${citation.year}`;
      return `<a href="${citation.url}" target="_blank" rel="noopener" style="background:#e0f2fe;padding:2px 6px;border-radius:4px;font-size:11px;font-weight:600;color:#0369a1;text-decoration:none;border:1px solid #bae6fd" title="${esc(tooltip)}">[${code.split('-').pop()}]</a>`;
    });
  }

  // ---------- Health gate ----------
  async function checkHealth() {
    // Normalize base URL to avoid double slashes
    const baseUrl = (window.WORKER_URL || "").replace(/\/+$/, "");
    const healthUrl = `${baseUrl}/health`;
    console.log('[DEBUG] checkHealth() called, healthUrl:', healthUrl);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1500);

    try {
      const response = await fetch(healthUrl, {
        method: "GET",
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (response.ok) {
        isHealthy = true;
        console.log('[DEBUG] Health check PASSED, isHealthy set to TRUE');
        hideHealthBanner();
        enableSendButton();
        if (healthCheckInterval) {
          clearInterval(healthCheckInterval);
          healthCheckInterval = null;
        }
        return true;
      }

      isHealthy = false;
      console.log('[DEBUG] Health check FAILED (not ok), isHealthy set to FALSE, status:', response.status);
      showHealthBanner();
      disableSendButton();
      return false;
    } catch (e) {
      clearTimeout(timeout);
      isHealthy = false;
      console.log('[DEBUG] Health check FAILED (exception), isHealthy set to FALSE, error:', e.message);
      showHealthBanner();
      disableSendButton();
      return false;
    }
  }

  function showHealthBanner() {
    if (!mount) return;

    if (!healthBanner) {
      healthBanner = document.createElement("div");
      healthBanner.style.cssText = "background:#fff3cd;border:1px solid #ffc107;border-radius:8px;padding:12px 16px;margin:8px 0;color:#856404;font-size:14px;font-weight:600;text-align:center;";
      healthBanner.textContent = "⚠️ Backend unavailable. Trying again…";
    }

    const shell = mount.querySelector(".reflectiv-chat");
    if (shell && !shell.contains(healthBanner)) {
      shell.insertBefore(healthBanner, shell.firstChild);
    }
  }

  function hideHealthBanner() {
    if (healthBanner && healthBanner.parentNode) {
      healthBanner.parentNode.removeChild(healthBanner);
    }
  }

  function enableSendButton() {
    const shell = mount?.querySelector(".reflectiv-chat");
    const sendBtn = shell?._sendBtn || shell?.querySelector(".chat-input .btn");
    if (sendBtn) {
      sendBtn.disabled = false;
    }
  }

  function disableSendButton() {
    const shell = mount?.querySelector(".reflectiv-chat");
    const sendBtn = shell?._sendBtn || shell?.querySelector(".chat-input .btn");
    if (sendBtn) {
      sendBtn.disabled = true;
    }
  }

  function startHealthRetry() {
    if (healthCheckInterval) return;

    healthCheckInterval = setInterval(async () => {
      await checkHealth();
    }, 20000); // 20 seconds
  }

  // ---------- Toast notifications ----------
  function showToast(message, type = "error") {
    const toast = document.createElement("div");
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      max-width: 400px;
      padding: 14px 18px;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 600;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10000;
      animation: slideIn 0.3s ease-out;
      ${type === "error" ? "background:#fee;border:1px solid #f5c2c2;color:#991b1b;" : "background:#e8f6ee;border:1px solid #bfe7cf;color:#0b5a2a;"}
    `;
    toast.textContent = message;

    // Add animation
    const style = document.createElement("style");
    style.textContent = `@keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`;
    if (!document.querySelector('style[data-toast-anim]')) {
      style.setAttribute('data-toast-anim', 'true');
      document.head.appendChild(style);
    }

    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.transition = "opacity 0.3s ease-out";
      toast.style.opacity = "0";
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, 5000);
  }

  // === EI summary renderer for yellow panel ===
  function renderEiPanel(msg) {
    const coach = msg && msg._coach;
    if (!coach || !coach.scores) return "";

    const S = coach.scores || {};
    const R = coach.rationales || {};
    const tips = Array.isArray(coach.tips) ? coach.tips.slice(0, 3) : [];
    const rubver = coach.rubric_version || "v2.0";

    // Enhanced clickable card with animation delay, tooltips, and score-based styling
    const mkCard = (k, label, idx) => {
      const v = Number(S[k] ?? 0);
      const val = (v || v === 0) ? String(v) : "–";
      const animDelay = idx * 0.08; // Stagger animation 80ms per card
      
      // Score-based color classes
      let scoreClass = "ei-score-default";
      if (v >= 4) scoreClass = "ei-score-excellent";
      else if (v >= 3) scoreClass = "ei-score-good";
      else if (v >= 2) scoreClass = "ei-score-fair";
      else if (v >= 1) scoreClass = "ei-score-needs-work";
      
      // Tooltip content (rationale if available)
      const tooltip = R[k] ? esc(R[k]) : `Click to learn about ${esc(label)}`;
      
      return `<div class="ei-card ${scoreClass}" data-metric="${k}" data-tooltip="${tooltip}" style="animation-delay:${animDelay}s">
        <div class="ei-card-label">${esc(label)}</div>
        <div class="ei-card-score">${esc(val)}<span class="ei-card-max">/5</span></div>
        <div class="ei-card-icon">→</div>
        <div class="ei-tooltip">${tooltip}</div>
      </div>`;
    };

    return `
  <div class="ei-wrap">
    <div class="ei-h">Emotional Intelligence Summary</div>
    <div class="ei-grid">
      ${mkCard("empathy", "Empathy", 0)}
      ${mkCard("clarity", "Clarity", 1)}
      ${mkCard("compliance", "Compliance", 2)}
      ${mkCard("discovery", "Discovery", 3)}
      ${mkCard("objection_handling", "Objection Handling", 4)}
      ${mkCard("confidence", "Confidence", 5)}
      ${mkCard("active_listening", "Active Listening", 6)}
      ${mkCard("adaptability", "Adaptability", 7)}
      ${mkCard("action_insight", "Action Insight", 8)}
      ${mkCard("resilience", "Resilience", 9)}
    </div>
    ${tips.length ? `<ul class="ei-tips">${tips.map(t => `<li>${esc(t)}</li>`).join("")}</ul>` : ""}
    <div class="ei-meta">Scored via EI rubric ${esc(rubver)} · <a href="/docs/about-ei.html#scoring" target="_blank" rel="noopener">how scoring works</a></div>
  </div>`;
  }

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
    // Normalize by removing trailing slashes
    return (window.WORKER_URL || "").replace(/\/+$/, "");
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
  function fallbackText(mode) {
    if (mode === "sales-coach") {
      return "Keep it concise. Acknowledge the HCP’s context, give one actionable tip, then end with a single discovery question.";
    }
    if (mode === "product-knowledge") {
      return "Brief overview: indication, one efficacy point, one safety consideration. Cite label or guideline.";
    }
    if (mode === "role-play") {
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
    } catch (_) { }

    // Pass 2: fresh completion with corrective rails prepended to original convo
    try {
      const hardened = [{ role: "system", content: correctiveRails(sc) }, ...messages];
      const r2 = await callModelFn(hardened);
      out = sanitizeRolePlayOnly(r2);
      if (!isGuidanceLeak(out)) return out;
    } catch (_) { }

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

  /**
   * formatSalesCoachReply - Format sales-coach responses with proper structure
   * Expected format:
   * Challenge: [text]
   *
   * Rep Approach:
   * • [bullet]
   * • [bullet]
   *
   * Impact: [text]
   *
   * Suggested Phrasing: "[text]"
   */
  function formatSalesCoachReply(text) {
    if (!text) return "";

    console.log('[Sales Coach Format] Input text:', text.substring(0, 200));

    let html = "";

    // DEDUPLICATION: LLM sometimes repeats sections 2-3x - remove duplicates first
    // Look for patterns like "Challenge: X... Challenge: X..." and keep only first occurrence
    let cleanedText = text;

    // Remove duplicate "Challenge:" sections
    const challengeRegex = /(Challenge:\s*.+?)(\s+Challenge:)/is;
    while (challengeRegex.test(cleanedText)) {
      cleanedText = cleanedText.replace(challengeRegex, '$1');
    }

    // Remove duplicate "Rep Approach:" sections
    const repRegex = /(Rep Approach:\s*.+?)(\s+Rep Approach:)/is;
    while (repRegex.test(cleanedText)) {
      cleanedText = cleanedText.replace(repRegex, '$1');
    }

    // Remove duplicate "Impact:" sections
    const impactRegex = /(Impact:\s*.+?)(\s+Impact:)/is;
    while (impactRegex.test(cleanedText)) {
      cleanedText = cleanedText.replace(impactRegex, '$1');
    }

    // Remove duplicate "Suggested Phrasing:" sections
    const phrasingRegex = /(Suggested Phrasing:\s*.+?)(\s+Suggested Phrasing:)/is;
    while (phrasingRegex.test(cleanedText)) {
      cleanedText = cleanedText.replace(phrasingRegex, '$1');
    }

    // CRITICAL: Stop at first occurrence of each section to avoid duplication
    // Split by major sections - use NON-GREEDY matching and stop at next section header
    const challengeMatch = cleanedText.match(/Challenge:\s*(.+?)(?=\s+Rep Approach:|$)/is);
    const repApproachMatch = cleanedText.match(/Rep Approach:\s*(.+?)(?=\s+Impact:|$)/is);
    const impactMatch = cleanedText.match(/Impact:\s*(.+?)(?=\s+Suggested Phrasing:|$)/is);
    // GREEDY match for Suggested Phrasing (last section) to capture full text, not truncate mid-sentence
    const phrasingMatch = cleanedText.match(/Suggested Phrasing:\s*[""']?(.+)[""']?\s*(?=\s*(?:<coach>|$))/is);

    console.log('[Sales Coach Format] Matches:', {
      challenge: !!challengeMatch,
      repApproach: !!repApproachMatch,
      impact: !!impactMatch,
      phrasing: !!phrasingMatch
    });

    // Challenge section
    if (challengeMatch) {
      const challengeText = challengeMatch[1].trim();
      html += `<div class="sales-sim-section">`;
      html += `<div class="section-header"><strong>Challenge:</strong></div>`;
      html += `<div class="section-content">${convertCitations(esc(challengeText))}</div>`;
      html += `</div>\n\n`;
    }

    // Rep Approach section
    if (repApproachMatch) {
      const repText = repApproachMatch[1].trim();
      html += `<div class="sales-sim-section">`;
      html += `<div class="section-header"><strong>Rep Approach:</strong></div>`;
      html += `<ul class="section-bullets">`;

      // Extract bullets - split on bullet characters (•, ●, ○) since LLM doesn't use newlines
      const bullets = repText
        .split(/\s*[•●○]\s*/)
        .map(b => b.trim())
        .filter(b => b.length > 0 && b.length < 500); // Filter out garbage/duplicates

      bullets.forEach(bullet => {
        html += `<li>${convertCitations(esc(bullet))}</li>`;
      });

      html += `</ul>`;
      html += `</div>\n\n`;
    }

    // Impact section
    if (impactMatch) {
      const impactText = impactMatch[1].trim();
      html += `<div class="sales-sim-section">`;
      html += `<div class="section-header"><strong>Impact:</strong></div>`;
      html += `<div class="section-content">${convertCitations(esc(impactText))}</div>`;
      html += `</div>\n\n`;
    }

    // Suggested Phrasing section
    if (phrasingMatch) {
      const phrasingText = phrasingMatch[1].trim().replace(/^["']|["']$/g, ''); // Remove quotes
      html += `<div class="sales-sim-section">`;
      html += `<div class="section-header"><strong>Suggested Phrasing:</strong></div>`;
      html += `<div class="section-quote">"${convertCitations(esc(phrasingText))}"</div>`;
      html += `</div>`;
    }

    if (!html) {
      console.error('[Sales Coach Format] CRITICAL: No sections matched - text may be malformed');
      console.error('[Sales Coach Format] Text preview:', text.substring(0, 500));
      // DO NOT fall back to md() - return a warning instead to preserve structure
      return `<div class="sales-sim-section" style="background:#fee;padding:12px;border:2px solid #f00;border-radius:6px">
        <strong style="color:#c00">⚠️ Format Error:</strong> Unable to parse Sales Coach response. Expected format:
        <pre style="margin:8px 0;font-size:11px;background:#fff;padding:8px;border-radius:4px">Challenge: [text]
Rep Approach:
• [bullet]
Impact: [text]
Suggested Phrasing: "[text]"</pre>
        <details style="margin-top:8px">
          <summary style="cursor:pointer;color:#666">Show raw response</summary>
          <div style="margin-top:8px;font-size:12px;max-height:200px;overflow-y:auto;background:#f9f9f9;padding:8px;border-radius:4px">${esc(text)}</div>
        </details>
      </div>`;
    }

    console.log('[Sales Coach Format] Successfully formatted', html.length, 'chars');
    return html;
  }

  function md(text) {
    if (!text) return "";
    let s = esc(String(text)).replace(/\r\n?/g, "\n");

    // Pre-process: Force line breaks BEFORE numbered items and bullets that appear inline
    // This handles: "text 1. Item" -> "text\n1. Item"
    s = s.replace(/([.!?])\s+(\d+\.)\s+/g, "$1\n$2 ");
    s = s.replace(/([a-z])\s+(\d+\.)\s+([A-Z])/g, "$1\n$2 $3");

    // Force line breaks before inline bullets/dashes (but not hyphens in words)
    s = s.replace(/([.:])\s+(-\s+[A-Z])/g, "$1\n$2");
    s = s.replace(/([a-z])\.\s+(-\s+)/g, "$1.\n$2");

    // Code blocks FIRST (before other processing): ```code``` -> <pre><code>code</code></pre>
    s = s.replace(/```([^`]+)```/g, "<pre><code>$1</code></pre>");

    // Headers: ## Header -> <h3>Header</h3>, ### Header -> <h4>Header</h4>
    s = s.replace(/^###\s+(.+)$/gm, "<h4>$1</h4>");
    s = s.replace(/^##\s+(.+)$/gm, "<h3>$1</h3>");

    // Numbered lists: 1. item -> <ol><li>item</li></ol>
    // Process BEFORE bold so we can apply bold inside list items
    s = s.replace(
      /^(?:\d+\.\s+).+(?:\n(?:\d+\.\s+).+)*/gm,
      (blk) => {
        const items = blk
          .split("\n")
          .map((l) => {
            const match = l.match(/^\d+\.\s+(.+)$/);
            if (match) {
              let content = match[1];
              // Apply bold, italic, inline code to list item content
              content = content.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
              content = content.replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
              content = content.replace(/`([^`]+)`/g, "<code>$1</code>");

              // Handle nested bullets INSIDE numbered items (e.g., "1. Item - sub" -> includes sub-bullets)
              if (content.includes(" - ")) {
                const parts = content.split(/\s+-\s+/);
                const main = parts[0];
                const subs = parts.slice(1);
                if (subs.length > 0) {
                  return `<li>${main}<ul>${subs.map(sub => `<li>${sub}</li>`).join('')}</ul></li>`;
                }
              }

              return `<li>${content}</li>`;
            }
            return "";
          })
          .join("");
        return `<ol>${items}</ol>`;
      }
    );

    // UNICODE bullet lists: • item -> <ul><li>item</li></ul>
    s = s.replace(
      /^(?:•\s+|●\s+|○\s+).+(?:\n(?:•\s+|●\s+|○\s+).+)*/gm,
      (blk) => {
        const items = blk
          .split("\n")
          .map((l) => {
            const match = l.match(/^(?:•\s+|●\s+|○\s+)(.+)$/);
            if (match) {
              let content = match[1];
              content = content.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
              content = content.replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
              content = content.replace(/`([^`]+)`/g, "<code>$1</code>");
              return `<li>${content}</li>`;
            }
            return "";
          })
          .join("");
        return `<ul>${items}</ul>`;
      }
    );

    // Markdown bullet lists: - item or * item -> <ul><li>item</li></ul>
    // Process BEFORE bold so we can apply bold inside list items
    s = s.replace(
      /^(?:-\s+|\*\s+).+(?:\n(?:-\s+|\*\s+).+)*/gm,
      (blk) => {
        const items = blk
          .split("\n")
          .map((l) => {
            const match = l.match(/^(?:-\s+|\*\s+)(.+)$/);
            if (match) {
              let content = match[1];
              // Apply bold, italic, inline code to list item content
              content = content.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
              content = content.replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
              content = content.replace(/`([^`]+)`/g, "<code>$1</code>");
              return `<li>${content}</li>`;
            }
            return "";
          })
          .join("");
        return `<ul>${items}</ul>`;
      }
    );

    // Bold, italic, inline code for NON-list text: **text** -> <strong>text</strong>
    s = s.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
    s = s.replace(/`([^`]+)`/g, "<code>$1</code>");

    // Wrap paragraphs in <p> tags (skip if already wrapped in HTML)
    return s
      .split(/\n{2,}/)
      .map((p) => {
        if (p.startsWith("<ul>") || p.startsWith("<ol>") || p.startsWith("<h3>") ||
          p.startsWith("<h4>") || p.startsWith("<pre>")) {
          return p;
        }
        return `<p>${p.replace(/\n/g, "<br>")}</p>`;
      })
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
      // Fallback: Return raw block text as feedback field
      return { coach: { feedback: block.trim() }, clean: sanitizeLLM(head) };
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
      } else {
        // Last resort: Return raw block text as feedback
        coach = { feedback: block.trim() };
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

    // Advanced metrics (defaults for deterministic scoring - LLM will provide real scores)
    const confidence = sig.accuracyCue && !sig.tooLong ? 4 : 3;
    const active_listening = sig.empathy ? 3 : 2;
    const adaptability = sig.objection ? 3 : 2;
    const action_insight = sig.discovery ? 3 : 2;
    const resilience = sig.objection && sig.empathy ? 3 : 2;

    const W = {
      empathy: 0.12, clarity: 0.12, compliance: 0.14, discovery: 0.12,
      objection_handling: 0.11, confidence: 0.11,
      active_listening: 0.09, adaptability: 0.08, action_insight: 0.06, resilience: 0.05
    };
    const toPct = (v) => v * 20;

    let overall =
      toPct(empathy) * W.empathy +
      toPct(clarity) * W.clarity +
      toPct(compliance) * W.compliance +
      toPct(discovery) * W.discovery +
      toPct(objection_handling) * W.objection_handling +
      toPct(confidence) * W.confidence +
      toPct(active_listening) * W.active_listening +
      toPct(adaptability) * W.adaptability +
      toPct(action_insight) * W.action_insight +
      toPct(resilience) * W.resilience;
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
      scores: { empathy, clarity, compliance, discovery, objection_handling, confidence, active_listening, adaptability, action_insight, resilience },
      feedback:
        "Be concise, cite label or guidelines for clinical points, ask one focused discovery question, and propose a concrete next step.",
      worked,
      improve,
      phrasing,
      context: { rep_question: String(userText || ""), hcp_reply: String(replyText || "") },
      score: overall,
      subscores: { empathy, clarity, compliance, discovery, objection_handling, confidence, active_listening, adaptability, action_insight, resilience }
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
    ["understand", "appreciate", "concern", "feel", "sorry", "hear", "sounds like", "empathize", "thanks", "acknowledge"].forEach((kw) => { if (text.includes(kw)) score++; });
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
    ["stress", "busy", "overwhelmed", "frustrated", "tired", "pressure", "deadline"].forEach((kw) => { if (text.includes(kw)) score++; });
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
     "scores": { "empathy":0-5,"clarity":0-5,"compliance":0-5,"discovery":0-5,"objection_handling":0-5,"confidence":0-5,"active_listening":0-5,"adaptability":0-5,"action_insight":0-5,"resilience":0-5 },
     "worked": ["…"],
     "improve": ["…"],
     "phrasing": "…",
     "feedback": "one concise paragraph",
     "context": { "rep_question":"...", "hcp_reply":"..." }
   }</coach>`;

    const personaLine = currentPersonaHint();

    if (mode === "sales-coach") {
      return (
        `# Role
You are a virtual pharma coach. Be direct, label-aligned, and safe.

# Scenario
${personaLine}
${sc
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
#reflectiv-widget .chat-messages{min-height:220px;height:auto;max-height:none;overflow:auto;padding:12px 14px;background:#fafbfd;position:relative;z-index:1}
#reflectiv-widget .message{margin:8px 0;display:flex;position:relative;z-index:1}
#reflectiv-widget .message.user{justify-content:flex-end}
#reflectiv-widget .message.assistant{justify-content:flex-start}
#reflectiv-widget .message .content{max-width:85%;line-height:1.6;font-size:14px;padding:12px 14px;border-radius:14px;border:1px solid #d6dbe3;color:#0f1522;background:#e9edf3;position:relative;z-index:1}
#reflectiv-widget .message.user .content{background:#e0e0e0;color:#000}
#reflectiv-widget .message .content p{margin:0 0 8px 0;line-height:1.6}
#reflectiv-widget .message .content p:last-child{margin-bottom:0}
#reflectiv-widget .chat-input{display:flex;gap:8px;padding:10px 12px;border-top:1px solid #e1e6ef;background:#fff}
#reflectiv-widget .chat-input textarea{flex:1;resize:none;min-height:44px;max-height:120px;padding:10px 12px;border:1px solid #cfd6df;border-radius:10px;outline:none}
#reflectiv-widget .chat-input .btn{min-width:86px;border:0;border-radius:999px;background:#2f3a4f;color:#fff;font-weight:600}
#reflectiv-widget .coach-section{margin-top:0;padding:12px 14px;border:1px solid #e1e6ef;border-radius:12px;background:#fffbe8;position:relative;z-index:10;clear:both}
#reflectiv-widget .coach-subs .pill{display:inline-block;padding:2px 8px;margin-right:6px;font-size:12px;background:#f1f3f7;border:1px solid #d6dbe3;border-radius:999px}
#reflectiv-widget .scenario-meta .meta-card{padding:10px 12px;background:#f7f9fc;border:1px solid #e1e6ef;border-radius:10px}
#reflectiv-widget .hidden{display:none!important}
#reflectiv-widget .speaker{display:inline-block;margin:0 0 8px 0;padding:4px 10px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;border-radius:999px;border:1px solid #cfd6df}
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
/* === EI summary in yellow panel === */
#reflectiv-widget .ei-wrap{padding:10px 12px}
#reflectiv-widget .ei-h{font:700 14px/1.2 Inter,system-ui;margin:0 0 8px}

/* Enhanced EI Grid Cards */
#reflectiv-widget .ei-grid{display:grid;grid-template-columns:repeat(5, 1fr);gap:8px;margin:0 0 12px;max-width:100%}
#reflectiv-widget .ei-card{
  background:linear-gradient(135deg, #1e3a5f 0%, #0f2747 100%);
  border-radius:12px;
  padding:12px 10px;
  cursor:pointer;
  transition:all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position:relative;
  overflow:visible;
  border:1px solid rgba(32, 191, 169, 0.2);
  animation:fadeInUp 0.5s ease-out forwards;
  opacity:0;
  transform:translateY(10px);
}

@keyframes fadeInUp{
  to{opacity:1;transform:translateY(0)}
}

#reflectiv-widget .ei-card:hover{
  transform:translateY(-4px) scale(1.02);
  border-color:rgba(32, 191, 169, 0.6);
  box-shadow:0 8px 16px rgba(32, 191, 169, 0.3), 0 0 0 1px rgba(32, 191, 169, 0.4);
  background:linear-gradient(135deg, #223052 0%, #14304d 100%);
  z-index:10;
}

/* Score-based color accents */
#reflectiv-widget .ei-card.ei-score-excellent{border-color:rgba(16, 185, 129, 0.4)}
#reflectiv-widget .ei-card.ei-score-excellent:hover{border-color:rgba(16, 185, 129, 0.8);box-shadow:0 8px 16px rgba(16, 185, 129, 0.4), 0 0 0 1px rgba(16, 185, 129, 0.5)}
#reflectiv-widget .ei-card.ei-score-excellent .ei-card-label{color:#10b981}

#reflectiv-widget .ei-card.ei-score-good{border-color:rgba(59, 130, 246, 0.4)}
#reflectiv-widget .ei-card.ei-score-good:hover{border-color:rgba(59, 130, 246, 0.8);box-shadow:0 8px 16px rgba(59, 130, 246, 0.4), 0 0 0 1px rgba(59, 130, 246, 0.5)}
#reflectiv-widget .ei-card.ei-score-good .ei-card-label{color:#3b82f6}

#reflectiv-widget .ei-card.ei-score-fair{border-color:rgba(245, 158, 11, 0.4)}
#reflectiv-widget .ei-card.ei-score-fair:hover{border-color:rgba(245, 158, 11, 0.8);box-shadow:0 8px 16px rgba(245, 158, 11, 0.4), 0 0 0 1px rgba(245, 158, 11, 0.5)}
#reflectiv-widget .ei-card.ei-score-fair .ei-card-label{color:#f59e0b}

#reflectiv-widget .ei-card.ei-score-needs-work{border-color:rgba(239, 68, 68, 0.4)}
#reflectiv-widget .ei-card.ei-score-needs-work:hover{border-color:rgba(239, 68, 68, 0.8);box-shadow:0 8px 16px rgba(239, 68, 68, 0.4), 0 0 0 1px rgba(239, 68, 68, 0.5)}
#reflectiv-widget .ei-card.ei-score-needs-work .ei-card-label{color:#ef4444}

#reflectiv-widget .ei-card-label{
  font:600 10px/1.2 Inter,system-ui;
  color:#20bfa9;
  text-transform:uppercase;
  letter-spacing:0.5px;
  margin-bottom:6px;
  transition:color 0.3s;
}

#reflectiv-widget .ei-card-score{
  font:700 24px/1 Inter,system-ui;
  color:#ffffff;
  text-shadow:0 2px 4px rgba(0,0,0,0.3);
}

#reflectiv-widget .ei-card-score .ei-card-max{
  font-size:14px;
  opacity:0.7;
  margin-left:2px;
}

#reflectiv-widget .ei-card-icon{
  position:absolute;
  top:10px;
  right:10px;
  font-size:16px;
  color:#20bfa9;
  opacity:0.6;
  transition:all 0.3s;
}

#reflectiv-widget .ei-card:hover .ei-card-icon{
  opacity:1;
  transform:translateX(3px);
}

/* Tooltip styling */
#reflectiv-widget .ei-tooltip{
  position:absolute;
  bottom:calc(100% + 8px);
  left:50%;
  transform:translateX(-50%) translateY(-5px);
  background:rgba(15, 23, 42, 0.95);
  backdrop-filter:blur(8px);
  color:#fff;
  padding:8px 12px;
  border-radius:8px;
  font-size:11px;
  line-height:1.4;
  white-space:normal;
  max-width:220px;
  text-align:center;
  pointer-events:none;
  opacity:0;
  transition:all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  z-index:1000;
  box-shadow:0 4px 12px rgba(0, 0, 0, 0.3);
  border:1px solid rgba(255, 255, 255, 0.1);
}

#reflectiv-widget .ei-tooltip::before{
  content:'';
  position:absolute;
  top:100%;
  left:50%;
  transform:translateX(-50%);
  border:6px solid transparent;
  border-top-color:rgba(15, 23, 42, 0.95);
}

#reflectiv-widget .ei-card:hover .ei-tooltip{
  opacity:1;
  transform:translateX(-50%) translateY(0);
}
  font-size:16px;
  color:#20bfa9;
  opacity:0.6;
  transition:all 0.3s;
}

#reflectiv-widget .ei-card:hover .ei-card-icon{
  opacity:1;
  transform:translateX(3px);
}

/* Responsive: stack on smaller screens */
@media (max-width:768px){#reflectiv-widget .ei-grid{grid-template-columns:repeat(2, 1fr)}}

/* Legacy pill styles (kept for backward compatibility) */
#reflectiv-widget .ei-row{display:grid;grid-template-columns:repeat(5, 1fr);gap:6px;margin:0 0 8px;max-width:100%}
#reflectiv-widget .ei-pill{font:700 10px/1.2 Inter,system-ui; padding:8px 6px; border-radius:999px; cursor:pointer; transition:all 0.2s; color:white; text-shadow:0 1px 2px rgba(0,0,0,0.2); text-align:center; white-space:nowrap; overflow:hidden; text-overflow:ellipsis}
#reflectiv-widget .ei-pill:hover{transform:translateY(-1px); filter:brightness(1.1)}
#reflectiv-widget .ei-pill .k{opacity:.9; margin-right:4px; font-weight:600; display:block; font-size:9px; text-transform:uppercase; letter-spacing:0.3px}

/* Gradient-coded pills by metric */
#reflectiv-widget .ei-pill[data-metric="empathy"]{background:linear-gradient(135deg, #10b981 0%, #059669 100%); border:1px solid #059669}
#reflectiv-widget .ei-pill[data-metric="clarity"]{background:linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); border:1px solid #7c3aed}
#reflectiv-widget .ei-pill[data-metric="compliance"]{background:linear-gradient(135deg, #ef4444 0%, #dc2626 100%); border:1px solid #dc2626}
#reflectiv-widget .ei-pill[data-metric="discovery"]{background:linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); border:1px solid #2563eb}
#reflectiv-widget .ei-pill[data-metric="objection_handling"]{background:linear-gradient(135deg, #f59e0b 0%, #d97706 100%); border:1px solid #d97706}
#reflectiv-widget .ei-pill[data-metric="confidence"]{background:linear-gradient(135deg, #06b6d4 0%, #0891b2 100%); border:1px solid #0891b2}
#reflectiv-widget .ei-pill[data-metric="active_listening"]{background:linear-gradient(135deg, #14b8a6 0%, #0d9488 100%); border:1px solid #0d9488}
#reflectiv-widget .ei-pill[data-metric="adaptability"]{background:linear-gradient(135deg, #ec4899 0%, #db2777 100%); border:1px solid #db2777}
#reflectiv-widget .ei-pill[data-metric="action_insight"]{background:linear-gradient(135deg, #f97316 0%, #ea580c 100%); border:1px solid #ea580c}
#reflectiv-widget .ei-pill[data-metric="resilience"]{background:linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); border:1px solid #4f46e5}

/* Responsive: stack on smaller screens */
@media (max-width:768px){#reflectiv-widget .ei-row{grid-template-columns:repeat(3, 1fr)}}

#reflectiv-widget .ei-tips{margin:8px 0 0; padding-left:16px}
#reflectiv-widget .ei-tips li{margin:2px 0}
#reflectiv-widget .ei-meta{margin-top:8px; font:500 11px/1.3 Inter,system-ui; opacity:.8}
#reflectiv-widget .ei-meta a{text-decoration:underline}
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

    // Add debug footer if ?debug=1
    if (isDebugMode()) {
      telemetryFooter = el("div", "telemetry-footer");
      // Style for minimal, unobtrusive debug footer
      Object.assign(telemetryFooter.style, {
        position: "absolute",
        bottom: "64px",
        left: "16px",
        right: "16px",
        fontSize: "12px",
        fontFamily: "monospace",
        opacity: "0.7",
        color: "#2f3a4f",
        padding: "4px 8px",
        background: "rgba(255,255,255,0.9)",
        borderTop: "1px solid #e1e6ef",
        pointerEvents: "none",
        zIndex: "100"
      });
      telemetryFooter.textContent = "TTFB/FirstChunk/Done: –.– / –.– / –.– • retries:0 • —";
      shell.style.position = "relative";
      shell.appendChild(telemetryFooter);
    }

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
      Object.keys(LC_TO_INTERNAL).find((k) => LC_TO_INTERNAL[k] === (cfg?.defaultMode || "sales-coach")) ||
      "Sales Coach";
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
      console.log('[DEBUG] Send button clicked!');
      const t = ta.value.trim();
      console.log('[DEBUG] Message text:', t);
      if (!t) {
        console.log('[DEBUG] Empty message, returning');
        return;
      }
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
    feedbackDisplayElem.style.position = "relative";
    feedbackDisplayElem.style.zIndex = "15";
    feedbackDisplayElem.style.background = "#fffbe8";
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
      if (scenariosLoadError) {
        // Show error and disable dropdown
        setSelectOptions(diseaseSelect, [{ value: "", label: "⚠ Failed to load scenarios" }], true);
        diseaseSelect.disabled = true;
        hcpSelect.disabled = true;
        setSelectOptions(hcpSelect, [{ value: "", label: "—" }], true);

        // Show inline error message in meta area if available
        const metaEl = mount.querySelector(".scenario-meta");
        if (metaEl) {
          metaEl.innerHTML = `<div style="padding:10px 12px;background:#fdeaea;border:1px solid #f5c2c2;border-radius:10px;color:#991b1b;">
            <strong>⚠ Data Loading Error:</strong> Could not load scenarios. Please check your connection or contact support.
          </div>`;
        }
        return;
      }

      const ds = getDiseaseStates();
      setSelectOptions(diseaseSelect, ds, true);

      // Enable if we have scenarios
      if (scenarios.length > 0) {
        diseaseSelect.disabled = false;
      } else {
        diseaseSelect.disabled = true;
        setSelectOptions(diseaseSelect, [{ value: "", label: "No scenarios available" }], true);
      }
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
      const showMeta = currentMode === "sales-coach" || currentMode === "role-play";
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

        // ALWAYS show speaker chips for clarity
        if (currentMode === "role-play") {
          // Always show 'HCP' for assistant in role-play mode, 'Rep' for user
          const chipText = m.role === "assistant" ? "HCP" : "Rep";
          const chipCls = m.role === "assistant" ? "speaker hcp" : "speaker rep";
          const chip = el("div", chipCls, chipText);
          c.appendChild(chip);
        } else if (currentMode === "sales-coach") {
          // Sales Coach shows "Sales Coach" for assistant, "Rep" for user
          const chipText = m.role === "assistant" ? "Sales Coach" : "Rep";
          const chipCls = m.role === "assistant" ? "speaker coach" : "speaker rep";
          const chip = el("div", chipCls, chipText);
          c.appendChild(chip);
        } else if (currentMode === "product-knowledge") {
          // Product Knowledge shows "Coach" for assistant, "User" for user
          const chipText = m.role === "assistant" ? "Coach" : "User";
          const chipCls = m.role === "assistant" ? "speaker coach" : "speaker user";
          const chip = el("div", chipCls, chipText);
          c.appendChild(chip);
        } else if (currentMode === "emotional-assessment") {
          // Emotional Assessment shows "Coach" for assistant, "User" for user
          const chipText = m.role === "assistant" ? "Coach" : "User";
          const chipCls = m.role === "assistant" ? "speaker coach" : "speaker user";
          const chip = el("div", chipCls, chipText);
          c.appendChild(chip);
        } else {
          // Fallback for any other modes (should not happen with validation)
          const chipText = m.role === "assistant" ? "Assistant" : "You";
          const chipCls = m.role === "assistant" ? "speaker assistant" : "speaker user";
          const chip = el("div", chipCls, chipText);
          c.appendChild(chip);
        }

        const body = el("div");
        // CRITICAL: Clone content to prevent mutation
        const rawContent = String(m.content || '');
        const normalized = normalizeGuidanceLabels(rawContent);

        // Use special formatting for sales-coach mode AND role-play HCP responses
        // CRITICAL: Check message's own _mode, not global currentMode, to preserve formatting across mode switches
        if (m._mode === "sales-coach" && m.role === "assistant") {
          console.log('[renderMessages] ========== SALES COACH MESSAGE ==========');
          console.log('[renderMessages] m._mode:', m._mode);
          console.log('[renderMessages] m.role:', m.role);
          console.log('[renderMessages] Has cached HTML?', !!m._formattedHTML);
          console.log('[renderMessages] rawContent preview:', rawContent.substring(0, 200));
          console.log('[renderMessages] normalized preview:', normalized.substring(0, 200));

          // Cache formatted HTML to avoid re-parsing on every render
          if (!m._formattedHTML) {
            console.log('[renderMessages] NO CACHE - Formatting now...');
            m._formattedHTML = formatSalesCoachReply(normalized);
            console.log('[renderMessages] Cached HTML length:', m._formattedHTML.length);
            console.log('[renderMessages] Cached HTML preview:', m._formattedHTML.substring(0, 300));
          } else {
            console.log('[renderMessages] USING CACHED HTML - length:', m._formattedHTML.length);
          }
          body.innerHTML = m._formattedHTML;
        } else if (m._mode === "role-play" && (m.role === "assistant" || m._speaker === "hcp")) {
          // Format HCP responses in Role Play mode with clean structure
          console.log('[renderMessages] Formatting HCP response in role-play mode');
          if (!m._formattedHTML) {
            m._formattedHTML = md(normalized); // Use markdown formatter for clean structure
          }
          body.innerHTML = m._formattedHTML;
        } else {
          body.innerHTML = md(normalized);
        }

        c.appendChild(body);

        row.appendChild(c);
        msgsEl.appendChild(row);
      }
      msgsEl.scrollTop = msgsEl.scrollHeight;
    }

    function orderedPills(scores) {
      const order = ["empathy", "clarity", "compliance", "discovery", "objection_handling", "confidence", "active_listening", "adaptability", "action_insight", "resilience"];
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

      // Sales Coach yellow panel spec:
      if (currentMode === "sales-coach") {
        const eiHTML = renderEiPanel(last);

        // Fallback to old yellow panel HTML if no EI data
        const oldYellowHTML = (() => {
          const workedStr = fb.worked && fb.worked.length ? `<ul>${fb.worked.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : "";
          const improveStr = fb.improve && fb.improve.length ? `<ul>${fb.improve.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : "";
          const phrasingStr = fb.phrasing || "";

          // If parsed fields exist, use structured format
          if (workedStr || improveStr || phrasingStr) {
            return `
            <div class="coach-subs" style="display:none">${orderedPills(scores)}</div>
            <ul class="coach-list">
              ${workedStr ? `<li><strong>Focus:</strong> ${workedStr}</li>` : ""}
              ${improveStr ? `<li><strong>Strategy:</strong> ${improveStr}</li>` : ""}
              ${phrasingStr ? `<li><strong>Suggested Phrasing:</strong><div class="mono">${esc(phrasingStr)}</div></li>` : ""}
            </ul>
            ${repOnlyPanelHTML ? `<div style="margin-top:10px;padding-top:10px;border-top:1px dashed #e1e6ef">${repOnlyPanelHTML}</div>` : ""}`;
          }

          // Otherwise display raw feedback text with formatted labels + COMPLIANCE FLAGS
          const rawText = fb.feedback || fb.comment || "";
          if (rawText) {
            // Split into sections by extracting each labeled block
            const sections = [];
            const text = String(rawText);
            const complianceFlags = [];

            // Check for compliance issues
            const offLabelTerms = /\b(off-label|unapproved|investigational|experimental)\b/gi;
            const missingCitations = !text.match(/\[[\w-]+\]/g);
            const comparativeClaims = /\b(better than|superior to|more effective than|outperforms)\b/gi;

            if (offLabelTerms.test(text)) {
              complianceFlags.push('⚠️ Off-label language detected');
            }
            if (missingCitations && text.length > 100) {
              complianceFlags.push('⚠️ Missing fact citations');
            }
            if (comparativeClaims.test(text)) {
              complianceFlags.push('⚠️ Comparative claim requires data');
            }

            // Show compliance alerts at top if any
            if (complianceFlags.length > 0) {
              sections.push(`<div style="margin-bottom:16px;padding:12px;background:#fff7e6;border:1px solid:#fbbf24;border-radius:8px"><strong style="color:#92400e;display:block;margin-bottom:4px">⚠️ Compliance Review Needed:</strong><ul style="margin:4px 0;padding-left:20px;color:#92400e">${complianceFlags.map(f => `<li>${f}</li>`).join('')}</ul></div>`);
            }

            // Extract Challenge
            const challengeMatch = text.match(/Challenge:\s*(.+?)(?=\s*Rep Approach:|$)/is);
            if (challengeMatch) {
              sections.push(`<div style="margin-bottom:16px"><strong style="display:block;margin-bottom:8px;color:#2f3a4f;font-size:15px">Challenge:</strong><div style="line-height:1.6">${esc(challengeMatch[1].trim())}</div></div>`);
            }

            // Extract Rep Approach
            const repMatch = text.match(/Rep Approach:\s*(.+?)(?=\s*Impact:|$)/is);
            if (repMatch) {
              const repText = repMatch[1].trim();
              const bullets = repText.split(/\s*•\s*/).filter(Boolean).map(b => {
                const bulletText = convertCitations(esc(b.trim()));
                return `<li style="margin:8px 0;line-height:1.7">${bulletText}</li>`;
              }).join('');
              sections.push(`<div style="margin-bottom:16px"><strong style="display:block;margin-bottom:8px;color:#2f3a4f;font-size:15px">Rep Approach:</strong><ul style="margin:0;padding-left:20px;line-height:1.8;list-style-type:disc">${bullets}</ul></div>`);
            }

            // Extract Impact
            const impactMatch = text.match(/Impact:\s*(.+?)(?=\s*Suggested Phrasing:|$)/is);
            if (impactMatch) {
              sections.push(`<div style="margin-bottom:16px"><strong style="display:block;margin-bottom:8px;color:#2f3a4f;font-size:15px">Impact:</strong><div style="line-height:1.6">${esc(impactMatch[1].trim())}</div></div>`);
            }

            // Extract Suggested Phrasing
            const phrasingMatch = text.match(/Suggested Phrasing:\s*(.+)/is);
            if (phrasingMatch) {
              const phrase = phrasingMatch[1].trim().replace(/^["']|["']$/g, '');
              sections.push(`<div style="margin-bottom:16px"><strong style="display:block;margin-bottom:8px;color:#2f3a4f;font-size:15px">Suggested Phrasing:</strong><div style="line-height:1.6;font-style:italic;padding:12px;background:#f0fdf4;border-left:3px solid:#22c55e;color:#1e2a3a">"${esc(phrase)}"</div></div>`);
            }

            return `<div class="coach-subs" style="display:none">${orderedPills(scores)}</div><div>${sections.join('')}</div>`;
          }

          return `<div class="coach-subs" style="display:none">${orderedPills(scores)}</div><div class="muted">No coach feedback available</div>`;
        })();

        body.innerHTML = `<div class="coach-feedback-block">${eiHTML || oldYellowHTML}</div>`;
        return;
      }

      // Emotional-assessment and Role Play final eval - Use EI 5-point scale
      const eiScores = scores || {};
      const eiMetricOrder = ["empathy", "clarity", "compliance", "discovery", "objection_handling", "confidence", "active_listening", "adaptability", "action_insight", "resilience"];
      const eiPills = eiMetricOrder
        .filter(k => k in eiScores)
        .map(k => {
          const v = Number(eiScores[k] ?? 0);
          const label = k.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
          return `<span class="ei-pill" data-metric="${k}">
            <span class="k">${esc(label)}</span>
            <div style="font-size:14px;font-weight:700;margin-top:2px">${v}/5</div>
          </span>`;
        }).join('');

      const workedStr = fb.worked && fb.worked.length ? fb.worked.join(". ") + "." : "—";
      const improveStr = fb.improve && fb.improve.length ? fb.improve.join(". ") + "." : fb.feedback || "—";

      body.innerHTML = `
        <div class="coach-feedback-block">
          <div class="ei-wrap">
            <div class="ei-h">Performance Metrics (5-Point Scale)</div>
            <div class="ei-row">${eiPills || orderedPills(scores)}</div>
          </div>
          <ul class="coach-list" style="margin-top:12px">
            <li><strong>What worked:</strong> ${esc(workedStr)}</li>
            <li><strong>What to improve:</strong> ${esc(improveStr)}</li>
            <li><strong>Suggested phrasing:</strong> ${esc(fb.phrasing || "—")}</li>
          </ul>
        </div>
        ${repOnlyPanelHTML ? `<div class="rep-eval-panel">${repOnlyPanelHTML}</div>` : ""}`;
    }

    function applyModeVisibility() {
      const lc = modeSel.value;
      const previousMode = currentMode;
      currentMode = LC_TO_INTERNAL[lc];
      const pk = currentMode === "product-knowledge";

      // CRITICAL FIX: Always clear conversation and reset state when mode changes
      if (previousMode !== currentMode) {
        currentScenarioId = null;
        conversation = [];
        repOnlyPanelHTML = "";
        feedbackDisplayElem.innerHTML = "";
      }

      coachLabel.classList.toggle("hidden", pk);
      coachSel.classList.toggle("hidden", pk);

      if (currentMode === "sales-coach") {
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
      } else if (currentMode === "general-knowledge") {
        // NEW: General Assistant mode - no disease/HCP/persona selectors needed
        diseaseLabel.classList.add("hidden");
        diseaseSelect.classList.add("hidden");
        hcpLabel.classList.add("hidden");
        hcpSelect.classList.add("hidden");
        personaLabelElem.classList.add("hidden");
        personaSelectElem.classList.add("hidden");
        featureLabelElem.classList.add("hidden");
        eiFeatureSelectElem.classList.add("hidden");
        feedbackDisplayElem.innerHTML = `
          <div class="coach-note">
            <strong>General Assistant Mode:</strong> Ask me anything! I can help with life sciences, business, technology, general knowledge, or any other topic.
          </div>`;
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
      }

      // CRITICAL FIX: Always render after mode change to reflect cleared state
      renderMessages();
      renderCoach();
      renderMeta();
    }

    modeSel.addEventListener("change", applyModeVisibility);

    diseaseSelect.addEventListener("change", () => {
      const ds = diseaseSelect.value || "";
      if (!ds) return;
      if (currentMode === "sales-coach" || currentMode === "role-play") {
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

    // Event delegation for clickable EI pills and cards
    coach.addEventListener("click", (e) => {
      const pill = e.target.closest(".ei-pill");
      const card = e.target.closest(".ei-card");
      const target = pill || card;
      
      if (!target) return;

      const metric = target.getAttribute("data-metric");
      if (!metric) return;

      showMetricModal(metric, target.textContent);
    });

    populateDiseases();
    hydrateEISelects();
    applyModeVisibility();
  }

  // ---------- Metric definitions modal ----------
  function showMetricModal(metric, pillText) {
    const definitions = {
      empathy: {
        title: "Empathy Index",
        definition: "Scores ability to perceive and respond to HCP emotions and concerns.",
        calculation: "(Empathetic responses / Opportunities) × 100",
        tips: [
          "Notices HCP's tone or hesitation; validates concerns before replying",
          "Adapts message to emotional cues",
          "Example: 'I hear you're concerned about side effects—let me walk you through the most recent safety information.'"
        ],
        source: "Empathy reflects the rep's ability to notice and verbally acknowledge emotional states or practical needs expressed by the HCP.",
        citation: {
          text: "Empathy in Sales: How Emotional Intelligence Tools Are Improving Sales Performance",
          url: "https://salestechstar.com/staff-writers/empathy-in-sales-how-emotional-intelligence-tools-are-improving-sales-performance/"
        }
      },
      clarity: {
        title: "Clarity Index",
        definition: "Measures how clearly information is explained to busy HCPs.",
        calculation: "(Clear explanations / Total exchanges) × 100",
        tips: [
          "Summarizes research in simple terms; avoids jargon",
          "Provides short, digestible takeaways",
          "Example: 'To put it simply, this treatment targets inflammation without suppressing your patient's immune system.'"
        ],
        source: "A low average sentence length and low jargon count produces a higher clarity score.",
        citation: {
          text: "From Transcripts to Tone Analysis: The Future of AI in Sales Coaching",
          url: "https://superagi.com/from-transcripts-to-tone-analysis-the-future-of-ai-in-sales-coaching-and-emotional-intelligence/"
        }
      },
      compliance: {
        title: "Compliance Score",
        definition: "Tracks adherence to approved messaging and regulatory guidelines.",
        calculation: "(Total compliant exchanges / All exchanges) × 100",
        tips: [
          "No off-label claims; follows label guardrails",
          "Quickly adjusts to in-call compliance feedback",
          "Example: 'Per the product label, this medication is approved for type 2 diabetes only. I'm happy to share the key study details.'"
        ],
        source: "Automated by evaluating message strings against approved and forbidden phrases.",
        citation: {
          text: "How AI Is Transforming Sales Coaching Today",
          url: "https://spinify.com/blog/how-ai-is-transforming-sales-coaching-today/"
        }
      },
      discovery: {
        title: "Discovery Index",
        definition: "Scores effectiveness in uncovering HCP needs and priorities.",
        calculation: "(Probing questions / Opportunities to discover) × 100",
        tips: [
          "Uses open-ended questions; clarifies patient challenges",
          "Asks for details on prescribing habits",
          "Example: 'Could you tell me what factors are most important to you when selecting a treatment for this condition?'"
        ],
        source: "Open-ended questions identified by sentence structure (who, what, where, when, why, how) and ending with '?'",
        citation: {
          text: "Integrating Emotional Intelligence into Sales Coaching",
          url: "https://getrafiki.ai/sales-coach/integrating-emotional-intelligence-into-sales-coaching/"
        }
      },
      objection_handling: {
        title: "Objection Handling Score",
        definition: "Reflects skill in acknowledging and resolving HCP concerns.",
        calculation: "(Successful objection resolutions / Total objections) × 100",
        tips: [
          "Listens carefully; reframes objections constructively",
          "Offers evidence-based answers",
          "Example: 'Doctor, I noticed you hesitated on that point—would it help if I shared more specifics from the clinical trial?'"
        ],
        source: "A response is scored if it contains both objection recognition and a compliant fact or empathetic statement.",
        citation: {
          text: "AI Sales Coaching: The Playbook for Continuous Skill Development",
          url: "https://www.valueselling.com/resource-blog/ai-sales-coaching-the-playbook-for-continuous-skill-development"
        }
      },
      confidence: {
        title: "Confidence Level",
        definition: "Assesses composure, credibility, and self-assurance during presentations.",
        calculation: "Averaged observed confidence behaviors across interactions (scale 1–10)",
        tips: [
          "Speaks smoothly; maintains eye contact",
          "Stays on message despite pushback",
          "Example: 'From my experience, I'm confident this therapy offers meaningful benefits that can improve patient outcomes.'"
        ],
        source: "Measured by absence of filler words, reduced latency, and correctness cross-checked by product knowledge.",
        citation: {
          text: "Quantified: AI Sales Training for Faster, Effective Results",
          url: "https://frontbrick.io/ai-sales-tools/quantified"
        }
      },
      active_listening: {
        title: "Active Listening Score",
        definition: "Assesses attentiveness and ability to confirm and respond to HCP points.",
        calculation: "(Active listening behaviors / Total exchanges) × 100",
        tips: [
          "Paraphrases HCP statements; checks for clarity",
          "Reacts to both words and emotions",
          "Example: 'So you're seeing these side effects mostly in younger patients, is that right?'"
        ],
        source: "Use NLP to detect phrases like 'What I'm hearing is...', 'If I understand correctly...'",
        citation: {
          text: "Emotional Intelligence in AI Sales Agents",
          url: "https://www.voxia.ai/blog/emotional-intelligence-in-ai-sales-agents"
        }
      },
      adaptability: {
        title: "Emotional Adaptability Index",
        definition: "Measures ability to flex communication style based on HCP attitude and energy.",
        calculation: "(Adaptive responses / Opportunities to adapt) × 100",
        tips: [
          "Changes pace when needed; softens tone under stress",
          "Expresses flexibility",
          "Example: 'I can tell you're busy, so I'll keep this brief and focus on what matters most to your practice.'"
        ],
        source: "Use sentiment/tone analysis to identify shifts in HCP dialogue and test for corresponding change in rep's response.",
        citation: {
          text: "Top 7 Essential AI Sales Skills for Modern Sales Teams",
          url: "https://www.investglass.com/top-7-essential-ai-sales-skills-for-modern-sales-teams/"
        }
      },
      action_insight: {
        title: "Action/Insight Ratio",
        definition: "Assesses how often the rep translates insights from the HCP into concrete next steps or shared actions.",
        calculation: "(Action-oriented statements or suggested next steps) / (Total discovery insights identified) × 100",
        tips: [
          "Suggested a follow-up action after need discovery",
          "Clearly outlined the next step based on dialogue",
          "Example: 'Based on what you shared, let me get you the trial data specific to that patient population.'"
        ],
        source: "Detect statements using action keywords ('Let's schedule...', 'I'll get you those data', 'Next visit, we'll discuss...')",
        citation: {
          text: "Evaluate Sales Training Programs with AI Effectively",
          url: "https://agentiveaiq.com/blog/how-to-evaluate-sales-training-programs-with-ai"
        }
      },
      resilience: {
        title: "Resilience/Regulation Index",
        definition: "Tracks the ability to maintain professionalism and composure in the face of objections or negative feedback.",
        calculation: "(Emotionally regulated responses after negative feedback) / (Total negative or challenging turns) × 100",
        tips: [
          "Maintained positive tone when challenged",
          "Did not get defensive or argumentative",
          "Example: 'I appreciate your candor—let me address that concern with the latest evidence.'"
        ],
        source: "Analyze for continued neutral/positive tone, absence of defensive language, and calm pacing after objections.",
        citation: {
          text: "How AI can't replace these 5 soft skills for life sciences sales",
          url: "https://www.linkedin.com/posts/ligeralde_soft-skills-the-most-critical-skills-to-activity-7356670236508463104-d4Cl"
        }
      }
    };

    const data = definitions[metric];
    if (!data) return;

    // Create enhanced modal HTML with animations and backdrop blur
    const modalHTML = `
      <div id="metric-modal" style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);z-index:100000;display:flex;align-items:center;justify-content:center;padding:20px;font-family:Inter,system-ui,sans-serif;animation:fadeIn 0.2s ease-out">
        <div style="background:white;border-radius:16px;max-width:600px;width:100%;max-height:90vh;overflow-y:auto;box-shadow:0 25px 50px -12px rgba(0,0,0,0.25);animation:slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1)">
          <div style="padding:24px;border-bottom:1px solid #e5e7eb;background:linear-gradient(135deg, #0f2747 0%, #1e3a5f 100%)">
            <h3 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;font-family:Inter,system-ui,sans-serif">${data.title}</h3>
            <p style="margin:10px 0 0;color:rgba(255,255,255,0.9);font-size:14px;line-height:1.6;font-family:Inter,system-ui,sans-serif">${data.definition}</p>
          </div>
          <div style="padding:20px 24px;background:#f9fafb">
            <p style="margin:0;color:#475569;font-size:13px;font-style:italic;background:#ffffff;padding:12px 16px;border-radius:8px;border-left:4px solid #20bfa9;font-family:Inter,system-ui,sans-serif;box-shadow:0 1px 3px rgba(0,0,0,0.1)"><strong style="color:#0f2747">Calculation:</strong> ${data.calculation}</p>
          </div>
          <div style="padding:24px">
            <h4 style="margin:0 0 16px;font-size:16px;font-weight:600;color:#0f2747;font-family:Inter,system-ui,sans-serif;border-bottom:2px solid #20bfa9;padding-bottom:8px">Sample Indicators</h4>
            <ul style="margin:0;padding-left:20px;color:#374151;font-size:14px;line-height:1.8;font-family:Inter,system-ui,sans-serif">
              ${data.tips.map(tip => `<li style="margin:12px 0;padding-left:8px">${tip}</li>`).join('')}
            </ul>
            <div style="margin-top:24px;padding:16px;background:linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);border-left:4px solid #0ea5e9;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,0.05)">
              <p style="margin:0;font-size:13px;color:#0c4a6e;line-height:1.6;font-family:Inter,system-ui,sans-serif;font-style:italic">${data.source}</p>
            </div>
          </div>
          <div style="padding:20px 24px;background:#f9fafb;border-top:1px solid #e5e7eb">
            <p style="margin:0 0 10px;font-size:12px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;font-family:Inter,system-ui,sans-serif">📚 Learn More</p>
            <a href="${data.citation.url}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:8px;font-size:13px;color:#0369a1;text-decoration:none;background:#ffffff;padding:10px 16px;border-radius:8px;border:1px solid #bae6fd;font-weight:500;transition:all 0.2s;font-family:Inter,system-ui,sans-serif;box-shadow:0 1px 2px rgba(0,0,0,0.05)" onmouseover="this.style.background='#e0f2fe';this.style.transform='translateY(-1px)';this.style.boxShadow='0 4px 6px rgba(0,0,0,0.1)'" onmouseout="this.style.background='#ffffff';this.style.transform='translateY(0)';this.style.boxShadow='0 1px 2px rgba(0,0,0,0.05)'">${data.citation.text} →</a>
          </div>
          <div style="padding:20px 24px;border-top:1px solid #e5e7eb;text-align:right;background:#ffffff">
            <button onclick="this.closest('#metric-modal').style.animation='fadeOut 0.2s ease-out';setTimeout(()=>document.getElementById('metric-modal').remove(),200)" style="padding:12px 24px;background:linear-gradient(135deg, #ec4899 0%, #db2777 100%);color:white;border:none;border-radius:8px;font-weight:600;cursor:pointer;font-size:14px;transition:all 0.2s;font-family:Inter,system-ui,sans-serif;box-shadow:0 2px 4px rgba(236,72,153,0.3)" onmouseover="this.style.transform='translateY(-1px)';this.style.boxShadow='0 4px 8px rgba(236,72,153,0.4)'" onmouseout="this.style.transform='translateY(0)';this.style.boxShadow='0 2px 4px rgba(236,72,153,0.3)'">Got it!</button>
          </div>
        </div>
      </div>
      <style>
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes fadeOut{from{opacity:1}to{opacity:0}}
        @keyframes slideUp{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}
      </style>
    `;

    // Remove existing modal if any
    const existing = document.getElementById("metric-modal");
    if (existing) existing.remove();

    // Append new modal with animation
    document.body.insertAdjacentHTML("beforeend", modalHTML);

    // Close on backdrop click with fade animation
    const modal = document.getElementById("metric-modal");
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        modal.style.animation = 'fadeOut 0.2s ease-out';
        setTimeout(() => modal.remove(), 200);
      }
    });
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
  async function streamWithSSE(url, payload, onToken, telemetry, onFirstByte) {
    return new Promise((resolve, reject) => {
      let accumulated = "";
      let pendingUpdate = false;
      let updateScheduled = false;
      let firstByteRecorded = false;

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

        // Record first byte on first message
        if (!firstByteRecorded) {
          firstByteRecorded = true;
          if (telemetry) {
            telemetry.t_first_byte = Date.now();
          }
          if (onFirstByte) {
            onFirstByte();
          }
        }

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

  async function callModel(messages, scenarioContext = null) {
    // Validate mode before making request
    const validModes = ["emotional-assessment", "product-knowledge", "sales-coach", "role-play"];
    if (!validModes.includes(currentMode)) {
      console.error("[chat] invalid_mode=" + currentMode);
      showToast("Invalid mode selected. Please refresh the page.", "error");
      throw new Error("invalid_mode");
    }

    // Use window.WORKER_URL directly and append /chat
    // Normalize by removing trailing slashes to avoid double slashes
    const baseUrl = (window.WORKER_URL || "").replace(/\/+$/, "");
    if (!baseUrl) {
      const msg = "Worker URL not configured";
      console.error("[chat] error=worker_url_missing");
      showToast("Configuration error. Please contact support.", "error");
      throw new Error(msg);
    }

    const url = `${baseUrl}/chat`;
    // Check both cfg.stream and USE_SSE flag
    const useStreaming = USE_SSE && cfg?.stream === true;

    // Initialize telemetry
    initTelemetry();
    currentTelemetry.t_open = Date.now();
    currentTelemetry.mode = currentMode;
    currentTelemetry.retries = 0;
    updateDebugFooter();

    // Show typing indicator within 100ms
    const typingIndicator = showTypingIndicator();

    // Extract scenario information if available
    const disease = scenarioContext?.therapeuticArea || scenarioContext?.diseaseState || "";
    const persona = scenarioContext?.hcpRole || scenarioContext?.label || "";
    const goal = scenarioContext?.goal || "";

    // Build ReflectivAI-compatible payload
    // Extract history from messages (exclude system and last user message)
    const history = messages
      .filter(m => m.role !== "system")
      .slice(0, -1); // exclude the last user message

    const lastUserMsg = messages.filter(m => m.role === "user").pop();

    const payload = {
      mode: currentMode,
      user: lastUserMsg?.content || "",
      history: history,
      disease: disease,
      persona: persona,
      goal: goal,
      session: "widget-" + (Math.random().toString(36).slice(2, 10))
    };

    // SSE Streaming branch
    if (useStreaming) {
      try {
        let streamedContent = "";
        let firstChunkRecorded = false;
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

          // Record first chunk with actual content
          if (!firstChunkRecorded && content && content.trim().length > 0) {
            currentTelemetry.t_first_chunk = Date.now();
            firstChunkRecorded = true;
            updateDebugFooter();
          }

          streamBody.innerHTML = md(sanitizeLLM(content));
          if (msgsEl) {
            msgsEl.scrollTop = msgsEl.scrollHeight;
          }

          // Approximate bytes received
          currentTelemetry.bytes_rx = textEncoder.encode(content).length;
        }, currentTelemetry, () => {
          // onFirstByte callback
          updateDebugFooter();
        });

        // Mark done
        currentTelemetry.t_done = Date.now();
        currentTelemetry.httpStatus = "stream";
        updateDebugFooter();

        // Remove streaming element - the actual message will be added by sendMessage
        if (streamRow.parentNode) {
          streamRow.parentNode.removeChild(streamRow);
        }

        return result || streamedContent;
      } catch (e) {
        removeTypingIndicator(typingIndicator);
        currentTelemetry.httpStatus = e.message || "error";
        currentTelemetry.t_done = Date.now();
        updateDebugFooter();
        // SSE streaming not available, falling back to regular fetch
        // Note: This should only happen when USE_SSE is true and streaming fails
        // Fall through to regular fetch with retry
      }
    }

    // Regular fetch with exponential backoff retries (300ms → 800ms → 1.5s)
    const delays = [300, 800, 1500];
    let lastError = null;

    for (let attempt = 0; attempt < delays.length + 1; attempt++) {
      if (attempt > 0) {
        currentTelemetry.retries = attempt;
        updateDebugFooter();
      }

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

        // Record first byte (HTTP headers received)
        if (currentTelemetry.t_first_byte === 0) {
          currentTelemetry.t_first_byte = Date.now();
          updateDebugFooter();
        }

        removeTypingIndicator(typingIndicator);

        if (r.ok) {
          try {
            const bodyText = await r.text();
            currentTelemetry.bytes_rx = textEncoder.encode(bodyText).length;
            currentTelemetry.httpStatus = r.status.toString();

            const data = JSON.parse(bodyText);

            // Extract tokens if available (prefer completion_tokens for accuracy)
            if (data.usage?.completion_tokens) {
              currentTelemetry.tokens_rx = data.usage.completion_tokens;
            }

            const content = data?.content || data?.reply || data?.choices?.[0]?.message?.content || "";

            // Record first chunk (first response data)
            if (currentTelemetry.t_first_chunk === 0 && content) {
              currentTelemetry.t_first_chunk = Date.now();
            }

            currentTelemetry.t_done = Date.now();
            updateDebugFooter();

            return content;
          } catch (jsonErr) {
            // JSON parse error
            console.error(`[chat] status=${r.status} path=/chat error=json_parse`);
            showToast(`Request failed (JSON parse error). Please retry.`, "error");
            throw new Error("JSON parse error");
          }
        }

        // Record status even on error
        currentTelemetry.httpStatus = r.status.toString();
        updateDebugFooter();

        // Log error with status
        console.error(`[chat] status=${r.status} path=/chat`);

        // Don't retry 4xx client errors (except 429 rate limit)
        const isRetryable = r.status === 429 || r.status >= 500;

        // Check if we should retry
        if (attempt < delays.length && isRetryable) {
          lastError = new Error("HTTP " + r.status);
          await new Promise((res) => setTimeout(res, delays[attempt]));
          continue;
        }

        // For 4xx errors (except 429), try to extract error message from response
        if (r.status >= 400 && r.status < 500) {
          try {
            const errorBody = await r.json();
            const errorMsg = errorBody.message || errorBody.error || `Request failed (status ${r.status})`;
            showToast(errorMsg, "error");
            throw new Error("HTTP " + r.status);
          } catch (jsonErr) {
            // If JSON parsing fails, show generic error
            showToast(`Request failed (status ${r.status}). Please retry.`, "error");
            throw new Error("HTTP " + r.status);
          }
        }

        // Show toast for non-retryable errors
        showToast(`Request failed (status ${r.status}). Please retry.`, "error");
        throw new Error("HTTP " + r.status);
      } catch (e) {
        clearTimeout(timeout);

        // Retry on timeout or network errors
        if (attempt < delays.length && /timeout|TypeError|NetworkError/i.test(String(e))) {
          lastError = e;
          currentTelemetry.httpStatus = "timeout";
          updateDebugFooter();
          console.error(`[chat] status=timeout path=/chat retry=${attempt + 1}`);
          await new Promise((res) => setTimeout(res, delays[attempt]));
          continue;
        }

        removeTypingIndicator(typingIndicator);
        currentTelemetry.httpStatus = e.message || "error";
        currentTelemetry.t_done = Date.now();
        updateDebugFooter();

        // Log network error
        console.error(`[chat] status=network_error path=/chat error=${e.message || "unknown"}`);
        showToast(`Network error. Please check your connection and retry.`, "error");

        // Show retry UI if we've exhausted all retries and taken >= 8s total
        const totalElapsed = Date.now() - (window._lastCallModelAttempt || Date.now());
        if (totalElapsed >= 8000) {
          showRetryUI();
        }

        return "";
      }
    }

    removeTypingIndicator(typingIndicator);
    currentTelemetry.httpStatus = lastError?.message || "failed";
    currentTelemetry.t_done = Date.now();
    updateDebugFooter();

    console.error(`[chat] status=all_retries_failed path=/chat`);
    showToast(`Request failed after retries. Please try again.`, "error");
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
      {
        role: "system",
        content: buildPreface("role-play", sc) + `\n\nEvaluate the whole exchange now using the 5-point scale for these EXACT 10 metrics:

**Core EI Metrics:**
- Empathy (1-5): Recognition of HCP concerns and emotional state
- Clarity (1-5): Clear, concise communication without jargon
- Compliance (1-5): Adherence to regulatory guidelines
- Discovery (1-5): Use of open-ended questions to uncover needs
- Objection Handling (1-5): Effectively addressing HCP concerns
- Confidence (1-5): Fluency and conviction in responses

**Advanced EI Metrics:**
- Active Listening (1-5): Paraphrasing and building on HCP statements
- Adaptability (1-5): Adjusting tone to match HCP emotional shifts
- Action/Insight (1-5): Translating insights into concrete next steps
- Resilience (1-5): Maintaining composure under pressure

Return scores in <coach> JSON with keys: empathy, clarity, compliance, discovery, objection_handling, confidence, active_listening, adaptability, action_insight, resilience (all integers 1-5), plus feedback, worked[], improve[], phrasing.`
      },
      {
        role: "user",
        content: `Evaluate this entire exchange using the 10-metric rubric. Provide integer scores (1-5) for all 10 metrics.\n\nConversation:\n${convoText}`
      }
    ].filter(Boolean);

    const raw = await callModel(evalMsgs, sc);
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
      "Rubric: Use 5-point scale (1-5) for these EXACT 10 metrics:",
      "Core: Empathy, Clarity, Compliance, Discovery, Objection Handling, Confidence",
      "Advanced: Active Listening, Adaptability, Action/Insight, Resilience",
      "Return JSON with keys: scores{empathy,clarity,compliance,discovery,objection_handling,confidence,active_listening,adaptability,action_insight,resilience}, summary, strengths[], improvements[], actionable[]. Scores 1-5 integers."
    ].join(" ");

    const user = {
      role: "user",
      content: JSON.stringify({
        mode: "rep_only",
        rubric: ["Empathy", "Clarity", "Compliance", "Discovery", "Objection Handling", "Confidence", "Active Listening", "Adaptability", "Action/Insight", "Resilience"],
        transcript
      })
    };

    let raw = "";
    try {
      raw = await callModel([{ role: "system", content: sys }, user], null);
    } catch (e) {
      return { html: `<div class='coach-panel'><h4>Rep-only Evaluation</h4><p>Unavailable now. Try again.</p></div>` };
    }

    let data = null;
    try { data = JSON.parse(raw); } catch (_) { }

    if (!data || !data.scores) {
      const safe = sanitizeLLM(raw || "Rep-only evaluation unavailable.");
      return { html: `<div class='coach-panel'><h4>Rep-only Evaluation</h4><p>${esc(safe)}</p></div>` };
    }

    const s = data.scores || {};
    const list = (arr) => Array.isArray(arr) && arr.length ? `<ul>${arr.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : "—";

    // Create clickable pills with ei-pill class and data-metric for all 10 metrics
    const pillsHTML = ['empathy', 'clarity', 'compliance', 'discovery', 'objection_handling', 'confidence', 'active_listening', 'adaptability', 'action_insight', 'resilience'].map(k => {
      const v = s[k] ?? 0;
      const label = k.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      return `<span class="ei-pill" data-metric="${k}">
        <span class="k">${label}</span>
        <div style="font-size:14px;font-weight:700;margin-top:2px">${v}/5</div>
      </span>`;
    }).join('');

    const html = `
      <div class="coach-panel">
        <h4>Rep-only Evaluation</h4>
        <div class="ei-row" style="margin-bottom:16px;display:flex;flex-wrap:wrap;gap:8px">${pillsHTML}</div>
        ${data.summary ? `<p>${esc(data.summary)}</p>` : ""}
        <h5>Strengths</h5>${list(data.strengths)}
        <h5>Improvements</h5>${list(data.improvements)}
        <h5>Actionable Feedback</h5>${list(data.actionable)}
      </div>`;
    return { html };
  }

  // ---------- send ----------
  function norm(txt) { return String(txt || "").toLowerCase().replace(/\s+/g, " ").trim(); }

  // PATCH B: semantic duplicate detection (4-gram Jaccard)
  function jaccard4gram(a, b) {
    const grams = s => {
      const t = String(s || "").toLowerCase().replace(/\s+/g, " ").trim();
      if (t.length < 4) return new Set([t]);
      const g = new Set();
      for (let i = 0; i <= t.length - 4; i++) g.add(t.slice(i, i + 4));
      return g;
    };
    const A = grams(a), B = grams(b);
    let inter = 0; for (const x of A) if (B.has(x)) inter++;
    const union = A.size + B.size - inter;
    return union ? inter / union : 0;
  }

  let lastAssistantNorm = "";
  let recentAssistantNorms = [];
  function pushRecent(n) { recentAssistantNorms.push(n); if (recentAssistantNorms.length > 6) recentAssistantNorms.shift(); }
  function isRecent(n) { return recentAssistantNorms.includes(n); }
  function isTooSimilar(n) { return recentAssistantNorms.some(p => jaccard4gram(p, n) >= 0.88); }

  let isSending = false;

  function trimConversationIfNeeded() {
    if (conversation.length <= 30) return;
    conversation = conversation.slice(-30);
  }

  async function sendMessage(userText) {
    console.log('[DEBUG] sendMessage() called with text:', userText);
    console.log('[DEBUG] isSending:', isSending, ', isHealthy:', isHealthy);

    if (isSending) return;

    // Health gate: block sends when unhealthy
    if (!isHealthy) {
      console.log('[DEBUG] BLOCKED BY HEALTH GATE - isHealthy is FALSE');
      showToast("Backend unavailable. Please wait...", "error");
      return;
    }

    console.log('[DEBUG] Passed health gate, proceeding with send');
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

      // INTELLIGENT MODE AUTO-DETECTION
      // If user asks a general knowledge question (What/How/Why/Explain)
      // without HCP simulation context, auto-switch to Product Knowledge
      const generalQuestionPatterns = /^(what|how|why|explain|tell me|describe|define|compare|list|when)/i;
      const simulationContextWords = /(hcp|doctor|physician|clinician|rep|objection|customer|prescriber)/i;

      if (generalQuestionPatterns.test(userText) && !simulationContextWords.test(userText)) {
        // This looks like a general knowledge question - use Product Knowledge mode
        const prevMode = currentMode;
        currentMode = "product-knowledge";
        console.log(`[Auto-Detect] Switched from ${prevMode} → product-knowledge for general question`);
      }

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
        _speaker: currentMode === "role-play" ? "rep" : "user",
        _mode: currentMode
      });
      trimConversationIfNeeded();
      renderMessages();
      renderCoach();

      if (currentMode === "emotional-assessment") generateFeedback();

      const sc = scenariosById.get(currentScenarioId);
      const messages = [];

      if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
      if ((currentMode === "sales-coach" || currentMode === "role-play") && eiHeuristics) {
        messages.push({ role: "system", content: eiHeuristics });
      }

      if (currentMode === "role-play") {
        const personaLine = currentPersonaHint();
        const detail = sc
          ? `Therapeutic Area: ${sc.therapeuticArea || sc.diseaseState || "—"}. HCP Role: ${sc.hcpRole || "—"}. ${sc.background ? `Background: ${sc.background}. ` : ""
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

        let raw = await callModel(messages, sc);

        // If response is empty or null, throw error instead of degrading to legacy
        if (!raw || !raw.trim()) {
          console.error("[coach] empty_response_from_worker mode=" + currentMode);
          showToast("Received empty response from server. Please retry.", "error");
          return;
        }

        let { coach, clean } = extractCoach(raw);

        // Re-ask once if phrasing is missing in sales-coach mode
        const phrasing = coach?.phrasing;
        if (currentMode === "sales-coach" && coach && (!phrasing || !phrasing.trim())) {
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
            const retryRaw = await callModel(retryMessages, sc);
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
            let contRaw = await callModel(contMsgs, sc);
            let contClean = currentMode === "role-play" ? sanitizeRolePlayOnly(contRaw) : sanitizeLLM(contRaw);
            if (contClean) replyText = (replyText + " " + contClean).trim();
          } catch (_) { /* no-op */ }
        }

        if (currentMode === "role-play") {
          // Create a wrapper that passes scenario context to callModel
          const callModelWithContext = (msgs) => callModel(msgs, sc);
          replyText = await enforceHcpOnly(replyText, sc, messages, callModelWithContext);
        }

        if (norm(replyText) === norm(userText)) {
          replyText = fallbackText(currentMode);
        }

        // PATCH B: semantic duplicate handling with vary pass
        let candidate = norm(replyText);
        if (candidate && (candidate === lastAssistantNorm || isRecent(candidate) || isTooSimilar(candidate))) {
          const varyMsgs = [
            ...messages.slice(0, -1),
            { role: "system", content: "Do not repeat prior wording. Provide a different HCP reply with one concrete example, one criterion, and one follow-up step. 2–4 sentences." },
            messages[messages.length - 1]
          ];
          let varied = await callModel(varyMsgs, sc);
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

        // CRITICAL: Sales Coach responses have structured format (Challenge, Rep Approach, Impact, Suggested Phrasing)
        // that must be preserved in full. Some responses exceed 3000–4500 chars (long phrasing + citations).
        // Previous clamping (2500) caused mid-phrase truncation and UI ellipsis. Disable clamping for sales-coach.
        // Retain clamping for other modes to prevent runaway verbosity.
        if (currentMode !== "sales-coach") {
          replyText = clampLen(replyText, 1400);
        } else {
          console.log("[Sales Coach] Skip clamp; length=", replyText.length);
        }

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
          _speaker: currentMode === "role-play" ? "hcp" : "assistant",
          _mode: currentMode
        });
        trimConversationIfNeeded();
        renderMessages();
        renderCoach();

        // Log telemetry after assistant reply completes
        logTelemetry();

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
          }).catch(() => { });
        }
      } catch (e) {
        console.error("[coach] error_in_sendMessage:", e);
        showToast("Failed to send message: " + (e.message || "Unknown error"), "error");
        // Don't add error message to conversation - let user retry
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
  let scenariosLoadError = null;

  async function loadScenarios() {
    try {
      scenariosLoadError = null;
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
      scenariosLoadError = e.message || String(e);
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
      cfg = { defaultMode: "sales-coach" };
    }

    if (!cfg.apiBase && !cfg.workerUrl) {
      cfg.apiBase = window.WORKER_URL || "";
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
    await loadCitations(); // Load citation database
    buildUI();

    console.log('[DEBUG] About to run initial health check...');
    // Health gate: check on init
    const healthy = await checkHealth();
    console.log('[DEBUG] Initial health check complete, result:', healthy, ', isHealthy:', isHealthy);
    if (!healthy) {
      startHealthRetry();
    }
  }

  // ---------- start ----------
  waitForMount(init);
})();
