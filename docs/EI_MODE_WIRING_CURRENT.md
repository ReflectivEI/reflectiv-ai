# EI MODE WIRING: CURRENT STATE (BEFORE FIXES)

**Generated:** November 13, 2025  
**Scope:** Full UI → Widget → Mode Modules → Cloudflare Worker mapping for Emotional Intelligence and General Assistant modes

---

## 1. UI Layer: Learning Center Dropdown

### Mode Selection Mapping

Located in: `widget.js` lines 54–60

```javascript
const LC_OPTIONS = ["Emotional Intelligence", "Product Knowledge", "Sales Coach", "Role Play", "General Assistant"];
const LC_TO_INTERNAL = {
  "Emotional Intelligence": "emotional-assessment",
  "Product Knowledge": "product-knowledge",
  "Sales Coach": "sales-coach",
  "Role Play": "role-play",
  "General Assistant": "general-knowledge"
};
```

**UI Label → Internal Mode Key Mapping:**

| UI Label (Learning Center) | Internal Mode Key | Backend Constant |
|----------------------------|-------------------|------------------|
| Emotional Intelligence | `emotional-assessment` | `EMOTIONAL_ASSESSMENT` |
| General Assistant | `general-knowledge` | — |
| Sales Coach | `sales-coach` | `SALES_SIMULATION` |
| Role Play | `role-play` | — |
| Product Knowledge | `product-knowledge` | — |

**Key Finding:** Both EI and General Assistant use distinct mode keys sent to the Worker.

---

## 2. Widget Layer: Coach.js Mode Handling

Located in: `assets/chat/coach.js` lines 40–380

### Mode Workflow Configuration

```javascript
const WORKFLOW_MODES = [
  { key: "sales-coach", label: "Sales Coach & Call Prep", backendMode: "sales-simulation" },
  { key: "role-play", label: "Role Play w/ HCP", backendMode: "role-play" },
  { key: "ei-pk", label: "EI & Product Knowledge", backendModes: ["emotional-assessment", "product-knowledge"] }
];

const BACKEND_MODES = {
  EMOTIONAL_ASSESSMENT: "emotional-assessment",
  PRODUCT_KNOWLEDGE: "product-knowledge",
  SALES_SIMULATION: "sales-simulation",
  ROLE_PLAY: "role-play"
};
```

### Mode Selection Handler (onModeChange)

**Location:** `coach.js` lines 277–300

When a user selects a workflow:
1. `state.backendMode` is set to the corresponding backend mode key
2. For "EI & Product Knowledge" workflow, defaults to `EMOTIONAL_ASSESSMENT` with sub-mode selector
3. Fresh session ID generated on mode change
4. UI populates dependent selectors (persona, feature, disease)

### Request Payload Construction

**Location:** `coach.js` lines 562–580

```javascript
async function askCoach(text, history = []) {
  const url = window.COACH_ENDPOINT || "/coach";
  const payload = window._lastCoachPayload || {
    mode: state.backendMode,        // <-- Mode key sent to Worker
    history: history.slice(-10),
    eiProfile: state.eiProfile,     // EI-specific context
    eiFeature: state.eiFeature,     // EI-specific context
    disease: state.disease,
    hcp: state.hcp,
    message: text,
    sessionId: state.sessionId
  };
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  // ...
}
```

**Emotional Intelligence Request Payload Example:**
```json
{
  "mode": "emotional-assessment",
  "message": "How does this mode work?",
  "history": [],
  "eiProfile": "difficult",
  "eiFeature": "empathy",
  "disease": null,
  "hcp": null,
  "sessionId": "1699000000000"
}
```

**General Assistant Request Payload Example:**
```json
{
  "mode": "general-knowledge",
  "message": "How can I improve my empathy when talking to an HCP?",
  "history": [],
  "eiProfile": null,
  "eiFeature": null,
  "disease": null,
  "hcp": null,
  "sessionId": "1699000001000"
}
```

**Key Finding:** EI payload includes `eiProfile` and `eiFeature` context, but `disease` and `hcp` are null (not required for EI mode).

---

## 3. Mode Module Layer

### Emotional Intelligence Module

**File:** `assets/chat/modes/emotionalIntelligence.js`

```javascript
export function createModule({ bus, store, register }){
  let root, input, sendBtn, out;
  
  function init(){
    bind();
    register.wrap(sendBtn, 'click', handleSend);
    register.wrap(input, 'keydown', handleKey);
  }
  
  async function handleSend(){
    const msg = input.value.trim();
    const {mode} = store.get();  // Retrieves 'emotional-assessment' from mode store
    const data = await chat({
      mode,
      messages:[{role:'user',content:msg}],
      signal
    });
    appendMessage('assistant', data.reply);
  }
  
  function teardown(){ /* cleanup */ }
  return { init, teardown };
}
```

**Exports:**
- `createModule` – Factory function accepting `{ bus, store, register }`
- Returns `{ init, teardown }` – Lifecycle hooks
- No custom prompts or system context exported

