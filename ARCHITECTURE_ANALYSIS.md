# ReflectivAI Architecture Analysis & Recommendations

**Generated**: 2025-11-10  
**Worker Version**: r10.1 (llama-3.3-70b-versatile)  
**Purpose**: Comprehensive audit per mega-prompt requirements

---

## 📋 Executive Summary

### Current State
✅ **STRENGTHS:**
- 4 modes implemented: sales-simulation, role-play, emotional-assessment, product-knowledge
- Comprehensive debug configuration created (`.vscode/launch.json`, `.vscode/settings.json`)
- Mode-specific prompts with clear role definitions
- CORS properly configured for all production domains
- Deterministic scoring system with 6 metrics
- Proper request/response flow: Frontend → Worker → Groq → Worker → Frontend

⚠️ **AREAS REQUIRING HARDENING:**
1. **Sales-simulation format**: Missing "Suggested Phrasing:" section (model cuts off)
2. **Mode drift protection**: Need server-side validation to strip coaching from role-play
3. **Schema validation**: No explicit response format validator before sending to frontend
4. **Persona lock**: Not explicitly enforced in system prompts
5. **_coach structure**: Inconsistent field names across modes

---

## 🏗️ Architecture Map

### 1. File Inventory

| **Category** | **File** | **Size** | **Purpose** |
|--------------|----------|----------|-------------|
| **Worker** | `worker.js` | 32K | Main Cloudflare Worker (r10.1) |
| **Worker Backup** | `worker-r9.js` | 28K | Session-based variant (r9) |
| **Frontend** | `index.html` | 66K | Landing page + coach modal container |
| **Frontend** | `widget.js` | 99K | Chat UI, mode handling, rendering |
| **Frontend** | `coach.js` | N/A | Modular self-contained UI (alternative) |
| **Config** | `config.json` | 1.1K | Frontend configuration |
| **Config** | `wrangler.toml` | 2.7K | Worker deployment config |
| **Docs** | `system.md` | N/A | System instructions (production) |
| **Docs** | `about-ei.md` | N/A | EI framework (triple-loop reflection) |
| **Docs** | `persona.json` | N/A | HCP persona definitions |
| **Data** | `scenarios.merged.json` | N/A | Scenario library |

---

### 2. Worker Endpoints

| **Endpoint** | **Method** | **Purpose** | **Status** |
|--------------|------------|-------------|------------|
| `/health` | GET, HEAD | Health check | ✅ Working |
| `/version` | GET | Version info (r10.1) | ✅ Working |
| `/debug/ei` | GET | Debug endpoint | ✅ Working |
| `/facts` | POST | Retrieve facts from FACTS_DB | ✅ Working |
| `/plan` | POST | Generate conversation plan | ✅ Working |
| `/chat` | POST | Main chat endpoint (all 4 modes) | ⚠️ Needs hardening |
| `/coach-metrics` | POST | Analytics/telemetry | ✅ Working |

---

