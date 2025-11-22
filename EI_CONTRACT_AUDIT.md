# PHASE 1 — Contract Audit (Worker ↔ UI)

**Generated:** 2025-11-12
**Purpose:** Document exact JSON schema and identify mismatches between Worker output and UI expectations

---

## Worker Output Schema (CURRENT)

### Chat Response Structure
```typescript
// POST /chat response
{
  reply: string,           // Main AI response text
  coach?: CoachObject,     // EI scores and feedback (mode-dependent)
  plan?: {
    id: string
  }
}
```

### CoachObject Schema — Full 10-Metric Version
```typescript
// Used by: sales-coach, role-play modes
interface CoachObject {
  // === 10 EI METRICS (1-5 scale) ===
  scores: {
    empathy: number,              // 1-5
    clarity: number,              // 1-5
    compliance: number,           // 1-5
    discovery: number,            // 1-5
    objection_handling: number,   // 1-5
    confidence: number,           // 1-5
    active_listening: number,     // 1-5
    adaptability: number,         // 1-5
    action_insight: number,       // 1-5
    resilience: number            // 1-5
  },

  // === OPTIONAL RATIONALES ===
  rationales?: {
    empathy?: string,
    clarity?: string,
    compliance?: string,
    discovery?: string,
    objection_handling?: string,
    confidence?: string,
    active_listening?: string,
    adaptability?: string,
    action_insight?: string,
    resilience?: string
  },

  // === NARRATIVE FEEDBACK ===
  worked?: string[],      // What worked well (array of strings)
  improve?: string[],     // What to improve (array of strings)
  phrasing?: string,      // Suggested phrasing (single string)
  feedback?: string,      // Overall feedback paragraph

  // === CONTEXT TRACKING ===
  context?: {
    rep_question: string,
    hcp_reply: string
  },

  // === METADATA ===
  rubric_version?: string,  // e.g., "v2.0"
  overall?: number          // 0-100 (not currently used)
}
```

**Source:** worker.js lines 850-851, 863, 1337

---

## UI Consumption (CURRENT)

### Widget.js — EI Panel Renderer (Yellow Panel)
```javascript
// widget.js:362-397 — renderEiPanel()
function renderEiPanel(msg) {
  const ei = msg && msg._coach && msg._coach.ei;  // ❌ WRONG PATH
  if (!ei || !ei.scores) return "";

  const S = ei.scores || {};  // ❌ Looking for .ei.scores instead of .scores

  // ⚠️ ONLY DISPLAYS 5 METRICS (missing 5 others):
  return `
    <div class="ei-row">
      ${mk("empathy", "Empathy")}        // ✅ Exists
      ${mk("discovery", "Discovery")}    // ✅ Exists
      ${mk("compliance", "Compliance")}  // ✅ Exists
      ${mk("clarity", "Clarity")}        // ✅ Exists
      ${mk("accuracy", "Accuracy")}      // ❌ DOES NOT EXIST IN WORKER SCHEMA
    </div>
  `;
}
```

**Problems:**
1. **Wrong path:** Looking for `msg._coach.ei.scores` instead of `msg._coach.scores`
2. **"accuracy" metric doesn't exist** — Worker returns `empathy, clarity, compliance, discovery, objection_handling, confidence, active_listening, adaptability, action_insight, resilience`
3. **Missing 5 metrics:** `objection_handling, confidence, active_listening, adaptability, action_insight, resilience` not displayed

---

### Widget.js — Full Coach Panel Renderer
```javascript
// widget.js:1898-2050 — renderCoach()
function renderCoach() {
  const fb = last._coach;  // ✅ CORRECT PATH
  const scores = fb.scores || fb.subscores || {};  // ✅ CORRECT

  // === Sales Coach Mode (L1937-1945) ===
  const eiHTML = renderEiPanel(last);  // ❌ Calls broken renderEiPanel

  // === Emotional Assessment / Role Play Mode (L2018-2031) ===
  const eiMetricOrder = [
    "empathy", "clarity", "compliance", "discovery",
    "objection_handling", "confidence", "active_listening",
    "adaptability", "action_insight", "resilience"
  ];  // ✅ CORRECT — All 10 metrics listed

  const eiPills = eiMetricOrder
    .filter(k => k in eiScores)
    .map(k => renderPill(k));  // ✅ CORRECT RENDERING
}
```

