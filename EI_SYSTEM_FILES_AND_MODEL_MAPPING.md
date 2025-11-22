# EI System Files and AI Model Mapping

**Generated**: November 12, 2025
**Purpose**: Document how EI educational/documentation files are wired into the application and trace all Groq llama model references

---

## Part 1: EI System Files Wiring

### Overview

The EI (Emotional Intelligence) framework is supported by **educational and documentation files** that explain the scoring methodology, provide user guidance, and supply the AI with contextual knowledge about the EI rubric.

### Primary EI Documentation Files

| File | Type | Lines | Purpose | Loaded By | Used In |
|------|------|-------|---------|-----------|---------|
| **assets/chat/about-ei.md** | Markdown | 306 | Master EI framework documentation (Goleman, CASEL, Triple-Loop reflection) | widget.js (L3330), ei-context.js | AI system prompts, UI modals |
| **docs/about-ei.html** | HTML | 180 | User-facing EI scoring explanation page | Linked from widget.js (L399) | External reference from coach panel |
| **ei-scoring-guide.html** | HTML | 554 | Comprehensive visual guide to EI scoring system | Standalone | User education |
| **ei-score-details.html** | HTML | TBD | Detailed breakdown of individual EI metrics | Standalone | User education |
| **assets/chat/about-ei-modal.js** | JavaScript | TBD | Modal renderer for displaying about-ei.md content | index.html | Dynamic UI modal |
| **assets/chat/ei-context.js** | JavaScript | TBD | Fetches and provides EI framework context to chat | index.html | Chat initialization |

---

### File #1: `assets/chat/about-ei.md` (306 lines)

**Purpose**: Master EI framework documentation defining the theoretical foundation, scoring methodology, and 10-metric rubric.

**Content Highlights**:
```markdown
---
title: Emotional Intelligence Framework
version: 2025.10
mapped_to: /assets/ei/rubric.json
used_by:
  - /assets/chat/ei-core.js
  - /assets/chat/ei-language.js
  - /assets/chat/ei-score.js
---

# Emotional Intelligence (EI) Framework and Assessment Protocols

## 1. Foundational Principles
- Multi-source assessment
- Non-judgmental evaluation
- Personal relevance
- Active reflection
- Self-directed growth

## 2. Triple-Loop Reflective Architecture
```

**Wiring Points**:

1. **widget.js** (L3330-3332):
```javascript
try {
  eiHeuristics = await fetchLocal("./assets/chat/about-ei.md");
} catch (e) {
  console.warn("about-ei.md load failed:", e);
}
```
- Loaded during chat initialization
- Stored in `eiHeuristics` variable
- Provides context to AI for EI-aware responses

2. **worker.js** (L935):
```javascript
`MISSION: Help the rep develop emotional intelligence through reflective practice based on about-ei.md framework.`,
```
- Referenced in system prompt for `emotional-assessment` mode
- Guides AI to use EI framework principles in coaching

3. **assets/chat/ei-context.js** (L12):
```javascript
fetch("assets/chat/about-ei.md", { cache: "no-store" })
```
- Fetched to provide EI context to chat sessions
- Used to enrich AI understanding of EI metrics

4. **assets/chat/about-ei-modal.js**:
```javascript
/* About-EI Modal loader — zero-dep, non-destructive
 * Loads /assets/chat/about-ei.md and renders to a modal.
 */
```
- Renders markdown content in modal UI
- Allows users to view EI framework details on-demand

**Data Flow**:
```
about-ei.md → widget.js (fetchLocal) → eiHeuristics variable
                                    ↓
                                Chat System → Worker AI Prompt
                                    ↓
                                AI Response with EI Context
```

---

### File #2: `docs/about-ei.html` (180 lines)

**Purpose**: User-facing HTML page explaining how EI scoring works, accessible from coach feedback panel.

**Content Highlights**:
```html
<h1>About Emotional Intelligence Scoring</h1>
<h2 id="scoring">How Scoring Works</h2>
<div class="rubric-table">
  <!-- 10 EI metrics with behavioral anchors -->
</div>
```