### 3. Frontend → Worker Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                      FRONTEND (widget.js)                       │
├─────────────────────────────────────────────────────────────────┤
│  1. User selects mode from dropdown:                            │
│     - "Sales Simulation" → "sales-simulation"                   │
│     - "Role Play" → "role-play"                                 │
│     - "Emotional Intelligence" → "emotional-assessment"         │
│     - "Product Knowledge" → "product-knowledge"                 │
│                                                                  │
│  2. LC_TO_INTERNAL mapping (line 54):                           │
│     const LC_TO_INTERNAL = {                                    │
│       "Sales Simulation": "sales-simulation",                   │
│       "Role Play": "role-play",                                 │
│       "Emotional Intelligence": "emotional-assessment",         │
│       "Product Knowledge": "product-knowledge"                  │
│     }                                                            │
│                                                                  │
│  3. Build payload (line 1914):                                  │
│     {                                                            │
│       mode: currentMode,                                        │
│       user: lastUserMsg.content,                                │
│       history: [...previousMessages],                           │
│       disease: scenarioContext.diseaseState,                    │
│       persona: scenarioContext.hcpRole,                         │
│       goal: scenarioContext.goal,                               │
│       session: "widget-<randomId>"                              │
│     }                                                            │
│                                                                  │
│  4. POST to WORKER_URL/chat                                     │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    WORKER (worker.js /chat)                     │
├─────────────────────────────────────────────────────────────────┤
│  1. Extract mode, user, disease, persona, goal                  │
│                                                                  │
│  2. Generate /plan (retrieve FACTS_DB entries)                  │
│                                                                  │
│  3. Select mode-specific prompt:                                │
│     - sales-simulation → salesSimPrompt                         │
│     - role-play → rolePlayPrompt                                │
│     - emotional-assessment → eiPrompt                           │
│     - product-knowledge → pkPrompt                              │
│                                                                  │
│  4. Call Groq API (llama-3.3-70b-versatile)                     │
│     - Token limits per mode:                                    │
│       * sales-simulation: 1600                                  │
│       * role-play: 1200                                         │
│       * emotional-assessment: 800                               │
│       * product-knowledge: 700                                  │
│                                                                  │
│  5. Post-process response:                                      │
│     - Extract <coach>{...}</coach> JSON                         │
│     - Strip bullets from role-play                              │
│     - Normalize headings for sales-simulation                   │
│                                                                  │
│  6. Return JSON:                                                │
│     {                                                            │
│       reply: "...",                                             │
│       coach: { scores: {...}, worked: [...], ... },             │
│       plan: { id: "..." }                                       │
│     }                                                            │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                   FRONTEND (widget.js render)                   │
├─────────────────────────────────────────────────────────────────┤
│  MODE-SPECIFIC RENDERING:                                       │
│                                                                  │
│  sales-simulation (line 1500, 1554):                            │
│    - Speaker chip: "Sales Coach"                                │
│    - Parse reply for: Challenge, Rep Approach, Impact,          │
│      Suggested Phrasing                                         │
│    - Render yellow coach card with sections                     │
│    - Show deterministic scores in coach panel                   │
│                                                                  │
│  role-play (line 1494, 1534):                                   │
│    - Speaker chip: "HCP" or "Rep"                               │
│    - Render as natural dialogue bubbles                         │
│    - NO coach panel (hidden until final eval)                   │
│    - Bullets allowed for clinical context                       │
│                                                                  │
│  emotional-assessment (line 1683):                              │
│    - Speaker chip: "Coach"                                      │
│    - Render EI guidance with Socratic questions                 │
│    - Show EI scoring panel if _coach.ei exists                  │
│                                                                  │
│  product-knowledge (line 1632, 1699):                           │
│    - Speaker chip: "Coach"                                      │
│    - Render Answer + References format                          │
│    - Simple compliance chip (no full coach panel)               │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🎯 Mode Specifications (Expected vs Actual)

### **1. sales-simulation**

| **Aspect** | **Expected** | **Actual** | **Status** |
|------------|--------------|------------|------------|
| **AI Role** | Sales Coach | Sales Coach | ✅ Correct |
| **User Role** | Rep | Rep | ✅ Correct |
| **Output Format** | Challenge → Rep Approach (bullets) → Impact → Suggested Phrasing | Challenge → Rep Approach → Impact → ❌ **Missing Suggested Phrasing** | ⚠️ 75% correct |
| **_coach Schema** | `{scores, worked, improve, phrasing, feedback, context}` | `{scores, worked, improve, phrasing, feedback, context}` | ✅ Correct |
| **Coaching in Response** | Required | Present | ✅ Correct |
| **HCP Voice** | NEVER | None detected | ✅ Correct |
| **Citations** | Required ([HIV-PREP-XXX]) | Present | ✅ Correct |

**ISSUE**: Model consistently cuts off after "Impact:" section, never reaching "Suggested Phrasing:". Attempted fixes:
- Increased tokens from 1400 → 1600
- Added few-shot examples
- Mode-specific contract
- Explicit MANDATORY instructions