**Integration Point:** `assets/chat/core/switcher.js`
```javascript
const loaders = {
  'emotional-intelligence': () => import('../modes/emotionalIntelligence.js'),
  'role-play': () => import('../modes/rolePlay.js'),
  'sales-coach': () => import('../modes/salesCoach.js'),
  'product-knowledge': () => import('../modes/productKnowledge.js'),
};
```

**Key Finding:** The EI module does NOT define EI-specific prompts or context — it only handles UI events and delegates to the API layer.

### API Layer

**File:** `assets/chat/core/api.js` (used by all mode modules)

```javascript
export async function chat({mode, messages, signal}){
  const res = await fetch(`${WORKER}/chat`, {
    method:'POST',
    headers:{'content-type':'application/json'},
    body: JSON.stringify({mode, messages}),  // <-- Only mode and messages sent
    signal
  });
  if(!res.ok) throw new Error(`chat:${res.status}`);
  const data = await res.json();
  return data;
}
```

**Observation:** The API layer sends only `mode` and `messages` to the Worker. EI context from `ei-context.js` is NOT loaded client-side and merged into the request.

---

## 4. Cloudflare Worker Layer: Mode Branching

### /chat Endpoint Handler

**File:** `worker.js` lines 752–1430

#### Mode Extraction
```javascript
async function postChat(req, env) {
  const body = await readJson(req);
  
  // Both widget and ReflectivAI formats supported
  let mode = body.mode || "sales-coach";  // Default fallback
  
  // ... request normalization ...
}
```

#### System Prompt Assignment

**Location:** `worker.js` lines 1220–1230

```javascript
let sys;
if (mode === "role-play") {
  sys = rolePlayPrompt;
} else if (mode === "sales-coach") {
  sys = salesCoachPrompt;
} else if (mode === "emotional-assessment") {
  sys = eiPrompt;              // <-- EI uses custom prompt
} else if (mode === "product-knowledge") {
  sys = pkPrompt;
} else if (mode === "general-knowledge") {
  sys = generalKnowledgePrompt;
} else {
  sys = salesCoachPrompt;      // <-- Default fallback (problem!)
}
```

#### EI System Prompt

**Location:** `worker.js` lines 994–1040

```javascript
const eiPrompt = [
  `You are Reflectiv Coach in Emotional Intelligence mode.`,
  ``,
  `HCP Type: ${persona || "—"}; Disease context: ${disease || "—"}.`,
  ``,
  `MISSION: Help the rep develop emotional intelligence through reflective practice based on about-ei.md framework.`,
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
  `[Detailed prompt content]...`,
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
```

**Observation:** The EI prompt references "about-ei.md framework" but does NOT actually load or embed the content of `about-ei.md` into the system prompt. It's purely instructional boilerplate.

#### Token Allocation for EI Mode

**Location:** `worker.js` lines 1251–1266

```javascript
let maxTokens;
if (mode === "sales-coach") {
  maxTokens = 1600;
} else if (mode === "role-play") {
  maxTokens = 1200;
} else if (mode === "emotional-assessment") {
  maxTokens = 1200;  // EI mode token allocation
} else if (mode === "product-knowledge") {
  maxTokens = 1800;
} else if (mode === "general-knowledge") {
  maxTokens = 1800;
} else {
  maxTokens = 900;
}
```

### General Assistant System Prompt

**Location:** `worker.js` lines 1040–1080 (approx.)**

```javascript
const generalKnowledgePrompt = [
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
  // ...
].join("\n");
```

**Observation:** General Assistant is also comprehensive but is NOT EI-centric—it's a knowledge base assistant.

---

## 5. Key Artifacts: About-EI Files

### about-ei.md

**File:** `assets/chat/about-ei.md` (306 lines)  
**Purpose:** Comprehensive EI framework definition including Triple-Loop Reflection, CASEL SEL competencies, heuristic evaluation, and feedback protocols

**Content Summary:**
- Foundational principles (multi-source assessment, non-judgmental, personal relevance, active reflection, self-directed growth)
- Triple-Loop Reflection Architecture (Task Outcome, Emotional Regulation, Mindset Reframing)
- EI Domains and SEL Mapping (Self-Awareness, Self-Regulation, Empathy, Clarity, Social/Relationship, Compliance)
- Heuristic Evaluation Model (behavioral markers, cues)
- Feedback and Coaching Logic (affirmation, diagnosis, guidance, application)

**Current Usage:** ONLY loaded by `about-ei-modal.js` when user explicitly opens the "About EI" modal. NOT embedded in chat prompts.

### about-ei.md.bak

**File:** `assets/chat/about-ei.md.bak` (283 lines)  
**Status:** Backup copy; content is similar but slightly shorter

**Diff Summary:** .bak is older/shorter version; current about-ei.md has more detailed sections.

### ei-context.js

**File:** `assets/chat/ei-context.js`  
**Purpose:** Async loader for EI knowledgebase with system context builder

**Exports:**
```javascript
window.EIContext = { load, getSystemExtras };
```

**getSystemExtras() returns:**
- First 7000 chars of about-ei.md
- Rubric JSON (up to 4000 chars)
- Persona JSON (up to 2000 chars)
- Coach output spec metadata