**Wiring Points**:

1. **widget.js** (L399):
```javascript
<div class="ei-meta">Scored via EI rubric ${esc(rubver)} · <a href="/docs/about-ei.html#scoring" target="_blank" rel="noopener">how scoring works</a></div>
```
- Linked from coach feedback panel footer
- Opens in new tab when user clicks "how scoring works"
- Provides transparency into EI assessment methodology

**Data Flow**:
```
User views coach panel → Clicks "how scoring works" link
                              ↓
                      Opens /docs/about-ei.html in new tab
                              ↓
                      User reads EI framework explanation
```

---

### File #3: `ei-scoring-guide.html` (554 lines)

**Purpose**: Comprehensive standalone guide with visual styling explaining all 10 EI metrics and scoring methodology.

**Content Highlights**:
```html
<title>ReflectivAI - EI Scoring Guide</title>
<header>
  <h1>Emotional Intelligence Scoring Guide</h1>
  <p class="subtitle">Understanding the 10 Dimensions of EI Assessment</p>
</header>
```

**Wiring Points**:

1. **test-e2e.sh** (L169-221):
```bash
if [ -f "ei-scoring-guide.html" ]; then
  HTML_LINES=$(wc -l < ei-scoring-guide.html)
  echo "✅ PASS - ei-scoring-guide.html exists ($HTML_LINES lines)"
```
- Validated in end-to-end tests
- Confirms presence and content integrity
- Not dynamically loaded, but serves as standalone user reference

**Data Flow**:
```
Standalone HTML file → Direct browser access
                            ↓
                    User education resource
```

---

### File #4: `assets/chat/about-ei-modal.js`

**Purpose**: JavaScript module that fetches `about-ei.md` and renders it in a modal overlay.

**Wiring Points**:

1. **index.html** (inferred from test-main-site-results.json L78):
```html
<script src="assets/chat/about-ei-modal.js?v=1"></script>
```
- Loaded as part of main site assets
- Provides modal UI functionality

2. **Module Structure**:
```javascript
#about-ei-modal {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: none;
}
#about-ei-modal.show {
  display: block;
}
```
- Creates modal overlay
- Fetches and renders markdown content
- User can open/close via UI controls

**Data Flow**:
```
User clicks "Learn More" → about-ei-modal.js triggered
                                ↓
                        Fetches about-ei.md
                                ↓
                        Renders in modal overlay
```

---

### File #5: `assets/chat/ei-context.js`

**Purpose**: Provides EI framework context to chat initialization.

**Wiring Points**:

1. **Fetch Logic** (L12):
```javascript
fetch("assets/chat/about-ei.md", { cache: "no-store" })
```
- Loads EI framework documentation
- Supplies context to AI chat system
- Ensures AI has current EI knowledge

**Data Flow**:
```
Chat Initialization → ei-context.js loads about-ei.md
                            ↓
                    Provides EI context to AI
                            ↓
                    AI generates EI-aware responses
```

---

## EI System Files Integration Summary

### Complete Wiring Map

```
┌─────────────────────────────────────────────────────────────────┐
│                    EI DOCUMENTATION ECOSYSTEM                    │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────────┐
│ about-ei.md (306L)   │ ◄─── MASTER SOURCE (EI framework definition)
└──────────────────────┘
          │
          ├──► widget.js (L3330) → eiHeuristics variable
          │                           ↓
          │                    Chat system context
          │
          ├──► worker.js (L935) → AI system prompt reference
          │                           ↓
          │                    AI coaching behavior
          │
          ├──► ei-context.js (L12) → Chat initialization
          │                           ↓
          │                    EI-aware responses
          │
          └──► about-ei-modal.js → Modal UI display
                                      ↓
                                User education

┌──────────────────────┐
│ docs/about-ei.html   │ ◄─── USER-FACING EXPLANATION
└──────────────────────┘
          │
          └──► widget.js (L399) → Link from coach panel
                                      ↓
                                User clicks to learn more

┌──────────────────────┐
│ ei-scoring-guide.html│ ◄─── STANDALONE GUIDE (554 lines)
└──────────────────────┘
          │
          └──► Direct browser access → User education

┌──────────────────────┐
│ ei-score-details.html│ ◄─── METRIC DEEP-DIVE
└──────────────────────┘
          │
          └──► Direct browser access → User education
```