**ROOT CAUSE**: llama-3.3-70b-versatile finishes generation early. May need:
- Post-processing fallback to add deterministic phrasing
- Different stop sequences
- Alternative model temperature/top_p tuning

---

### **2. role-play**

| **Aspect** | **Expected** | **Actual** | **Status** |
|------------|--------------|------------|------------|
| **AI Role** | HCP ONLY (e.g., "Dr. Lopez") | HCP | ✅ Correct |
| **User Role** | Rep | Rep | ✅ Correct |
| **Output Format** | Natural HCP dialogue, 1-4 sentences | Natural dialogue | ✅ Correct |
| **_coach Schema** | NONE (no coaching in messages) | None in responses | ✅ Correct |
| **Coaching Leak** | NEVER | Not detected in tests | ✅ Correct |
| **Bullets** | Allowed for clinical lists | Allowed, natural | ✅ Correct |
| **Meta-commentary** | NEVER ("You should...", "The rep...") | None detected | ✅ Correct |

**STATUS**: ✅ **WORKING PERFECTLY**

---

### **3. emotional-assessment**

| **Aspect** | **Expected** | **Actual** | **Status** |
|------------|--------------|------------|------------|
| **AI Role** | EI Coach / Metacoach | EI Coach | ✅ Correct |
| **User Role** | Rep | Rep | ✅ Correct |
| **Output Format** | EI guidance with Socratic questions | 2-4 paragraphs + questions | ✅ Correct |
| **_coach.ei Schema** | `{scores: {empathy, discovery, compliance, clarity, accuracy}, rationales, tips, rubric_version}` | Present | ✅ Correct |
| **Socratic Questions** | Required (1-2 per response) | Present (2+ found in tests) | ✅ Correct |
| **Triple-Loop Framework** | Referenced when relevant | Referenced | ✅ Correct |

**STATUS**: ✅ **WORKING CORRECTLY**

---

### **4. product-knowledge**

| **Aspect** | **Expected** | **Actual** | **Status** |
|------------|--------------|------------|------------|
| **AI Role** | Scientific Answer Bot | Answer Bot | ✅ Correct |
| **User Role** | Rep asking content questions | Rep | ✅ Correct |
| **Output Format** | Answer (with citations) → References section | Answer + References | ✅ Correct |
| **Citations** | Inline [1], [2] or [HIV-PREP-XXX] | Present | ✅ Correct |
| **Off-label Claims** | NEVER | Compliance enforced | ✅ Correct |
| **Patient Advice** | NEVER | Not detected | ✅ Correct |

**STATUS**: ✅ **WORKING CORRECTLY**

---

## 🛡️ Guardrails Analysis

### Current Guardrails

| **Guardrail** | **Implementation** | **Effectiveness** | **Recommendation** |
|---------------|-------------------|-------------------|---------------------|
| **Compliance** | Prompt instructions "NO off-label" | ⚠️ Prompt-based only | Add server-side keyword filter |
| **Mode Drift** | Mode-specific prompts | ⚠️ No validation | Add response validator |
| **Persona Lock** | HCP persona in prompt | ⚠️ Not enforced | Add system-level check |
| **Role Isolation** | Separate prompts per mode | ✅ Working | Maintain |
| **Format Validation** | extractCoach() function | ✅ Working | Enhance with schema validation |
| **CORS** | Configured in wrangler.toml | ✅ Working | Maintain |

### Recommended Additions