**Finding:** The full coach panel (`renderCoach`) has CORRECT logic for all 10 metrics, but the yellow EI summary panel (`renderEiPanel`) is broken.

---

## Schema Mismatch Summary

| Component | Expected Path | Actual Path | Metrics Displayed | Status |
|-----------|---------------|-------------|-------------------|--------|
| **Worker Output** | `response.coach.scores` | N/A | 10 metrics | ✅ Correct |
| **renderEiPanel (Yellow)** | `msg._coach.ei.scores` | `msg._coach.scores` | 5 metrics (1 invalid) | ❌ BROKEN |
| **renderCoach (Full Panel)** | `msg._coach.scores` | `msg._coach.scores` | 10 metrics | ✅ Correct |

---

## Missing Metrics in UI

### Currently NOT Displayed in Yellow EI Panel:
1. ❌ `objection_handling` — Addressing concerns, barriers, resistance
2. ❌ `confidence` — Tone, composure, professional presence
3. ❌ `active_listening` — Acknowledging, reflecting back, pausing
4. ❌ `adaptability` — Adjusting to HCP style, time pressure
5. ❌ `action_insight` — Next steps, practical takeaways
6. ❌ `resilience` — Recovery from objections, stress management

### Invalid Metric in UI:
- ❌ `accuracy` — This metric does NOT exist in Worker schema

---

## Worker Deterministic Fallback (Correct 10 Metrics)

```javascript
// worker.js:1330-1345
scores: {
  empathy: 3,
  clarity: 4,
  compliance: 4,
  discovery: /[?]\s*$/.test(reply) ? 4 : 3,  // ✅ Dynamic based on question
  objection_handling: 3,
  confidence: 4,
  active_listening: 3,
  adaptability: 3,
  action_insight: 3,
  resilience: 3
}
```

**Status:** ✅ Worker correctly returns all 10 metrics with deterministic fallback

---

## Worker Schema Validation

```javascript
// worker.js:606-620 — validateCoachSchema()
function validateCoachSchema(coach, mode) {
  const requiredFields = {
    "sales-coach": ["scores", "worked", "improve", "feedback"],  // ✅ Correct
    "emotional-assessment": ["ei"],                              // ⚠️ Wrong key
    "product-knowledge": [],                                     // ✅ No coach
    "role-play": []                                              // ⚠️ Should require scores
  };

  const required = requiredFields[mode] || [];
  const missing = required.filter(key => !(coach && key in coach));

  return { valid: missing.length === 0, missing };
}
```

**Problems:**
1. ❌ `emotional-assessment` requires `["ei"]` but should require `["scores"]`
2. ❌ `role-play` has no requirements but should require `["scores"]`

---

## Widget Preface Contract (Client-Side Prompt)

```javascript
// widget.js:1330-1343
const COMMON = `# ReflectivAI — Output Contract
Return exactly two parts. No code blocks. No markdown headings.
1) Sales Guidance: short, actionable, accurate guidance.
2) <coach>{
     "overall": 0-100,
     "scores": {
       "empathy":0-5,
       "clarity":0-5,
       "compliance":0-5,
       "discovery":0-5,
       "objection_handling":0-5,
       "confidence":0-5,
       "active_listening":0-5,
       "adaptability":0-5,
       "action_insight":0-5,
       "resilience":0-5
     },
     "worked": ["…"],
     "improve": ["…"],
     "phrasing": "…",
     "feedback": "one concise paragraph",
     "context": { "rep_question":"...", "hcp_reply":"..." }
   }</coach>`;
```

