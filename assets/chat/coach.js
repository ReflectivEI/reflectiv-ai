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
  const MODES = [
    { key: "emotional-intelligence", label: "Emotional Intelligence" },
    { key: "product-knowledge",      label: "Product Knowledge" },
    { key: "sales-simulation",       label: "Sales Simulation" },
    { key: "role-play",              label: "Role Play" }
  ];
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
  
  // EI domain data for clickable pills
  const EI_DOMAINS = {
    empathy: {
      label: "Empathy",
      description: "Ability to acknowledge perspectives, demonstrate emotional attunement, and use phrases like 'I hear your concern' or 'It makes sense that...'",
      rationale: "AI-derived rationale will appear here when available"
    },
    objection: {
      label: "Objection Handling", 
      description: "Skill in addressing concerns constructively, reframing objections, and maintaining composure under challenge",
      rationale: "AI-derived rationale will appear here when available"
    },
    clarity: {
      label: "Clarity & Confidence",
      description: "Concise communication, limited jargon, clear structure, and confident delivery without overloading the listener",
      rationale: "AI-derived rationale will appear here when available"
    },
    accuracy: {
      label: "Accuracy & Compliance",
      description: "Label-safe phrasing, fact-based claims, ethical framing, and adherence to regulatory standards",
      rationale: "AI-derived rationale will appear here when available"
    },
    discovery: {
      label: "Discovery",
      description: "Quality of inquiry, asking open-ended questions, uncovering needs, and collaborative dialogue",
      rationale: "AI-derived rationale will appear here when available"
    },
    regulation: {
      label: "Self-Regulation",
      description: "Neutral tone, pauses before responding, emotional control, and maintaining composure in difficult interactions",
      rationale: "AI-derived rationale will appear here when available"
    }
  };
  
  // Constants
  const SCORE_MULTIPLIER = 20; // Convert worker 0-5 scale to UI 0-100 display scale (5 * 20 = 100)

  // ---------- state ----------
  const state = {
    cfg: null, personas: [], scenarios: [],
    mode: null, eiProfile: null, eiFeature: null,
    disease: null, hcp: null, scoring: false, sessionId: null
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
  
  // Create clickable EI pill
  function createEIPill(domain, label, initialScore) {
    const pill = h("div", { 
      class: "score ei-pill", 
      "data-domain": domain,
      style: "cursor:pointer;transition:transform 0.2s;",
      role: "button",
      tabindex: "0",
      "aria-label": `View details for ${label}`
    }, [
      h("div", { class: "score-name" }, [label]),
      h("div", { "data-score": domain, class: "score-val" }, [initialScore])
    ]);
    
    // Add hover effect
    pill.addEventListener("mouseenter", () => {
      pill.style.transform = "scale(1.05)";
      pill.style.boxShadow = "0 4px 12px rgba(32, 191, 169, 0.3)";
    });
    pill.addEventListener("mouseleave", () => {
      pill.style.transform = "scale(1)";
      pill.style.boxShadow = "";
    });
    
    // Add click handler to show rationale
    pill.addEventListener("click", () => showEIRationale(domain));
    pill.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        showEIRationale(domain);
      }
    });
    
    return pill;
  }
  
  // Show EI domain rationale in a modal
  function showEIRationale(domain) {
    const domainData = EI_DOMAINS[domain];
    if (!domainData) return;
    
    const scoreEl = qs(`[data-score="${domain}"]`);
    const currentScore = scoreEl ? scoreEl.textContent : "--";
    
    // Create modal
    const modal = h("div", { 
      class: "ei-rationale-modal",
      style: "position:fixed;inset:0;z-index:20000;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;",
      role: "dialog",
      "aria-modal": "true",
      "aria-labelledby": "ei-rationale-title"
    }, [
      h("div", {
        style: "background:#fff;border-radius:16px;max-width:500px;width:90%;padding:24px;box-shadow:0 12px 28px rgba(0,0,0,0.3);"
      }, [
        h("h3", { 
          id: "ei-rationale-title",
          style: "margin:0 0 12px;color:#0f2747;font-size:20px;"
        }, [domainData.label]),
        h("div", { 
          style: "font-size:32px;font-weight:700;color:#20bfa9;margin:8px 0 16px;"
        }, [currentScore]),
        h("p", {
          style: "color:#64748b;margin:0 0 16px;line-height:1.6;"
        }, [domainData.description]),
        h("div", {
          style: "background:#f8fafc;border-left:3px solid #20bfa9;padding:12px;margin:16px 0;border-radius:4px;"
        }, [
          h("strong", { style: "color:#0f2747;display:block;margin-bottom:8px;" }, ["AI Rationale:"]),
          h("p", { 
            style: "margin:0;color:#64748b;font-size:14px;line-height:1.5;",
            "data-rationale": domain
          }, [domainData.rationale])
        ]),
        h("a", {
          href: "ei-score-details.html",
          target: "_blank",
          style: "display:inline-block;margin:16px 0 12px;color:#20bfa9;text-decoration:none;font-size:14px;"
        }, ["Learn more about EI domains →"]),
        h("div", { style: "text-align:right;" }, [
          h("button", {
            class: "ei-close-btn",
            style: "padding:8px 16px;background:#0f2747;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:600;",
            type: "button"
          }, ["Close"])
        ])
      ])
    ]);
    
    // Close handlers
    const closeBtn = modal.querySelector(".ei-close-btn");
    const closeModal = () => modal.remove();
    closeBtn.addEventListener("click", closeModal);
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeModal();
    });
    modal.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeModal();
    });
    
    document.body.appendChild(modal);
    closeBtn.focus();
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
          option("", "Select Mode"),
          ...MODES.map(m => option(m.key, m.label))
        ]);
        return el("div", { class: "field" }, [
          el("label", {}, ["Learning Center"]),
          sel
        ]);
      })(),
      el("div", { id: "modeFields", class: "mode-fields" }, [])
    ]);

    // score pills (clickable, updated by updateScores with EI data)
    const scores = el("div", { class: "scores", id: "eiScoresPanel" }, [
      createEIPill("empathy", "Empathy", "_"),
      createEIPill("objection", "Objection Handling", "_"),
      createEIPill("clarity", "Clarity & Confidence", "_"),
      createEIPill("accuracy", "Accuracy & Compliance", "_"),
      createEIPill("discovery", "Discovery", "_"),
      createEIPill("regulation", "Self-Regulation", "_")
    ]);
    
    // Add "View EI Score Breakdown" link
    const breakdownLink = el("div", { class: "ei-breakdown-link", style: "text-align:center;margin-top:8px;" }, [
      el("a", { 
        href: "ei-score-details.html", 
        target: "_blank",
        style: "color:#20bfa9;font-size:13px;text-decoration:none;"
      }, ["📊 View EI Score Breakdown →"])
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
    root.appendChild(scores);
    root.appendChild(breakdownLink);
    root.appendChild(body);

    // wire events
    qs('select[name="mode"]', root)?.addEventListener("change", onModeChange);
    qs("#chatForm", root)?.addEventListener("submit", onSend);

    // Esc to close
    root.addEventListener("keydown", (e) => { if (e.key === "Escape") root.remove(); });

    return root;
  }

  // ---------- interactions ----------
  function onModeChange(e) {
    state.mode = e.target.value || null;

    // fresh session per mode
    state.sessionId = `${Date.now()}`;
    const chat = qs("#chat"); if (chat) chat.innerHTML = "";

    // populate dependent fields
    const host = qs("#modeFields");
    if (!host) return;

    host.innerHTML = "";

    if (state.mode === "emotional-intelligence") {
      host.appendChild(field("EI Profile", select("eiProfile", [
        { value: "", label: "Select EI Profile" },
        ...EI_PROFILES.map(x => ({ value: x.key, label: x.label }))
      ])));
      host.appendChild(field("EI Feature", select("eiFeature", [
        { value: "", label: "Select EI Feature" },
        ...EI_FEATURES.map(x => ({ value: x.key, label: x.label }))
      ])));
      host.appendChild(toggleScoring(true)); // ON by default, can be toggled off
      qs('select[name="eiProfile"]')?.addEventListener("change",
        (ev) => { state.eiProfile = ev.target.value || null; });
      qs('select[name="eiFeature"]')?.addEventListener("change",
        (ev) => { state.eiFeature = ev.target.value || null; });
      preloadHeaders(
        "HCP Background: Time-pressured; direct; workflow sensitive.",
        "Key Takeaways: Lead with relevance; ask one barrier question."
      );

    } else if (state.mode === "product-knowledge" || state.mode === "sales-simulation") {
      host.appendChild(field("Disease State", select("disease", [
        { value: "",           label: "Select Disease" },
        { value: "oncology",   label: "Oncology" },
        { value: "vaccines",   label: "Vaccines" },
        { value: "hiv",        label: "HIV" },
        { value: "pulmonology",label: "Pulmonology" },
        { value: "hepb",       label: "Hepatitis B" },
        { value: "cardiology", label: "Cardiology" }
      ])));
      host.appendChild(field("HCP Profile", select("hcp", [
        { value: "",    label: "Select HCP" },
        { value: "im",  label: "Internal Medicine MD" },
        { value: "np",  label: "Nurse Practitioner (NP)" },
        { value: "pa",  label: "Physician Assistant (PA)" },
        { value: "id",  label: "Infectious Disease Specialist" },
        { value: "onc", label: "Oncologist" },
        { value: "pulm",label: "Pulmonologist" },
        { value: "card",label: "Cardiologist" }
      ])));
      host.appendChild(toggleScoring(false)); // OFF by default
      qs('select[name="disease"]')?.addEventListener("change",
        (ev) => { state.disease = ev.target.value || null; });
      qs('select[name="hcp"]')?.addEventListener("change",
        (ev) => { state.hcp = ev.target.value || null; });
      preloadHeaders(
        "HCP Background: Evidence-focused; prior-auth burden; limited time.",
        "Key Takeaways: Tie to guidance; ask one targeted needs question."
      );

    } else if (state.mode === "role-play") {
      // Reuse PK controls, then force scoring ON
      onModeChange({ target: { value: "product-knowledge" } });
      state.mode = "role-play";
      toggleScoring(true, true); // ensure ON
      preloadHeaders(
        "HCP Background: Practical, time-constrained.",
        "Today’s Goal: Practice concise value; ask one discovery question."
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
    if (!msg) return;
    inp.value = "";
    push("user", msg);

    try {
      const data = await askCoach(msg);
      push("bot", data.reply || data);
      // Update EI scores if data contains _coach.ei
      if (state.scoring && data._coach?.ei) {
        updateScores(data._coach.ei);
      } else if (state.scoring) {
        updateScores(); // Use random fallback
      }
    } catch {
      push("bot", "Temporary issue contacting the coach service.");
    }
  }

  function push(who, text) {
    const row = h("div", { class: `msg ${who}` }, [text]);
    const chat = qs("#chat");
    if (!chat) return;
    chat.appendChild(row);
    chat.scrollTop = chat.scrollHeight;
  }

  async function askCoach(text) {
    const url = window.COACH_ENDPOINT || "/coach";
    const r = await fetch(url, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "x-emit-ei": "true"  // Request EI data
      },
      body: JSON.stringify({
        mode: state.mode,
        eiProfile: state.eiProfile,
        eiFeature: state.eiFeature,
        disease: state.disease,
        hcp: state.hcp,
        message: text,
        sessionId: state.sessionId
      })
    });
    if (r.ok) {
      const j = await r.json().catch(() => null);
      return j || { reply: "OK." };
    }
    // local stub
    return { reply: "Stub reply: I parsed your intent and will tailor guidance once the worker responds." };
  }

  function updateScores(eiData) {
    if (eiData && eiData.scores) {
      // Update with actual EI scores from worker
      Object.keys(eiData.scores).forEach(domain => {
        const scoreEl = qs(`[data-score="${domain}"]`);
        if (scoreEl) {
          const score = eiData.scores[domain];
          scoreEl.textContent = score !== undefined ? Math.round(score * SCORE_MULTIPLIER) : "--"; // Convert 0-5 to 0-100
        }
      });
      
      // Update rationales if provided
      Object.keys(eiData).forEach(domain => {
        if (domain !== 'scores' && EI_DOMAINS[domain]) {
          const rationaleEl = qs(`[data-rationale="${domain}"]`);
          if (rationaleEl && eiData[domain]?.rationale) {
            rationaleEl.textContent = eiData[domain].rationale;
          }
        }
      });
    } else {
      // Fallback: generate random scores for demo
      const bump = () => 60 + Math.floor(Math.random() * 35); // 60–94
      qsa("[data-score]").forEach(n => { n.textContent = bump(); });
    }
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
