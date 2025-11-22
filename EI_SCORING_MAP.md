# PHASE 0 — EI Scoring Architecture Map

**Generated:** 2025-11-12
**Purpose:** Complete file inventory for EI scoring system debug and documentation

---

## File Categories & Roles

### (A) UI RENDERING — Coach Feedback Display

| File | Purpose | Key Exports/Functions | Lines |
|------|---------|----------------------|-------|
| **widget.js** | Main UI renderer, chat interface, coach panel display | `renderCoachMessage()`, `renderEiPanel()`, `extractCoach()`, `scoreReply()` | 3370 |
| **assets/chat/coach.js** | Legacy coach UI component (modular, standalone) | `buildShell()`, mode switching, scenario selection | 656 |
| **assets/chat/about-ei-modal.js** | EI documentation modal display | Modal renderer for EI framework docs | TBD |
| **index.html** | Main page structure, coach modal container | DOM mounts: `#coachModal`, `#reflectiv-widget` | 1730 |

**Key UI Functions:**
- `renderCoachMessage()` (widget.js:1010) — Renders coach feedback card in thread
- `renderEiPanel()` (widget.js:362) — Yellow EI summary panel with 5 metrics
- `renderCoach()` (widget.js:1898) — Full coach panel renderer
- `extractCoach()` (widget.js:1092) — Parses `<coach>{...}</coach>` from AI responses

---

### (B) EI FRAMEWORK & MAPPING — Definitions, Rubric, Dimension Keys

| File | Purpose | Key Content | Status |
|------|---------|-------------|--------|
| **assets/chat/about-ei.md** | EI framework documentation (Goleman, CASEL, Triple-Loop) | Defines 10 EI dimensions, rubric philosophy, behavioral anchors | ✅ 306 lines |
| **assets/chat/config.json** | Coach configuration, mode definitions, API endpoints | `eiFeatures` array, mode list, analytics endpoint | ✅ 26 lines |
| **assets/chat/ei-context.js** | Loads EI knowledgebase and builds system context for AI | `EIContext.load()`, `getSystemExtras()` | ✅ 50 lines |
| **assets/chat/persona.json** | HCP persona definitions (if exists) | Persona behavior rails | ⚠️ Referenced but not read yet |

**10 EI Metrics (Canonical Order):**
```javascript
// From worker.js lines 850-851 and about-ei.md
1. empathy           // Acknowledging HCP perspective, validating concerns
2. clarity           // Concise messaging without jargon
3. compliance        // On-label adherence, ethical boundaries
4. discovery         // Open-ended questioning, curiosity
5. objection_handling // Addressing concerns, barriers, resistance
6. confidence        // Tone, composure, professional presence
7. active_listening  // Acknowledging, reflecting back, pausing
8. adaptability      // Adjusting to HCP style, time pressure
9. action_insight    // Next steps, practical takeaways
10. resilience       // Recovery from objections, stress management
```

**Current UI Display (5 metrics only):**
```javascript
// widget.js:385-392 (renderEiPanel)
empathy, discovery, compliance, clarity, accuracy
```

⚠️ **MISMATCH DETECTED:** UI displays 5 metrics, Worker returns 10 metrics

---

### (C) WORKER LOGIC — Prompting, Scoring, Response Generation

| File | Purpose | Key Sections | Lines |
|------|---------|--------------|-------|
| **worker.js** | Cloudflare Worker — all backend logic | Prompts (L770-1150), scoring (L1330-1345), response formatting (L1200-1450) | 1511 |

**Key Worker Functions:**
- `postChat()` (L677) — Main chat endpoint handler
- `providerChat()` (L1164) — Calls AI model (Groq/OpenAI)
- `extractCoach()` (L488) — Server-side coach JSON extraction
- `validateModeResponse()` (L543) — Mode-specific validation
- `validateCoachSchema()` (L606) — JSON schema validation
- `deterministicScore()` (L459) — Fallback scoring when AI fails

**Prompts with EI Scoring:**
- **Sales Coach** (L807-856): Returns `<coach>{scores, rationales, tips, rubric_version}</coach>`
- **Common Contract** (L858-868): Returns coach JSON with 10 scores
- **EI Mode** (L932-971): Socratic metacoach, no structured scores (text-based)
- **Product Knowledge** (L973-1045): No coach scores, citations only
- **General Knowledge** (L1047-1150): No coach scores

