# Mode Mapping Final - ReflectivAI Repository (Copilot Analysis)

**Created:** 2025-11-22  
**Purpose:** Document UI mode → payload mode → worker prompt mapping with citations

---

## Current Mode Flow

### UI Layer (widget.js)

**User-facing labels (line 54):**
```javascript
const LC_OPTIONS = [
  "Emotional Intelligence",
  "Product Knowledge", 
  "Sales Coach",
  "Role Play",
  "General Assistant"
];
```

**Label to internal mode mapping (lines 55-61):**
```javascript
const LC_TO_INTERNAL = {
  "Emotional Intelligence": "emotional-assessment",
  "Product Knowledge": "product-knowledge",
  "Sales Coach": "sales-coach",
  "Role Play": "role-play",
  "General Assistant": "general-knowledge"
};
```

**Location where mapping is applied:** Widget.js maps the friendly label to internal mode string before passing to mode modules.

---

### Mode Module Layer (assets/chat/modes/)

**All four mode modules** (emotionalIntelligence.js, productKnowledge.js, rolePlay.js, salesCoach.js) use identical pattern:

```javascript
// Line 21: Get mode from store
const {mode} = store.get();

// Line 24: Call API with mode
const data = await chat({mode, messages:[{role:'user',content:msg}], signal});
```

**Mode values at this layer:**
- `"emotional-assessment"` (from Emotional Intelligence)
- `"product-knowledge"` (from Product Knowledge)
- `"sales-coach"` (from Sales Coach)
- `"role-play"` (from Role Play)
- `"general-knowledge"` (from General Assistant)

---

### API Layer (assets/chat/core/api.js)

**Current implementation (line 126-142):**
```javascript
export async function chat({ mode, messages, signal }) {
  if (!mode) {
    throw new Error('Mode is required');
  }
  
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    throw new Error('Messages array is required and must not be empty');
  }
  
  const payload = {
    mode,
    messages,
    threadId: crypto.randomUUID()
  };
  
  return await workerFetch('/chat', payload, signal);
}
```

**Current behavior:** 
- ✅ Receives mode from mode module
- ✅ Includes mode in payload sent to worker
- ❌ NO mode translation/mapping (passes through as-is)
- ❌ NO eiContext parameter support

**Modes sent to worker:**
- `"emotional-assessment"`
- `"product-knowledge"`
- `"sales-coach"`
- `"role-play"`
- `"general-knowledge"`

---

### Worker Layer (worker.js)

**Request parsing (lines 900-953):**

**Two payload formats supported:**

1. **Widget format** (messages array):
```javascript
if (body.messages && Array.isArray(body.messages)) {
  mode = body.mode || "sales-coach";  // Line 927
  // ...
}
```

2. **ReflectivAI format** (direct):
```javascript
else {
  mode = body.mode || "sales-coach";  // Line 938
  // ...
}
```

**Mode normalization (lines 949-953):**
```javascript
// CRITICAL: Normalize mode name - frontend sends "sales-simulation" 
// but worker uses "sales-coach" internally
if (mode === "sales-simulation") {
  mode = "sales-coach";
}
```

**Note:** This normalization is currently NOT needed because the widget sends "sales-coach" directly. The "sales-simulation" alias provides backward compatibility for older clients.

**Valid modes in FSM (lines 193-217):**
- `"sales-coach"` (lines 193-196)
- `"sales-simulation"` (lines 197-200) - maps to sales-coach
- `"role-play"` (lines 201-204)
- `"emotional-assessment"` (lines 205-208)
- `"product-knowledge"` (lines 209-212)
- `"general-knowledge"` (lines 213-216)