1. **Response Validator** (server-side):
```javascript
function validateModeResponse(mode, reply, coach) {
  const violations = [];
  
  // Role-play: NO coaching language
  if (mode === "role-play") {
    if (/challenge:|rep approach:|coach guidance:|suggested phrasing:/i.test(reply)) {
      violations.push("coaching_leak");
      // Strip coaching sections
      reply = reply.replace(/(?:challenge:|rep approach:|impact:|suggested phrasing:)[\s\S]*$/gi, '');
    }
  }
  
  // Sales-simulation: NO HCP voice
  if (mode === "sales-simulation") {
    if (/^(I'm|I think|From my perspective|We evaluate)/i.test(reply)) {
      violations.push("hcp_voice_leak");
    }
  }
  
  // Product-knowledge: Check compliance
  if (mode === "product-knowledge") {
    const offLabelKeywords = /off-label|unapproved|not indicated for/i;
    if (offLabelKeywords.test(reply) && !/explicitly state|not recommended/i.test(reply)) {
      violations.push("potential_off_label");
    }
  }
  
  return { violations, cleanedReply: reply };
}
```

2. **Persona Lock Enforcement**:
```javascript
// In rolePlayPrompt, add explicit validation
const personaLock = `
CRITICAL: You are ${persona || "the HCP"}. 
EVERY response MUST be in first person as this specific HCP.
NEVER break character to provide coaching.
If asked to evaluate or coach, respond as the HCP would: 
"I'm here to discuss clinical matters, not provide sales coaching."
`;
```

3. **Schema Validator**:
```javascript
function validateCoachSchema(coach, mode) {
  const required = {
    "sales-simulation": ["scores", "worked", "improve", "feedback"],
    "emotional-assessment": ["ei"],
    "product-knowledge": [],
    "role-play": [] // Should be empty
  };
  
  const missing = required[mode]?.filter(key => !(key in coach)) || [];
  return { valid: missing.length === 0, missing };
}
```

---

## 🔗 Wiring Verification

### Frontend → Worker Payload

**Location**: `widget.js` line 1914  
**Structure**:
```javascript
{
  mode: "sales-simulation" | "role-play" | "emotional-assessment" | "product-knowledge",
  user: "User's message",
  history: [{ role: "user"|"assistant", content: "..." }],
  disease: "HIV" | "Oncology" | etc.,
  persona: "Busy NP" | "Difficult HCP" | etc.,
  goal: "Start one patient this month",
  session: "widget-abc123"
}
```

✅ **VERIFIED**: Payload structure matches Worker expectations

---

### Worker → Frontend Response

**Location**: `worker.js` line 700+  
**Structure**:
```javascript
{
  reply: "AI response text",
  coach: {
    scores: { accuracy: 0-5, compliance: 0-5, discovery: 0-5, clarity: 0-5, objection_handling: 0-5, empathy: 0-5 },
    worked: ["Action 1", "Action 2"],
    improve: ["Suggestion 1"],
    phrasing: "Suggested phrasing text",
    feedback: "Overall feedback",
    context: { rep_question: "...", hcp_reply: "..." }
  },
  plan: { id: "abc123" }
}
```

✅ **VERIFIED**: Response structure matches Frontend expectations

---

### Rendering Logic

| **Mode** | **Widget.js Line** | **Render Behavior** | **Status** |
|----------|-------------------|---------------------|------------|
| sales-simulation | 1500, 1554 | Speaker: "Sales Coach", parse Challenge/Rep/Impact/Phrasing, yellow card | ⚠️ Missing Phrasing |
| role-play | 1494, 1534 | Speaker: "HCP"/"Rep", dialogue bubbles, NO coach panel | ✅ Correct |
| emotional-assessment | 1683 | Speaker: "Coach", EI guidance + scoring panel | ✅ Correct |
| product-knowledge | 1632, 1699 | Speaker: "Coach", Answer + References, compact chip | ✅ Correct |

---

## 📋 Recommended Fixes

### Priority 1: Sales-Simulation "Suggested Phrasing" Fix

**Option A**: Post-processing fallback (pragmatic)
```javascript
// In worker.js after line 660
if (mode === "sales-simulation" && !/Suggested Phrasing:/i.test(reply)) {
  // Extract Impact section content
  const impactMatch = reply.match(/Impact:\s*(.+?)(?=\n\n|$)/is);
  if (impactMatch) {
    const impactText = impactMatch[1].trim();
    // Generate deterministic phrasing from impact
    const phrasing = impactText.replace(/^This approach |By following this approach, |/i, '')
      .replace(/\.$/, '')
      .substring(0, 120);
    reply += `\n\nSuggested Phrasing: "${phrasing}."`;
  }
}
```