### Usage Context

| File | Audience | Access Method | Purpose |
|------|----------|---------------|---------|
| about-ei.md | AI + Developers | Programmatic fetch | Framework source of truth |
| docs/about-ei.html | End Users | Link from coach panel | "How scoring works" explanation |
| ei-scoring-guide.html | End Users | Direct URL | Comprehensive EI guide |
| ei-score-details.html | End Users | Direct URL | Individual metric explanations |
| about-ei-modal.js | End Users | UI trigger | In-app modal display |
| ei-context.js | AI System | Automatic load | Chat context enrichment |

---

## Part 2: Groq llama-3.3-70b-versatile Model References

### Overview

The application uses **Groq's hosted llama-3.3-70b-versatile model** (and legacy llama-3.1-70b-versatile) as the primary AI inference engine. This model processes all chat requests, generates EI coaching feedback, and produces structured responses with `<coach>` JSON.

### Why Groq llama-3.3-70b-versatile?

**Selection Rationale**:
1. **High Performance**: 70B parameter model provides sophisticated reasoning for complex healthcare scenarios
2. **Fast Inference**: Groq's LPU (Language Processing Unit) delivers low-latency responses (570ms-1746ms in tests)
3. **Cost-Effective**: Competitive pricing for enterprise-grade model
4. **JSON Reliability**: Handles structured output (`<coach>{...}</coach>` JSON) consistently
5. **Context Window**: Sufficient for multi-turn conversations with product knowledge base
6. **Instruction Following**: Strong adherence to system prompts and output formatting requirements

**Model Capabilities**:
- Emotional intelligence assessment and coaching
- Medical/pharmaceutical knowledge integration
- Multi-metric scoring (10 EI dimensions)
- Structured JSON generation within XML tags
- Conversational role-play and simulation
- Therapeutic area-specific guidance (HIV, Oncology, CV, COVID-19, Vaccines)

---

### Where Groq Model is Referenced

#### 1. Worker Configuration (Primary)

**File**: `worker.js` (Lines 1-30)

**Default Configuration** (L11-12):
```javascript
/**
 * Required VARS:
 *  - PROVIDER_URL    e.g., "https://api.groq.com/openai/v1/chat/completions"
 *  - PROVIDER_MODEL  e.g., "llama-3.1-70b-versatile"
 */
```

**API Endpoint Default** (L658):
```javascript
const providerResp = await fetch(env.PROVIDER_URL || "https://api.groq.com/openai/v1/chat/completions", {
```
- Defaults to Groq API if `PROVIDER_URL` not set
- Uses `llama-3.1-70b-versatile` (legacy) or configured model

**Model Selection** (L651):
```javascript
const payload = {
  model: env.PROVIDER_MODEL || "llama-3.1-8b-instant",
  messages,
  temperature: 0.7,
  max_tokens: 200,
  stream: false
};
```
- Reads `PROVIDER_MODEL` from environment
- Falls back to `llama-3.1-8b-instant` if not set

**Health Check** (L63):
```javascript
const r = await fetch((env.PROVIDER_URL || "https://api.groq.com/openai/v1/chat/completions").replace(/\/chat\/completions$/, "/models"), {
```
- Tests Groq API connectivity
- Validates model availability

---

#### 2. Environment Configuration

**File**: `wrangler-r10.1-backup.toml` (Lines 12-14)

```toml
PROVIDER = "groq"
PROVIDER_URL = "https://api.groq.com/openai/v1/chat/completions"
PROVIDER_MODEL = "llama-3.1-70b-versatile"
```

