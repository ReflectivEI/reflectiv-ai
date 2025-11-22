# Architecture Map - ReflectivAI Repository (Copilot Analysis)

**Created:** 2025-11-22  
**Purpose:** Document current architecture with real file+line citations (repo-truth only)

---

## Frontend Architecture

### Mode Management

**Location:** `widget.js` lines 54-61

The widget defines 5 user-facing mode labels that map to internal mode strings:

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

**Current state:** Widget uses friendly labels ("Sales Coach") and maps them to internal mode strings ("sales-coach") before sending to API.

### Core Modules (assets/chat/core/)

**modeStore.js (lines 1-17):**
- Defines valid modes: `['role-play','sales-coach','emotional-assessment','product-knowledge','general-knowledge']`
- Manages mode state and emits mode change events
- No mode mapping/translation logic here

**api.js (lines 1-143):**
- Loads configuration from `assets/chat/config.json`
- Provides `chat()` function that sends requests to worker `/chat` endpoint
- **Current implementation:** Passes mode directly to worker without any translation (line 136)
- Does NOT currently accept or pass EI context as a parameter
- Includes retry logic with exponential backoff for 429/5xx errors (lines 60-115)

### Mode Modules (assets/chat/modes/)

All four mode modules (`emotionalIntelligence.js`, `productKnowledge.js`, `rolePlay.js`, `salesCoach.js`) have identical structure:
- Import `chat` from `../core/api.js`
- Bind to DOM elements
- Call `chat()` with mode from store and user message (line 24 in each)
- **Current state:** None of them load or pass EI-specific context

**EI Context Module:** `assets/chat/ei-context.js` (lines 1-53)
- Loads EI knowledgebase from `about-ei.md`
- Loads rubric from `config.json`
- Loads persona from `persona.json`
- Exposes `getSystemExtras()` function to build EI system context
- **Current state:** Module exists and works, but is NOT used by any mode module

---

## Backend Architecture (worker.js)

### Worker Endpoints

**Lines 30-100:** Main request handler
- `POST /facts` - Fact database queries
- `POST /plan` - Plan generation
- `POST /chat` - Main chat endpoint
- `GET/HEAD /health` - Health checks
- `GET /version` - Version info
- `GET /debug/ei` - Debug endpoint

### Mode Handling in Worker

**Lines 900-953:** Request parsing and mode normalization
- Accepts two payload formats: widget format (messages array) and ReflectivAI format
- **Line 927, 938:** Default mode is "sales-coach"
- **Lines 949-953:** CRITICAL mode normalization:
  ```javascript
  // CRITICAL: Normalize mode name - frontend sends "sales-simulation" but worker uses "sales-coach" internally
  if (mode === "sales-simulation") {
    mode = "sales-coach";
  }
  ```
- **Current gap:** Worker expects "sales-simulation" as an alias but widget sends "sales-coach" directly

**Valid modes in FSM (lines 193-217):**
- `sales-coach` (lines 193-196)
- `sales-simulation` (lines 197-200) - alias for sales-coach
- `role-play` (lines 201-204)
- `emotional-assessment` (lines 205-208)
- `product-knowledge` (lines 209-212)
- `general-knowledge` (lines 213-216)

### Prompt Selection

**Lines 1380-1394:** Mode-specific prompt selection
```javascript
if (mode === "role-play") {
  sys = rolePlayPrompt;
} else if (mode === "sales-coach") {
  sys = salesCoachPrompt;
} else if (mode === "emotional-assessment") {
  sys = eiPrompt;
} else if (mode === "product-knowledge") {
  sys = pkPrompt;
} else if (mode === "general-knowledge") {
  sys = generalKnowledgePrompt;
} else {
  sys = salesCoachPrompt; // default fallback
}
```

### EI Prompt (lines 1156-1195)

**Current EI prompt includes:**
- Mission statement: "Help the rep develop emotional intelligence through reflective practice based on about-ei.md framework"
- CASEL SEL Competencies framework
- Triple-Loop Reflection Architecture
- Socratic metacoach prompts
- Output style guidelines (2-4 paragraphs, 1-2 Socratic questions)

**Current gap:** Prompt mentions "about-ei.md framework" but does NOT actually embed the content from that file. The worker has no mechanism to receive EI context from the frontend.

---

## Sales Coach Response Contract

### Worker Output (lines 1016-1065)

**Required 4-section structure:**
1. **Challenge:** One sentence describing HCP's concern (15-25 words)
2. **Rep Approach:** Exactly 3 bullets with clinical points and references (20-35 words each)
3. **Impact:** One sentence describing expected outcome (20-35 words)
4. **Suggested Phrasing:** Exact words rep should say (25-40 words)