**Prompt selection (lines 1380-1394):**
```javascript
let sys;
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

---

## Complete Mode Mapping Table

| UI Label | Widget Internal | API Payload | Worker Mode | Worker Prompt | Notes |
|----------|----------------|-------------|-------------|---------------|-------|
| Emotional Intelligence | emotional-assessment | emotional-assessment | emotional-assessment | eiPrompt (line 1156) | ✅ Direct mapping |
| Product Knowledge | product-knowledge | product-knowledge | product-knowledge | pkPrompt (line 1197) | ✅ Direct mapping |
| Sales Coach | sales-coach | sales-coach | sales-coach | salesCoachPrompt (line 1082) | ✅ Direct mapping |
| Role Play | role-play | role-play | role-play | rolePlayPrompt (line 1117) | ✅ Direct mapping |
| General Assistant | general-knowledge | general-knowledge | general-knowledge | generalKnowledgePrompt (line 1251) | ✅ Direct mapping |
| N/A (legacy) | N/A | sales-simulation | sales-coach | salesCoachPrompt (line 1082) | Alias for backward compat |

---

## Prompt Details

### Sales Coach Prompt (lines 1082-1115)

**System prompt includes:**
- Disease, Persona, Goal context
- Facts and References from plan
- MANDATORY 4-section format:
  - Challenge
  - Rep Approach (3 bullets with [FACT-ID] refs)
  - Impact
  - Suggested Phrasing
- EI scoring in `<coach>` block with 10 metrics

**Token allocation:** 1600 tokens (line 1409)

---

### EI Prompt (lines 1156-1195)

**System prompt includes:**
- Mission: "Help the rep develop emotional intelligence through reflective practice"
- CASEL SEL Competencies (Self-Awareness, Self-Regulation, Empathy, Clarity, Relationship Skills, Compliance)
- Triple-Loop Reflection Architecture
- Socratic metacoach prompts
- Output style: 2-4 paragraphs, 1-2 Socratic questions

**Current gap:** References "about-ei.md framework" but doesn't embed actual content.

**Token allocation:** 1200 tokens (line 1412)

---

### Role Play Prompt (lines 1117-1154)

**System prompt includes:**
- HCP persona and disease context
- Mission: Speak AS the HCP in natural clinical dialogue
- Strict anti-coaching guardrails
- First-person voice requirements
- 3-point checklist for validation

**Token allocation:** 1200 tokens (line 1411)

---

### Product Knowledge Prompt (lines 1197-1250)

**System prompt includes:**
- Scientific rigor and evidence-based approach
- Comprehensive response structure
- Citation requirements [1], [2]
- Clinical context and relevance
- Compliance standards

**Token allocation:** 1800 tokens (line 1415)

---

### General Knowledge Prompt (lines 1251-1378)

**System prompt includes:**
- Versatile AI assistant identity
- Response structure guidelines for different question types
- Length guidelines (50-900 words based on complexity)
- Quality standards
- Example interactions

**Token allocation:** 1800 tokens (line 1417)

---

## Findings

### ✅ What Works

1. **Mode names are ALIGNED:** Widget sends exactly what worker expects
2. **No translation needed:** Current flow is direct and correct
3. **Backward compatibility:** Worker handles "sales-simulation" alias gracefully
4. **Mode validation:** modeStore.js validates modes (line 7)
5. **Prompt selection:** Worker correctly routes to mode-specific prompts

### ❌ What's Missing

1. **No explicit mapping in api.js:** While current flow works, there's no explicit MODE_MAPPING constant for documentation/maintenance
2. **No EI context parameter:** api.js doesn't support passing eiContext to worker
3. **EI prompt missing content:** Worker's eiPrompt references framework but doesn't embed it

---

## Recommendation

**Mode mapping is CORRECT and needs NO changes.**

The only improvement would be adding an explicit MODE_MAPPING constant in api.js for documentation purposes:

```javascript
// Explicit mode mapping for documentation
// Current frontend modes already match worker expectations
const MODE_MAPPING = {
  'emotional-assessment': 'emotional-assessment',
  'product-knowledge': 'product-knowledge',
  'sales-coach': 'sales-coach',
  'role-play': 'role-play',
  'general-knowledge': 'general-knowledge'
};
```

But this is OPTIONAL since modes already align. The real work is in Phase 2 (EI context wiring).

---

**Status:** Mode mapping analysis COMPLETE. No code changes needed for Phase 1.

**Next:** Phase 2 - Wire EI context through the stack.