**Option B**: Continue prompt (already attempted, didn't work reliably)

**Option C**: Switch to different model for sales-simulation mode only

---

### Priority 2: Add Response Validator

```javascript
// Add after extractCoach() in worker.js
function validateAndCleanResponse(mode, reply, coach) {
  let cleaned = reply;
  const warnings = [];
  
  // Role-play: Strip any coaching leakage
  if (mode === "role-play") {
    const coachingPatterns = /(?:challenge|rep approach|impact|suggested phrasing|coach guidance):\s*[\s\S]*$/gi;
    if (coachingPatterns.test(cleaned)) {
      cleaned = cleaned.replace(coachingPatterns, '').trim();
      warnings.push("stripped_coaching_from_roleplay");
    }
  }
  
  // Sales-simulation: Detect HCP voice
  if (mode === "sales-simulation") {
    if (/^(I'm |I think |From my perspective|We evaluate)/im.test(cleaned)) {
      warnings.push("hcp_voice_detected_in_sales_sim");
    }
  }
  
  return { reply: cleaned, warnings };
}
```

---

### Priority 3: Enhanced Debug Logging

Add to worker.js:
```javascript
console.log({
  event: "chat_response",
  mode,
  reply_length: reply.length,
  has_coach: !!coach,
  coach_keys: Object.keys(coach || {}),
  format_check: {
    has_challenge: /Challenge:/i.test(reply),
    has_rep_approach: /Rep Approach:/i.test(reply),
    has_impact: /Impact:/i.test(reply),
    has_suggested_phrasing: /Suggested Phrasing:/i.test(reply)
  }
});
```

---

## 🚀 How to Debug

### Local Development Setup

1. **Start Worker (Local)**:
```bash
npx wrangler dev --local --port=8787 --inspector-port=9229
```

2. **Start Frontend (VS Code Live Server)**:
- Install "Live Server" extension
- Right-click `index.html` → "Open with Live Server"
- Defaults to `http://localhost:5500`

3. **Set Breakpoints**:

**Worker**:
- Line 376: `postChat` function entry
- Line 608: Mode-specific prompt selection
- Line 638: Provider call
- Line 660: extractCoach
- Line 700: Response return

**Frontend (widget.js)**:
- Line 1914: Payload construction
- Line 1494: Role-play rendering
- Line 1500: Sales-simulation rendering
- Line 1554: Coach panel rendering

4. **Launch Debug**:
- Open VS Code Command Palette (Cmd+Shift+P)
- Select "Debug: Select and Start Debugging"
- Choose "Full Stack Debug (Worker + Frontend)"

---

## ✅ Summary

| **Category** | **Status** | **Details** |
|--------------|------------|-------------|
| Debug Setup | ✅ Complete | launch.json + settings.json configured |
| Architecture | ✅ Mapped | Frontend → Worker → Groq → Response flow verified |
| Mode Isolation | ✅ Working | role-play, emotional-assessment, product-knowledge correct |
| Sales-Simulation | ⚠️ 75% | Missing "Suggested Phrasing" (model cutoff issue) |
| Guardrails | ⚠️ Partial | Prompt-based only, needs server-side validation |
| Wiring | ✅ Verified | Payload/response schemas match |
| Rendering | ✅ Working | Mode-specific UI rendering correct |

---

## 📝 Next Steps

1. ✅ **Implement Priority 1 Fix** (Suggested Phrasing fallback)
2. ⏳ **Implement Priority 2** (Response validator)
3. ⏳ **Implement Priority 3** (Enhanced logging)
4. ⏳ **Test all 4 modes** with breakpoints
5. ⏳ **Document final validation results**

---

*End of Architecture Analysis*