**Current Usage:** NEVER called in the current UI or API pipeline. It exists but is isolated.

### about-ei-modal.js

**File:** `assets/chat/about-ei-modal.js`  
**Purpose:** UI modal to display about-ei.md content

**Key Function:**
```javascript
window.openAboutEI = loadAndShow;  // Global entrypoint
```

**Current Usage:** Only called if a button explicitly calls `window.openAboutEI()`. NOT integrated into EI mode chat flow.

---

## 6. CRITICAL FINDINGS

### Issue 1: EI Context NOT Injected Into Chat Payload
The `ei-context.js` module is defined but **never loaded or merged** into the Worker chat request. When a user asks a question in EI mode, the Worker receives only:
- `mode: "emotional-assessment"`
- `messages: [{role: 'user', content: '...'}]`
- `eiProfile`, `eiFeature` (basic metadata, NOT the EI framework)

Missing: actual content from about-ei.md or ei-context.js

### Issue 2: Worker eiPrompt References about-ei.md But Doesn't Load It
The Worker's `eiPrompt` instructs: "Help the rep develop emotional intelligence through reflective practice based on about-ei.md framework."

But about-ei.md is NOT:
- Embedded in the prompt
- Passed via environment variables
- Loaded from KV storage
- Fetched dynamically

### Issue 3: about-ei-modal.js Not Integrated Into Chat Flow
The modal that displays EI framework content is **only a static reference modal**, not integrated into the chat response generation. When a user asks "How does this mode work?" in EI mode, the system does NOT check about-ei-modal.js or load about-ei.md to answer the question.

### Issue 4: emotionalIntelligence.js Module Minimal
The mode module for EI doesn't export any EI-specific prompts, context builders, or payload enrichers. It only handles generic UI event binding and delegates to the API layer.

---

## 7. Comparison: Emotional Intelligence vs General Assistant

| Aspect | EI Mode | General Assistant |
|--------|---------|-------------------|
| **UI Label** | "Emotional Intelligence" | "General Assistant" |
| **Internal Key** | `emotional-assessment` | `general-knowledge` |
| **Request Payload** | `{mode, messages, eiProfile, eiFeature}` | `{mode, messages}` |
| **System Prompt** | eiPrompt (EI-centric, references about-ei.md) | generalKnowledgePrompt (knowledge-oriented) |
| **EI Files Loaded** | None dynamically | N/A |
| **about-ei.md Used** | Referenced in prompt but NOT embedded | Not used |
| **Token Allocation** | 1200 | 1800 |
| **Distinct Handler** | Yes (mode === "emotional-assessment") | Yes (mode === "general-knowledge") |

**Finding:** Both modes have DISTINCT Worker branching, but EI mode's advantage (the eiPrompt) is NOT backed by the EI framework content from about-ei.md.

---

## 8. Hypothesis: Why EI Outputs Look Like General Assistant

**Root Cause Candidate:** The eiPrompt in the Worker is INSTRUCTIONAL but NOT GROUNDED in actual EI framework content from about-ei.md. When a user asks a general question like "How does this mode work?", the LLM is instructed to be "EI-centric" but has no concrete framework content to reference or ground its response. As a result, it may default to generic LLM behavior similar to General Assistant.

**Example:** User asks in EI mode: "How does this mode work?"

- Worker receives: `{mode: "emotional-assessment", messages: [{role: 'user', content: 'How does this mode work?'}]}`
- Worker selects: `eiPrompt` (which says "help via about-ei.md framework")
- LLM generates: Generic response about coaching and reflection (sounds like an instruction-following response, not EI-specific)
- Missing: Actual about-ei.md content (Triple-Loop, CASEL competencies, heuristic rules, etc.)

---

## 9. Summary: Current Wiring State

```
┌─ widget.js
│  └─ UI: "Emotional Intelligence" dropdown selected
│     └─ mode = "emotional-assessment"
│        └─ coach.js creates payload with mode + eiProfile/eiFeature
│           └─ POST to Worker /chat endpoint
│              └─ Worker postChat()
│                 ├─ Receives: {mode: "emotional-assessment", messages, eiProfile, eiFeature}
│                 ├─ Selects: eiPrompt (references about-ei.md framework but doesn't load it)
│                 ├─ Calls: LLM with eiPrompt + user message
│                 └─ Returns: Response (may sound generic because no actual EI framework content provided)
│
│  Missing Integration Points:
│  - ei-context.js NOT loaded/merged into request
│  - about-ei.md NOT embedded in eiPrompt
│  - about-ei-modal.js NOT called for chat responses
│  - emotionalIntelligence.js module NOT enriching payload with EI context
```

---

**Next Steps (Phases 2–5):**
1. ✅ Phase 1: Map current wiring (COMPLETE)
2. Confirm above hypothesis via inspection of how about-ei.md and ei-context.js should be integrated
3. Fix the integration points
4. Add about-ei.md content to eiPrompt or pass it via request
5. Test EI vs General Assistant mode distinction
