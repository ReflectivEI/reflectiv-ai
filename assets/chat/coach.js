/* ReflectivAI Coach — self-contained UI + logic (no external deps). */
(() => {
  // ---------- tiny DOM/utils ----------
  const qs  = (sel, el = document) => el.querySelector(sel);
  const qsa = (sel, el = document) => [...el.querySelectorAll(sel)];
  const h = (tag, attrs = {}, children = []) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k === "class") n.className = v;
      else if (k === "html") n.innerHTML = v;
      else if (v != null) n.setAttribute(k, v);
    }
    // Handle children flexibly: array, single element, or null
    [children].flat().filter(Boolean).forEach(c =>
      n.appendChild(typeof c === "string" ? document.createTextNode(c) : c)
    );
    return n;
  };
  // alias so any existing calls to `el(...)` remain valid
  const el = h;

  const fetchJSON = async (url) => {
    const r = await fetch(url, { credentials: "omit", cache: "no-store" });
    if (!r.ok) throw new Error(`fetch ${url} -> ${r.status}`);
    return r.json();
  };

  // ---------- data sources (relative paths for portability) ----------
  const DATA = {
    config:    "assets/chat/config.json",
    personas:  "assets/chat/persona.json",
    scenarios: "assets/chat/data/scenarios.merged.json",
    system:    "assets/chat/system.md"
  };

  // ---------- constants ----------
  // WORKFLOW-BASED UI MODE MAPPING
  // These are the 3 workflow labels shown to users:
  // - "Sales Coach & Call Prep" → backend mode: "sales-coach"
  // - "Role Play w/ HCP" → backend mode: "role-play"
  // - "EI & Product Knowledge" → backend modes: "emotional-assessment" + "product-knowledge"
  const WORKFLOW_MODES = [
    { key: "sales-coach", label: "Sales Coach & Call Prep", backendMode: "sales-coach" },
    { key: "role-play", label: "Role Play w/ HCP", backendMode: "role-play" },
    { key: "ei-pk", label: "EI & Product Knowledge", backendModes: ["emotional-assessment", "product-knowledge"] }
  ];

  // Backend mode constants (DO NOT CHANGE - used by Worker)
  const BACKEND_MODES = {
    EMOTIONAL_ASSESSMENT: "emotional-assessment",
    PRODUCT_KNOWLEDGE: "product-knowledge",
    SALES_COACH: "sales-coach",
    ROLE_PLAY: "role-play",
    GENERAL_KNOWLEDGE: "general-knowledge"
  };
  const EI_PROFILES = [
    { key: "difficult",   label: "Difficult HCP" },
    { key: "busy",        label: "Busy HCP" },
    { key: "engaged",     label: "Highly Engaged HCP" },
    { key: "indifferent", label: "Indifferent HCP" }
  ];
  const EI_FEATURES = [
    { key: "empathy",   label: "Empathy" },
    { key: "objection", label: "Objection Handling" },
    { key: "clarity",   label: "Clarity & Confidence" },
    { key: "accuracy",  label: "Accuracy & Compliance" },
    { key: "discovery", label: "Discovery" }
  ];

  // ---------- state ----------
  const state = {
    cfg: null, personas: [], scenarios: [],
    workflowMode: null,      // UI workflow selection (sales-coach, role-play, ei-pk)
    backendMode: null,       // Actual backend mode sent to Worker
    eiPkSubMode: null,       // For EI & PK workflow: "ei" or "pk"
    eiProfile: null, eiFeature: null,
    disease: null, hcp: null, scoring: false, sessionId: null,
    history: {               // Per-mode conversation history
      "emotional-assessment": [],
      "product-knowledge": [],
      "sales-coach": [],
      "role-play": [],
      "general-knowledge": []
    }
  };

  // ---------- safe boot with stub fallback ----------
  async function loadData() {
    try {
      const [cfg, personas, scenarios] = await Promise.all([
        fetchJSON(DATA.config),
        fetchJSON(DATA.personas),
        fetchJSON(DATA.scenarios)
      ]);
      state.cfg = cfg;
      state.personas  = personas?.personas   || [];
      state.scenarios = scenarios?.scenarios || [];
    } catch (e) {
      console.warn("[Coach] data fetch failed, using stub", e);
      state.cfg = { ui: { showCoach: true }, brand: { accent: "#2f3a4f" } };
      state.personas = [];
      state.scenarios = [];
    }
  }

  // ---------- small UI helpers ----------
  function option(v, label) { return h("option", { value: v }, [label]); }

  function select(name, options) {
    const sel = h("select", { name, class: "input" });
    (options || []).forEach(o => sel.appendChild(option(o.value, o.label)));
    return sel;
  }

  function field(labelText, inputNode) {
    return h("div", { class: "field" }, [
      h("label", {}, [labelText]),
      inputNode
    ]);
  }

  // ---------- UI shell ----------
  function buildShell(rootEl) {
    // modal root with a11y
    const root = rootEl ?? el("div", {
      id: "coach-modal",
      role: "dialog",
      "aria-modal": "true",
      "aria-labelledby": "coach-title"
    });

    // header bar
    const header = el("div", { class: "coach-header" }, [
      el("div", {
        id: "coach-title",
        class: "coach-title",
        role: "heading",
        "aria-level": "2"
      }, "ReflectivAI Coach"),
      el("button", {
        class: "coach-close",
        type: "button",
        "aria-label": "Close coach"
      }, "Close")
    ]);
    header.querySelector(".coach-close")?.addEventListener("click", () => {
      const modal = root.closest(".modal") || root;
      modal.classList.remove("open");
      modal.setAttribute("aria-hidden", "true");
    });

    // top guidance headers used by onModeChange()
    const guidance = el("div", { class: "coach-guidance" }, [
      el("div", { id: "hdr1", class: "coach-h1", "aria-live": "polite" }, ""),
      el("div", { id: "hdr2", class: "coach-h2", "aria-live": "polite" }, "")
    ]);

    // controls: primary mode select + dynamic fields host
    const controls = el("div", { class: "coach-controls" }, [
      (() => {
        const sel = el("select", { name: "mode", class: "input" }, [
          option("", "Select Workflow"),
          ...WORKFLOW_MODES.map(m => option(m.key, m.label))
        ]);
        return el("div", { class: "field" }, [
          el("label", {}, ["Learning Center"]),
          sel
        ]);
      })(),
      el("div", { id: "modeFields", class: "mode-fields" }, [])
    ]);

    // Coach Feedback panel with avatar, badges, and micro-prompts
    const feedbackPanel = el("div", { class: "coach-feedback-panel" }, [
      // Avatar
      el("img", {
        src: "assets/chat/coach-avatar.svg",
        alt: "Coach Avatar",
        class: "coach-avatar",
        style: "width:48px;height:48px;cursor:pointer;vertical-align:middle;"
      }),
      // Badges (placeholder, updated by updateBadges)
      el("div", { class: "coach-badges" }, []),
      // Feedback text
      el("div", { class: "coach-feedback-text" }, "Welcome! Your feedback will appear here after each turn."),
      // Tips with micro-prompts
      el("div", { class: "coach-tips" }, [])
    ]);

    // chat area
    const body = el("div", { class: "coach-body" }, [
      el("div", { id: "chat", class: "chat" }, []),
      el("form", { id: "chatForm", class: "chat-form" }, [
        el("input", {
          id: "chatInput",
          name: "chatInput",
          type: "text",
          placeholder: "Type your message…",
          "aria-label": "Message"
        }),
        el("button", { class: "coach-send", type: "submit" }, "Send")
      ])
    ]);

  // assemble
  root.innerHTML = "";
  root.appendChild(header);
  root.appendChild(guidance);
  root.appendChild(controls);
  root.appendChild(feedbackPanel);
  root.appendChild(body);
  // Update badges based on scoring
  function updateBadges(scores) {
    const badgeHost = qs(".coach-badges");
    if (!badgeHost) return;
    badgeHost.innerHTML = "";
    // Example: show badge for empathy, clarity, compliance
    Object.entries(scores || {}).forEach(([key, val]) => {
      if (val >= 4) {
        const badge = el("span", { class: "coach-badge coach-badge-" + key, title: key }, key.charAt(0).toUpperCase() + key.slice(1));
        badgeHost.appendChild(badge);
      }
    });
  }

  // Update feedback text and tips
  function updateFeedback(feedback, tips) {
    const feedbackText = qs(".coach-feedback-text");
    const tipsHost = qs(".coach-tips");
    if (feedbackText) feedbackText.textContent = feedback || "";
    if (tipsHost) {
      tipsHost.innerHTML = "";
      (tips || []).forEach(tip => {
        const tipEl = el("div", { class: "coach-tip" }, [
          tip.text,
          tip.source ? el("span", { class: "coach-tip-source", style: "margin-left:8px;cursor:pointer;color:#3b82f6;" }, [
            "Why this tip?",
            el("div", { class: "coach-tip-popup", style: "display:none;position:absolute;background:#fff;border:1px solid #ccc;padding:8px;z-index:10;max-width:220px;" }, [tip.source])
          ]) : null
        ]);
        // Micro-prompt logic
        if (tip.source) {
          tipEl.querySelector(".coach-tip-source").addEventListener("click", function(e) {
            const popup = tipEl.querySelector(".coach-tip-popup");
            popup.style.display = popup.style.display === "none" ? "block" : "none";
            e.stopPropagation();
          });
        }
        tipsHost.appendChild(tipEl);
      });
    }
  }

  // Avatar click for EI wisdom
  function setupAvatarWisdom() {
    const avatar = qs(".coach-avatar");
    if (!avatar) return;
    avatar.addEventListener("click", () => {
      alert("EI Wisdom: Great sales reps listen deeply, reflect before responding, and adapt with empathy. Keep growing your EI!");
    });
  }

  // Call after shell build
  setupAvatarWisdom();

    // wire events
    qs('select[name="mode"]', root)?.addEventListener("change", onModeChange);
    qs("#chatForm", root)?.addEventListener("submit", onSend);

    // Esc to close
    root.addEventListener("keydown", (e) => { if (e.key === "Escape") root.remove(); });

    return root;
  }

  // ---------- interactions ----------
  function onModeChange(e) {
    const workflowKey = e.target.value || null;
    state.workflowMode = workflowKey;
    
    // Determine backend mode(s) from workflow selection
    const workflow = WORKFLOW_MODES.find(w => w.key === workflowKey);
    if (!workflow) {
      state.backendMode = null;
      return;
    }
    
    // For single backend mode workflows
    if (workflow.backendMode) {
      state.backendMode = workflow.backendMode;
    } else {
      // For EI & PK workflow, default to EI mode
      state.backendMode = BACKEND_MODES.EMOTIONAL_ASSESSMENT;
      state.eiPkSubMode = "ei";
    }

    // fresh session per workflow change
    state.sessionId = `${Date.now()}`;
    const chat = qs("#chat"); if (chat) chat.innerHTML = "";

    // populate dependent fields
    const host = qs("#modeFields");
    if (!host) return;

    host.innerHTML = "";

    // Sales Coach & Call Prep workflow
    if (workflowKey === "sales-coach") {
      host.appendChild(field("Disease State", select("disease", [
        { value: "",           label: "Select Disease" },
        { value: "oncology",   label: "Oncology" },
        { value: "vaccines",   label: "Vaccines" },
        { value: "hiv",        label: "HIV" },
        { value: "pulmonology",label: "Pulmonology" },
        { value: "hepb",       label: "Hepatitis B" },
        { value: "cardiology", label: "Cardiology" }
      ])));
      host.appendChild(field("HCP Persona", select("hcp", [
        { value: "",    label: "Select HCP" },
        { value: "im",  label: "Internal Medicine MD" },
        { value: "np",  label: "Nurse Practitioner (NP)" },
        { value: "pa",  label: "Physician Assistant (PA)" },
        { value: "id",  label: "Infectious Disease Specialist" },
        { value: "onc", label: "Oncologist" },
        { value: "pulm",label: "Pulmonologist" },
        { value: "card",label: "Cardiologist" }
      ])));
      
      qs('select[name="disease"]')?.addEventListener("change",
        (ev) => { state.disease = ev.target.value || null; });
      qs('select[name="hcp"]')?.addEventListener("change",
        (ev) => { state.hcp = ev.target.value || null; });
      
      preloadHeaders(
        "Sales Simulation: Practice your call preparation and delivery",
        "Get structured coaching on clarity, compliance, and discovery"
      );

    // Role Play w/ HCP workflow
    } else if (workflowKey === "role-play") {
      host.appendChild(field("Disease State", select("disease", [
        { value: "",           label: "Select Disease" },
        { value: "oncology",   label: "Oncology" },
        { value: "vaccines",   label: "Vaccines" },
        { value: "hiv",        label: "HIV" },
        { value: "pulmonology",label: "Pulmonology" },
        { value: "hepb",       label: "Hepatitis B" },
        { value: "cardiology", label: "Cardiology" }
      ])));
      host.appendChild(field("HCP Persona", select("hcp", [
        { value: "",    label: "Select HCP" },
        { value: "im",  label: "Internal Medicine MD" },
        { value: "np",  label: "Nurse Practitioner (NP)" },
        { value: "pa",  label: "Physician Assistant (PA)" },
        { value: "id",  label: "Infectious Disease Specialist" },
        { value: "onc", label: "Oncologist" },
        { value: "pulm",label: "Pulmonologist" },
        { value: "card",label: "Cardiologist" }
      ])));
      
      qs('select[name="disease"]')?.addEventListener("change",
        (ev) => { state.disease = ev.target.value || null; });
      qs('select[name="hcp"]')?.addEventListener("change",
        (ev) => { state.hcp = ev.target.value || null; });
      
      preloadHeaders(
        "Role Play: Interact directly with an HCP persona",
        "Practice real-time conversations with realistic responses"
      );

    // EI & Product Knowledge workflow
    } else if (workflowKey === "ei-pk") {
      // Sub-mode selector (EI vs PK)
      const subModeSelect = el("select", { name: "eiPkSubMode", class: "input" }, [
        option("ei", "EI Guidance"),
        option("pk", "Product Knowledge")
      ]);
      subModeSelect.addEventListener("change", (ev) => {
        state.eiPkSubMode = ev.target.value;
        state.backendMode = ev.target.value === "ei" 
          ? BACKEND_MODES.EMOTIONAL_ASSESSMENT 
          : BACKEND_MODES.PRODUCT_KNOWLEDGE;
      });
      host.appendChild(field("Mode", subModeSelect));
      
      // Disease state and HCP type (optional context)
      host.appendChild(field("Disease State (optional)", select("disease", [
        { value: "",           label: "Select Disease" },
        { value: "oncology",   label: "Oncology" },
        { value: "vaccines",   label: "Vaccines" },
        { value: "hiv",        label: "HIV" },
        { value: "pulmonology",label: "Pulmonology" },
        { value: "hepb",       label: "Hepatitis B" },
        { value: "cardiology", label: "Cardiology" }
      ])));
      host.appendChild(field("HCP Type (optional)", select("hcp", [
        { value: "",    label: "Select HCP" },
        { value: "im",  label: "Internal Medicine MD" },
        { value: "np",  label: "Nurse Practitioner (NP)" },
        { value: "pa",  label: "Physician Assistant (PA)" },
        { value: "id",  label: "Infectious Disease Specialist" },
        { value: "onc", label: "Oncologist" },
        { value: "pulm",label: "Pulmonologist" },
        { value: "card",label: "Cardiologist" }
      ])));
      
      qs('select[name="disease"]')?.addEventListener("change",
        (ev) => { state.disease = ev.target.value || null; });
      qs('select[name="hcp"]')?.addEventListener("change",
        (ev) => { state.hcp = ev.target.value || null; });
      
      preloadHeaders(
        "EI & Product Knowledge: Get guidance and answers",
        "Ask about emotional intelligence or product/label information"
      );
    }
  }

  function toggleScoring(defaultOn, forceOn) {
    const w = h("div", { class: "toggle" }, []);
    const id = `score_${Math.random().toString(36).slice(2)}`;
    const cb = h("input", { type: "checkbox", id });
    cb.checked = !!defaultOn;
    cb.addEventListener("change", () => { state.scoring = cb.checked; });
    if (forceOn) { cb.checked = true; cb.disabled = true; state.scoring = true; }
    w.appendChild(cb);
    w.appendChild(h("label", { for: id }, ["Scoring"]));
    return w;
  }

  function preloadHeaders(line1, line2) {
    const a = qs("#hdr1"), b = qs("#hdr2");
    if (a) a.textContent = line1 || "";
    if (b) b.textContent = line2 || "";
  }

  async function onSend(ev) {
    ev.preventDefault();
    const inp = qs("#chatInput");
    const msg = (inp?.value || "").trim();
    if (!msg || !state.backendMode) return;
    inp.value = "";

    // Validate scenario and persona for selected disease state and HCP persona in Role Play mode
    let scenario = null;
    let persona = null;
    if (state.workflowMode === "role-play") {
      const disease = state.disease;
      const hcp = state.hcp;
      scenario = (state.scenarios || []).find(s =>
        s.therapeuticArea?.toLowerCase() === (disease || "").toLowerCase() &&
        (hcp ? s.hcpProfile?.toLowerCase().includes(hcp) : true)
      );
      persona = (state.personas || []).find(p =>
        p.therapeuticAreas?.map(a => a.toLowerCase()).includes((disease || "").toLowerCase()) &&
        (p.displayName?.toLowerCase().includes(hcp) || p.role?.toLowerCase().includes(hcp) || p.specialty?.toLowerCase().includes(hcp))
      );
      if (!scenario || !persona) {
        push("bot", "No valid scenario or persona found for the selected disease state and HCP persona. Please select valid options.");
        return;
      }
    }

    push("user", msg);

    // Add to per-mode history
    const history = state.history[state.backendMode] || [];
    history.push({ role: "user", content: msg });

    // Generate plan for Role Play mode
    let plan = undefined;
    async function getFacts(disease) {
      let facts = (window.FACTS_DB || []).filter(f =>
        f.ta?.toLowerCase() === (disease || "").toLowerCase()
      );
      // If no facts loaded, fetch from local file
      if (!facts.length) {
        try {
          const factsData = await fetch('assets/chat/data/facts.json').then(r => r.json());
          facts = (factsData.facts || []).filter(f =>
            f.ta?.toLowerCase() === (disease || "").toLowerCase()
          );
        } catch (e) {
          facts = [];
        }
      }
      // Only keep facts with both id and text
      return facts.filter(f => f.id && f.text);
    }

    if (state.workflowMode === "role-play" && scenario && persona) {
      const facts = await getFacts(state.disease);
      if (!facts.length) {
        push("bot", "No valid facts found for the selected disease state. Please check your configuration or try another disease.");
        return;
      }
      plan = {
        mode: state.backendMode,
        disease: state.disease,
        persona: persona.displayName || persona.role || "HCP",
        goal: scenario.goal || "Practice realistic HCP conversation.",
        facts: facts.slice(0, 1).map(f => ({ id: f.id, text: f.text, cites: f.cites || [] }))
      };
    }

    // Log payload for debugging
    const payload = {
      mode: state.backendMode,
      history: history.slice(-10),
      eiProfile: state.eiProfile,
      eiFeature: state.eiFeature,
      disease: state.disease,
      hcp: state.hcp,
      message: msg,
      sessionId: state.sessionId,
      scenario: scenario ? {
        id: scenario.id,
        therapeuticArea: scenario.therapeuticArea,
        hcpProfile: scenario.hcpProfile
      } : undefined,
      persona: persona ? {
        id: persona.id,
        displayName: persona.displayName,
        role: persona.role,
        specialty: persona.specialty
      } : undefined,
      plan: plan
    };
    window._lastCoachPayload = payload;
    console.log('[Coach] Sending payload:', payload);

    // Validate required fields
    if (!payload.mode || !payload.message || !payload.disease || !payload.hcp || (state.workflowMode === "role-play" && (!scenario || !persona || !plan || !plan.facts || plan.facts.length === 0))) {
      push("bot", "Please select a valid mode, disease state, HCP persona, and enter a message before sending. (Plan/facts required)");
      return;
    }

    try {
      const reply = await askCoach(msg, history);
      // Detect fallback or error response
      if (reply === 'Stub reply: I parsed your intent and will tailor guidance once the worker responds.' || reply === 'OK.') {
        push("bot", "The coach service could not process your request. Please check your selections and try again.");
      } else {
        push("bot", reply);
      }
      // Add assistant reply to history
      history.push({ role: "assistant", content: reply });
      state.history[state.backendMode] = history;
      if (state.scoring) updateScores();
    } catch (e) {
      push("bot", `Error contacting the coach service: ${e.message || e}`);
    }
  }

  function push(who, text) {
    const row = h("div", { class: `msg ${who}` }, [text]);
    const chat = qs("#chat");
    if (!chat) return;
    chat.appendChild(row);
    chat.scrollTop = chat.scrollHeight;
  }

  async function askCoach(text, history = []) {
    const url = window.COACH_ENDPOINT || "/coach";
    // Use latest payload from onSend for backend alignment
    const payload = window._lastCoachPayload || {
      mode: state.backendMode,
      history: history.slice(-10),
      eiProfile: state.eiProfile,
      eiFeature: state.eiFeature,
      disease: state.disease,
      hcp: state.hcp,
      message: text,
      sessionId: state.sessionId
    };

    // For EI mode, load and include EI framework context if available
    if (state.backendMode === "emotional-assessment") {
      try {
        if (typeof EIContext !== "undefined" && EIContext?.getSystemExtras) {
          const eiExtras = await EIContext.getSystemExtras().catch(() => null);
          if (eiExtras) {
            payload.eiContext = eiExtras.slice(0, 8000);
          }
        }
      } catch (e) {
        console.warn("[coach] Failed to load EI context:", e.message);
        // Continue without EI context rather than failing the request
      }
    }

    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (r.ok) {
      const j = await r.json().catch(() => null);
      return j?.reply || "OK.";
    }
    // local stub
    return "Stub reply: I parsed your intent and will tailor guidance once the worker responds.";
  }

  function updateScores() {
    const bump = () => 60 + Math.floor(Math.random() * 35); // 60–94
    qsa("[data-score]").forEach(n => { n.textContent = bump(); });
  }

  // ---------- public API ----------
  async function mount(root) {
    state.sessionId = `${Date.now()}`;   // fresh session per mount
    await loadData();

    // 1) Find or create a host to attach into
    let host = root
      || document.querySelector('#coach-modal .content')
      || document.querySelector('.coach-modal .content')
      || document.querySelector('.modal .content')
      || document.querySelector('.coach-modal-host')
      || document.querySelector('#coach-container');

    // If no obvious host exists, create a minimal overlay on the body
    if (!host) {
      const overlay = h('div', {
        id: 'coach-modal',
        role: 'dialog',
        'aria-modal': 'true',
        'aria-labelledby': 'coach-title',
        class: 'rfx-coach-overlay'
      });
      document.body.appendChild(overlay);
      host = overlay;
    }

    // 2) Build the UI inside the host
    buildShell(host);

    // 3) Seed guidance
    preloadHeaders('', '');

    // 4) Return the host in case caller wants a handle
    return host;
  }

  // Auto-mount when user clicks a "Try a Simulation" style trigger
  (function autoMount() {
    const isTrigger = (el) =>
      el?.matches?.('[data-open-coach], [data-coach], a, button') &&
      /simulation|try a simulation/i.test(el.textContent || '');

    document.addEventListener('click', (e) => {
      const t = e.target.closest && e.target.closest('*');
      if (!t) return;
      if (!isTrigger(t)) return;

      // prevent hash jumps on anchors
      if (t.tagName === 'A' && t.getAttribute('href')?.includes('#')) e.preventDefault();

      const existing =
        document.querySelector('#coach-modal .content') ||
        document.querySelector('.coach-modal .content') ||
        document.querySelector('.modal .content');

      window.ReflectivCoach.mount(existing);
    }, { capture: true });
  })();

  window.ReflectivCoach = { mount };
})();