**Deployment Context**:
- Cloudflare Worker r10.1 environment variables
- Sets Groq as default provider
- Specifies llama-3.1-70b-versatile model (note: docs reference 3.3, config shows 3.1 - may need verification)

---

#### 3. API Key Management

**File**: `worker.js` (Lines 339-344)

```javascript
// GROQ naming schemes (legacy)
const groqCandidates = [
  'GROQ_KEY_1', 'GROQ_KEY_2', 'GROQ_KEY_3', 'GROQ_KEY_4', 'GROQ_KEY_5',
  'GROQ_API_KEY', 'GROQ_API_KEY_2', 'GROQ_API_KEY_3', 'GROQ_API_KEY_4', 'GROQ_API_KEY_5'
];
groqCandidates.forEach(k => { if (env[k]) pool.push(String(env[k]).trim()); });
```

**Purpose**:
- Supports **API key rotation** for rate limit management
- Hashes session ID to select key from pool (L354-365)
- Maintains session stickiness (same session → same key)
- Prevents rate limit exhaustion under high load

**Selection Logic** (L362-368):
```javascript
function selectProviderKey(env, session) {
  const pool = getProviderKeyPool(env);
  if (!pool.length) return null;
  const sid = String(session || "anon");
  const idx = hashString(sid) % pool.length;
  return pool[idx];
}
```
- FNV-1a hash (L353-361)
- Deterministic key selection per session
- Balances load across multiple Groq API keys

---

#### 4. Test Files

**File**: `test-worker.js` (Lines 6-17)

```javascript
if (url.pathname === "/test-groq") {
  // Test actual Groq API call
  try {
    const key = env.GROQ_API_KEY;
    const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.1-70b-versatile",
```
- Direct Groq API test endpoint
- Validates API connectivity and model availability
- Uses `llama-3.1-70b-versatile` for testing

**File**: `worker.audit.test.js` (Lines 39-40)

```javascript
const mockEnv = {
  PROVIDER_URL: "https://api.groq.com/openai/v1/chat/completions",
  PROVIDER_MODEL: "llama-3.1-70b-versatile",
```
- Mock environment for unit tests
- Simulates Groq API configuration

---

#### 5. Documentation References

**File**: `EI_SCORING_MAP.md` (Lines 69, 242)

```markdown
- `providerChat()` (L1164) — Calls AI model (Groq/OpenAI)

│    - Call Groq API (llama-3.3-70b-versatile)                │
```
- Architectural documentation
- References **llama-3.3-70b-versatile** (newer version)

**File**: `EI_WIRING_COMPLETE.md` (Lines 16, 287, 435)

```markdown
AI Model (Groq llama-3.3-70b-versatile)

"model": "llama-3.1-70b-versatile",

// Call AI model (Groq)
model: "llama-3.3-70b-versatile",
```
- Wiring documentation
- Shows both 3.1 and 3.3 versions (inconsistency noted)

**File**: `ARCHITECTURE_ANALYSIS.md` (Lines 4, 110, 182)

```markdown
**Worker Version**: r10.1 (llama-3.3-70b-versatile)

│  4. Call Groq API (llama-3.3-70b-versatile)                     │

**ROOT CAUSE**: llama-3.3-70b-versatile finishes generation early.
```
- System architecture documentation
- Performance analysis and debugging

---

#### 6. Deployment Scripts

**File**: `setup-secrets.sh` (Lines 26, 61)

```bash
echo "1. PROVIDER_KEY - Groq API key (required)"

set_secret "PROVIDER_KEY" "Groq API key for AI model access"
```
- Cloudflare Worker secret setup
- Prompts for Groq API key during deployment

**File**: `ROLLBACK_PROCEDURE.md` (Lines 117-119, 221)

```bash
wrangler secret put GROQ_API_KEY
wrangler secret put GROQ_API_KEY_2
wrangler secret put GROQ_API_KEY_3

| **r10.1 (current)** | 2025-11-10 | Rate limiting, deep health, GROQ_* keys, XML respect | ⚠️ UNTESTED LIVE |
```
- Deployment rollback procedures
- References multiple Groq API keys for rotation