**Status:** ✅ Client-side prompt correctly defines all 10 metrics

---

## Worker Prompt Contract (Server-Side)

```javascript
// worker.js:850-856 (Sales Coach contract)
<coach>{
  "scores":{"empathy":0-5,"clarity":0-5,"compliance":0-5,"discovery":0-5,"objection_handling":0-5,"confidence":0-5,"active_listening":0-5,"adaptability":0-5,"action_insight":0-5,"resilience":0-5},
  "rationales":{"empathy":"...","clarity":"...","compliance":"...","discovery":"...","objection_handling":"...","confidence":"...","active_listening":"...","adaptability":"...","action_insight":"...","resilience":"..."},
  "tips":["Tip 1","Tip 2","Tip 3"],
  "rubric_version":"v2.0"
}</coach>
```

**Status:** ✅ Worker prompt correctly defines all 10 metrics with rationales

---

## Fixes Required

### Fix 1: Correct renderEiPanel Path
**File:** widget.js
**Line:** 362-397
**Issue:** Looking for `msg._coach.ei.scores` instead of `msg._coach.scores`
**Fix:** Remove `.ei` nested path

### Fix 2: Display All 10 Metrics in Yellow Panel
**File:** widget.js
**Line:** 385-392
**Issue:** Only showing 5 metrics (empathy, discovery, compliance, clarity, accuracy)
**Fix:** Add missing 5 metrics, remove invalid "accuracy"

### Fix 3: Update validateCoachSchema
**File:** worker.js
**Line:** 606-620
**Issue:** Wrong required fields for emotional-assessment and role-play
**Fix:**
```javascript
const requiredFields = {
  "sales-coach": ["scores", "worked", "improve", "feedback"],
  "emotional-assessment": ["scores"],  // Changed from ["ei"]
  "product-knowledge": [],
  "role-play": ["scores"]  // Added requirement
};
```

### Fix 4: Remove "accuracy" from UI
**File:** widget.js, assets/chat/config.json
**Issue:** "accuracy" is not a valid EI metric
**Fix:** Replace with correct metric or remove

---

## Corrected JSON Schemas

### Worker Response (Corrected)
```typescript
interface ChatResponse {
  reply: string;
  coach?: {
    scores: {
      empathy: 1 | 2 | 3 | 4 | 5;
      clarity: 1 | 2 | 3 | 4 | 5;
      compliance: 1 | 2 | 3 | 4 | 5;
      discovery: 1 | 2 | 3 | 4 | 5;
      objection_handling: 1 | 2 | 3 | 4 | 5;
      confidence: 1 | 2 | 3 | 4 | 5;
      active_listening: 1 | 2 | 3 | 4 | 5;
      adaptability: 1 | 2 | 3 | 4 | 5;
      action_insight: 1 | 2 | 3 | 4 | 5;
      resilience: 1 | 2 | 3 | 4 | 5;
    };
    rationales?: Record<string, string>;
    worked?: string[];
    improve?: string[];
    phrasing?: string;
    feedback?: string;
    context?: {
      rep_question: string;
      hcp_reply: string;
    };
    rubric_version?: string;
  };
  plan?: { id: string };
}
```

### UI Consumption (Corrected)
```javascript
// Correct path (no .ei nesting)
const scores = msg._coach?.scores || {};

// Display all 10 metrics
const metricOrder = [
  "empathy",
  "clarity",
  "compliance",
  "discovery",
  "objection_handling",
  "confidence",
  "active_listening",
  "adaptability",
  "action_insight",
  "resilience"
];
```

---

## Next Steps (PHASE 2)

1. ✅ Schema alignment complete
2. ⏭️ Fix widget.js renderEiPanel to use correct path
3. ⏭️ Display all 10 metrics in yellow panel
4. ⏭️ Fix worker.js validateCoachSchema
5. ⏭️ Test with live responses to verify alignment

---

**End of PHASE 1**