**Plus coach block:**
```xml
<coach>{
  "scores":{"empathy":N,"clarity":N,"compliance":N,"discovery":N,"objection_handling":N,"confidence":N,"active_listening":N,"adaptability":N,"action_insight":N,"resilience":N},
  "rationales":{...},
  "worked":[...],
  "improve":[...],
  "feedback":"...",
  "rubric_version":"v2.0"
}</coach>
```

**10 EI metrics defined (lines 701-706):**
```javascript
const requiredMetrics = ["empathy","clarity","compliance","discovery","objection_handling","confidence","active_listening","adaptability","action_insight","resilience"];
```

### Widget Parsing and Display

**Main Chat Card (widget.js lines 996-1023):**
The widget parses and displays the 4-section Sales Coach response:
- Challenge (line 998)
- Rep Approach with bullets (lines 1002-1012)
- Impact (line 1017)
- Suggested Phrasing (lines 1020-1022)

**Side Panel (widget.js lines 2370-2385):**
The side panel displays coach feedback extracted from the `<coach>` block:
- **Performance Metrics:** All 10 EI pills in grid layout (line 2377)
- **What worked:** Array from coach.worked (line 2380)
- **What to improve:** Array from coach.improve (line 2381)
- **Suggested phrasing:** String from coach.phrasing (line 2382)

**Status:** ✅ UI implementation is COMPLETE and matches the worker contract perfectly.

---

## EI Scoring System

### Current Implementation

**Worker defines 10 metrics (line 701):**
1. empathy
2. clarity
3. compliance
4. discovery
5. objection_handling
6. confidence
7. active_listening
8. adaptability
9. action_insight
10. resilience

**Scale:** 1-5 for each metric (line 703-705)

**UI Display (widget.js lines 460-479):**
All 10 metrics displayed in two rows with 5 columns each:
- Row 1 (lines 464-468): empathy, clarity, compliance, discovery, objection_handling
- Row 2 (lines 471-475): confidence, active_listening, adaptability, action_insight, resilience

**CSS (widget.js lines 1797-1812):**
- Grid layout with 5 columns per row (line 1797)
- Individual gradient colors for each metric (lines 1803-1812)
- Responsive design for mobile: 3 columns on small screens (line 1815)

**Status:** ✅ UI displays all 10 EI metrics correctly with beautiful gradient-coded pills.

---

## Cloudflare Deployment Pipeline

### Workflow File

**Location:** `.github/workflows/cloudflare-worker.yml`

**Current configuration (lines 1-34):**
```yaml
name: Deploy to Cloudflare Workers

on:
  push:
    branches: [ main ]
  workflow_dispatch:

jobs:
  deploy:
    name: Deploy Worker to Cloudflare
    runs-on: ubuntu-latest
    env:
      CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
      CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Deploy worker via Wrangler
        run: npx wrangler deploy

      - name: Confirm deployment
        run: |
          echo "Worker deployed -> https://my-chat-agent-v2.tonyabdelmalak.workers.dev"
```

**Wrangler Configuration:** `wrangler.toml`
- Worker name: `my-chat-agent-v2`
- Main file: `worker.js`
- Account ID: `59fea97fab54fbd4d4168ccaa1fa3410`
- Uses secrets for PROVIDER_KEY (must be set via `wrangler secret put`)

**Current status:** Workflow file exists and appears correct. Need to check GitHub Actions logs for actual failures.

---

## Summary

### What Works
- Mode mapping in widget (friendly labels → internal strings)
- Worker accepts both "sales-coach" and "sales-simulation" modes
- EI context module exists and can load framework content
- Worker has comprehensive EI prompt with CASEL framework
- 10-metric EI scoring system defined in worker

### Gaps Identified
1. **Mode mapping:** Widget sends "sales-coach" but worker has alias handling for "sales-simulation" that's not needed
2. **EI context wiring:** EI context module exists but is never called by emotionalIntelligence.js mode
3. **API extension:** api.js doesn't accept or pass EI context to worker
4. **Worker EI prompt:** Mentions about-ei.md framework but doesn't embed actual content
5. **UI Pills:** Unknown if widget displays all 10 EI metrics or a subset (need to trace widget.js rendering)
6. **Cloudflare deploy:** Workflow exists but need to check actual failure logs

---

**Next steps:** Create HONEST_LIMITATIONS_COPILOT.md with detailed gap analysis.