**Deterministic Fallback (L1330-1345):**
```javascript
scores: {
  empathy: 3,
  clarity: 4,
  compliance: 4,
  discovery: /[?]\s*$/.test(reply) ? 4 : 3,
  objection_handling: 3,
  confidence: 4,
  active_listening: 3,
  adaptability: 3,
  action_insight: 3,
  resilience: 3
}
```

---

### (D) DATA SOURCES — Scenarios, Personas, HCP Profiles

| File | Purpose | Content Type | Status |
|------|---------|--------------|--------|
| **assets/chat/data/scenarios.merged.json** | Disease states, HCP profiles, simulation scenarios | Merged scenario database | ✅ Referenced |
| **assets/chat/persona.json** | HCP persona definitions | JSON persona objects | ⚠️ Not yet inspected |
| **config.json** (root) | Plan generation config (not used for EI scoring) | Disease states, facts mapping | ✅ Exists |

---

### (E) TRANSPORT — Request/Response Models

**Chat Request (Frontend → Worker):**
```typescript
{
  mode: "sales-coach" | "role-play" | "emotional-assessment" | "product-knowledge" | "general-knowledge",
  messages: Array<{role: "user"|"assistant", content: string}>,
  session: string,
  planId?: string,
  disease?: string,
  persona?: string,
  goal?: string
}
```

**Chat Response (Worker → Frontend):**
```typescript
{
  reply: string,           // Main AI response text
  coach?: {                // EI scores and feedback
    scores: {              // 10 metrics, each 1-5
      empathy: number,
      clarity: number,
      compliance: number,
      discovery: number,
      objection_handling: number,
      confidence: number,
      active_listening: number,
      adaptability: number,
      action_insight: number,
      resilience: number
    },
    rationales?: {         // Optional explanations per metric
      empathy: string,
      // ... (same keys as scores)
    },
    worked?: string[],     // What worked well
    improve?: string[],    // What to improve
    phrasing?: string,     // Suggested phrasing
    feedback?: string,     // Overall feedback text
    context?: {            // Conversation context
      rep_question: string,
      hcp_reply: string
    },
    rubric_version?: string  // e.g., "v2.0"
  },
  plan?: {
    id: string
  }
}
```

---

### (F) MODE-SPECIFIC BEHAVIOR

| Mode | Returns Coach Scores? | Metrics Displayed | Special Handling |
|------|-----------------------|-------------------|------------------|
| **sales-coach** | ✅ Yes (10 metrics) | Should show all 10 | 4-section format (Challenge/Rep Approach/Impact/Phrasing) |
| **role-play** | ✅ Yes (10 metrics) | Should show all 10 | HCP voice, no coach meta-commentary |
| **emotional-assessment** | ⚠️ Text-based only | None (narrative feedback) | Socratic questions, Triple-Loop reflection |
| **product-knowledge** | ❌ No | None | Citations/references only |
| **general-knowledge** | ❌ No | None | General assistant mode |

---

## CRITICAL FINDINGS — Issues to Fix

### 1. **UI/Worker Metric Mismatch**
- **Worker** returns 10 metrics: `empathy, clarity, compliance, discovery, objection_handling, confidence, active_listening, adaptability, action_insight, resilience`
- **UI** displays only 5 metrics: `empathy, discovery, compliance, clarity, accuracy`
- **Missing from UI**: `objection_handling, confidence, active_listening, adaptability, action_insight, resilience`
- **"accuracy" not in Worker schema** — UI references a metric that doesn't exist in Worker response

**Location:**
- Widget.js L385-392 (`renderEiPanel`)
- Worker.js L850-851, L863, L1337 (score keys)

### 2. **"Sales Simulation" → "Sales Coach" Rename Incomplete**
Found remaining references to "Sales Simulation":
- `assets/chat/coach.js:334` — "Sales Simulation: Practice your call preparation..."
- Test/documentation files contain old name

**Action Required:** Grep and replace all remaining instances

### 3. **Coach Feedback Formatting Issues**
- Multiple parsers: `extractCoach()` in both widget.js and worker.js
- Labeled text format vs JSON format handling inconsistent
- Truncation tolerance varies between parsers