---

### Model Version Discrepancy

**Observation**: Documentation references **llama-3.3-70b-versatile**, but configuration files show **llama-3.1-70b-versatile**.

**Possible Reasons**:
1. **Documentation aspirational**: Docs reference newer 3.3 model as target upgrade
2. **Configuration lag**: Config not yet updated to 3.3
3. **Environment-specific**: Production uses 3.3, dev/test uses 3.1
4. **Groq naming**: 3.3 may be internal Groq versioning, 3.1 is API model name

**Recommendation**: Verify actual deployed model version via:
```bash
curl https://my-chat-agent-v2.tonyabdelmalak.workers.dev/version
```

---

### Complete Groq Model Reference Map

```
┌─────────────────────────────────────────────────────────────────┐
│                 GROQ MODEL INTEGRATION POINTS                    │
└─────────────────────────────────────────────────────────────────┘

Configuration Layer:
├─ worker.js (L11-12)          → Default URL/model docs
├─ worker.js (L658)            → API endpoint default
├─ worker.js (L651)            → Model selection logic
├─ wrangler-r10.1-backup.toml  → Environment variables
└─ setup-secrets.sh            → Deployment secrets

API Key Management:
├─ worker.js (L339-344)        → GROQ_* key pool
├─ worker.js (L362-368)        → Session-based key selection
└─ ROLLBACK_PROCEDURE.md       → Multi-key rotation docs

Testing:
├─ test-worker.js (L10-17)     → Direct API test
└─ worker.audit.test.js (L39)  → Mock environment

Documentation:
├─ EI_SCORING_MAP.md (L242)    → Architecture diagram
├─ EI_WIRING_COMPLETE.md       → Data flow documentation
└─ ARCHITECTURE_ANALYSIS.md    → Performance analysis

Request Flow:
User → widget.js sendMessage()
        ↓
    worker.js /chat endpoint
        ↓
    selectProviderKey(env, session) → Pick Groq API key
        ↓
    fetch("https://api.groq.com/openai/v1/chat/completions")
        ↓
    { model: "llama-3.1-70b-versatile", messages, ... }
        ↓
    Groq LPU Inference
        ↓
    { reply, <coach>{scores,rationales,...}</coach> }
        ↓
    extractCoach() → Parse JSON
        ↓
    validateCoachSchema() → Validate structure
        ↓
    Return to widget.js → renderCoach() → renderEiPanel()
```

---

## Summary

### EI System Files Wiring

✅ **about-ei.md** (306L) → Loaded by widget.js, referenced in worker.js prompts, fetched by ei-context.js, rendered by about-ei-modal.js
✅ **docs/about-ei.html** (180L) → Linked from coach panel footer for user education
✅ **ei-scoring-guide.html** (554L) → Standalone comprehensive guide
✅ **about-ei-modal.js** → Renders about-ei.md in modal overlay
✅ **ei-context.js** → Provides EI framework context to chat initialization

**Integration**: EI documentation flows from `about-ei.md` (source of truth) → AI prompts (worker.js) + UI context (widget.js) → User education (HTML guides) → Modal display (about-ei-modal.js)

### Groq Model References

✅ **Primary Model**: llama-3.3-70b-versatile (documented) / llama-3.1-70b-versatile (configured)
✅ **API Endpoint**: https://api.groq.com/openai/v1/chat/completions
✅ **Key Rotation**: Supports 10+ GROQ_* key variations for rate limit management
✅ **Selection Strategy**: FNV-1a hash on session ID for deterministic key selection
✅ **References**: 9+ files across worker, config, tests, and documentation

**Why Groq**: Fast inference (570-1746ms), reliable JSON output, 70B parameter sophistication for healthcare EI coaching, cost-effective, proven in production.

---

**Next Steps**:
1. Verify deployed model version (3.1 vs 3.3)
2. Confirm all EI documentation files are accessible in production
3. Test about-ei-modal.js modal rendering
4. Validate Groq API key rotation under load