### 4. **EI Framework Documentation Not Fully Wired**
- `about-ei.md` defines comprehensive framework
- Worker prompts don't explicitly reference all 10 dimensions
- No programmatic loading of EI definitions into prompts (relies on hardcoded text)

---

## Data Flow — Worker → UI

```
┌─────────────────────────────────────────────────────────────┐
│ 1. USER INPUT (widget.js)                                   │
│    - Type message                                            │
│    - Select mode, disease, persona                           │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. REQUEST BUILDER (widget.js:jfetch)                       │
│    - Build {mode, messages, session, planId, disease}       │
│    - POST to Worker /chat endpoint                          │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. WORKER ROUTER (worker.js:postChat L677)                  │
│    - Validate request                                        │
│    - Load active plan (facts, persona, goal)                │
│    - Select mode-specific prompt                            │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. PROMPT BUILDER (worker.js L770-1150)                     │
│    - Sales Coach: Include EI rubric instructions            │
│    - Build system + user messages                           │
│    - Add Facts context (citations)                          │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. AI MODEL CALL (worker.js:providerChat L1164)             │
│    - Call Groq API (llama-3.3-70b-versatile)                │
│    - Parse response with retry logic                        │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. RESPONSE PARSING (worker.js L1208-1345)                  │
│    - extractCoach() → parse <coach>{...}</coach>            │
│    - Deterministic fallback if coach missing/invalid        │
│    - Validate schema (validateCoachSchema)                  │
│    - Clamp scores to 1-5 range                              │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│ 7. RESPONSE FORMATTING (worker.js L1407-1420)               │
│    - Add section spacing (Sales Coach)                      │
│    - Append references (Product Knowledge)                  │
│    - Return JSON {reply, coach, plan}                       │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│ 8. UI RENDERING (widget.js)                                 │
│    - extractCoach() again (client-side)                     │
│    - renderEiPanel() → Display 5 metrics ⚠️ MISMATCH       │
│    - renderCoachMessage() → Display feedback sections       │
└─────────────────────────────────────────────────────────────┘
```

---

## File Line References — Quick Navigation

### Worker.js (1511 lines)
- L115-192: `FACTS_DB` — All therapeutic area facts with citations
- L194-250: `FSM` — Finite state machine per mode
- L252-280: `PLAN_SCHEMA`, `COACH_SCHEMA` — JSON schemas
- L459-517: `deterministicScore()` — Fallback scoring logic
- L488-541: `extractCoach()` — Server-side coach JSON parser
- L543-595: `validateModeResponse()` — Mode validation rules
- L606-647: `validateCoachSchema()` — Schema validator
- L677-1511: `postChat()` — Main chat endpoint
- L770-856: Sales Coach prompt with EI rubric
- L858-868: Common contract prompt
- L932-971: EI mode prompt (Socratic, no scores)
- L973-1045: Product Knowledge prompt
- L1330-1345: Deterministic fallback scores (10 metrics)

### Widget.js (3370 lines)
- L53-62: Mode mappings (LC_OPTIONS → backend modes)
- L159-162: EI features (only 2 defined: empathy, stress)
- L362-397: `renderEiPanel()` — Yellow EI summary (5 metrics)
- L1010-1022: `renderCoachMessage()` — Inject coach card
- L1092-1162: `extractCoach()` — Client-side parser
- L1163-1235: `scoreReply()` — Local deterministic scoring
- L1898-2200: `renderCoach()` — Full coach panel renderer

### Assets/chat/about-ei.md (306 lines)
- L1-40: Framework introduction, principles
- L42-91: Triple-Loop Reflective Architecture
- L93-150: EI Domains (Self-Awareness, Self-Regulation, Empathy, Clarity, etc.)
- L152-220: SEL Mapping (CASEL competencies)
- L222-306: Assessment protocols, rubric design

---

## Next Steps (PHASE 1-8)

**PHASE 1:** Contract audit — validate JSON schema alignment Worker↔UI
**PHASE 2:** Worker scoring engine — deterministic logic, rubric wiring
**PHASE 3:** UI rendering fixes — display all 10 metrics correctly
**PHASE 4:** Complete wiring documentation across ~7-10 files
**PHASE 5:** Test matrix — all modes × diseases × passes
**PHASE 6:** Sales Coach rename verification
**PHASE 7:** Regression guards — unit tests
**PHASE 8:** Final deliverables & acceptance

---

**End of PHASE 0**
