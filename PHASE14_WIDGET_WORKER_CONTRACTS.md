# Phase 14: Widget-Worker Contract Specification

## Overview

This document defines the complete contract between the ReflectivAI widget (frontend) and the Cloudflare Worker (backend) for all 5 modes. Use this as the authoritative reference for payload structures, response formats, and validation rules.

**Last Updated:** 2025-11-22  
**Version:** Phase 14 (r10.1)

---

## Contract Principles

1. **Consistency:** All modes use the same base payload structure
2. **Optional Fields:** disease, persona, goal, scenarioId are optional but always included
3. **Validation:** Worker validates required fields and returns specific errors
4. **Structured Response:** Worker returns JSON with `{ reply, coach, plan }`
5. **Backward Compatibility:** Widget handles both structured and legacy plain-text responses

---

## Base Payload Structure

**All modes send this base structure:**

```javascript
{
  messages: [                    // REQUIRED: Array of message objects
    { role: "system", content: string },
    { role: "user", content: string }
  ],
  mode: string,                  // REQUIRED: One of 5 modes
  disease: string,               // OPTIONAL: Therapeutic area/disease state
  persona: string,               // OPTIONAL: HCP profile/role
  goal: string,                  // OPTIONAL: Scenario goal
  scenarioId: string | null      // OPTIONAL: Scenario identifier
}
```

**Validation Rules:**
- `messages` must be non-empty array
- At least one message with `role: "user"` required
- User message content cannot be empty/whitespace
- `mode` must be one of: `sales-coach`, `role-play`, `product-knowledge`, `emotional-assessment`, `general-knowledge`

---

## Mode 1: Sales Coach

### Purpose
Provide structured sales guidance with EI scoring.

### Request
```javascript
{
  messages: [...],
  mode: "sales-coach",
  disease: "HIV" | "Oncology" | "Cardiovascular" | "COVID-19" | "Vaccines",
  persona: "Difficult HCP" | "Highly Engaged HCP" | "Nice but Doesn't Prescribe",
  goal: "Increase PrEP prescriptions",
  scenarioId: "scenario_123"
}
```

### Response
```javascript
{
  reply: string,  // Formatted as below
  coach: {
    scores: {
      empathy: 0-5,
      clarity: 0-5,
      compliance: 0-5,
      discovery: 0-5,
      objection_handling: 0-5,
      confidence: 0-5,
      active_listening: 0-5,
      adaptability: 0-5,
      action_insight: 0-5,
      resilience: 0-5
    },
    rationales: { /* score explanations */ },
    worked: string[],
    improve: string[],
    feedback: string,
    phrasing: string,
    context: { rep_question: string, hcp_reply: string }
  },
  plan: { id: string }
}
```

### Reply Format (MANDATORY 4-Section Structure)

```
Challenge: [One sentence describing HCP's barrier - 15-25 words]

Rep Approach:
• [Clinical point with context - 20-35 words - MUST include [FACT-ID]]
• [Supporting strategy - 20-35 words - MUST include [FACT-ID]]
• [Safety consideration - 20-35 words - MUST include [FACT-ID]]
[EXACTLY 3 BULLETS - NO MORE, NO LESS]

Impact: [Expected outcome - 20-35 words - connects back to Challenge]

Suggested Phrasing: "[Exact words rep should say - 25-40 words]"
```

### Citations
- Format: `[HIV-PREP-XXX]` where XXX is the fact ID
- Must reference FACTS_DB entries
- Widget resolves to full citations via `citationsDb`

### Validation
- Worker enforces all 4 sections present
- Worker enforces exactly 3 bullets in Rep Approach
- Worker auto-adds Suggested Phrasing if missing
- Widget displays contract warning if sections incomplete

---

## Mode 2: Role Play

### Purpose
Simulate HCP conversation for rep training.

### Request
```javascript
{
  messages: [...],
  mode: "role-play",
  disease: "HIV",
  persona: "Difficult HCP",
  goal: "Discuss PrEP eligibility",
  scenarioId: "scenario_123"
}
```

### Response
```javascript
{
  reply: string,  // Pure HCP dialogue, first-person voice
  coach: {
    scores: { /* minimal/default scores */ },
    // ... other fields may be default values
  },
  plan: { id: string }
}
```

### Reply Format

**Pure HCP dialogue** - first person, in character:
- 1-4 sentences OR brief clinical bullet lists
- Professional, evidence-based tone
- NO meta-commentary
- NO coaching sections (Challenge, Rep Approach, etc.)
- NO third-person references ("The rep should...")
- NO JSON or `<coach>` blocks in visible text

**Examples:**
- ✅ "I assess risk by reviewing sexual history and STI screening results."
- ✅ "I have 2-3 minutes. What's the key monitoring consideration?"
- ❌ "Challenge: The HCP is resistant..." (coaching format leak)
- ❌ "You should emphasize..." (meta-commentary)

### Validation
- Worker strips ALL coaching format markers
- Worker removes sales-coach sections if leaked
- Widget applies `sanitizeRolePlayOnly()` for cleanup
- Widget may re-request if format violations detected

---

## Mode 3: Product Knowledge

### Purpose
Answer clinical/scientific questions with evidence.

### Request
```javascript
{
  messages: [...],
  mode: "product-knowledge",
  disease: "Oncology",  // Optional, may be empty
  persona: "",          // Usually empty
  goal: ""              // Usually empty
}
```

### Response
```javascript
{
  reply: string,  // Markdown-formatted knowledge response
  coach: null,    // No coaching in PK mode
  plan: { id: string }
}
```

### Reply Format

**Comprehensive knowledge response:**
- Structured with headers (##, ###), bullets, numbered lists
- Inline citations `[1]`, `[2]`, `[3]`
- References section at end with numbered entries
- 100-800 words depending on question complexity

**Example:**
```
## Mechanism of Action

ADCs combine targeted antibodies with cytotoxic payloads [1].

### Clinical Benefits
1. Selective delivery to tumor cells
2. Reduced systemic toxicity
3. Improved efficacy vs traditional chemo [2]

## Safety Considerations
- Monitor for neutropenia
- Watch for peripheral neuropathy [3]

### References
1. FDA Label - ADC Mechanism (url)
2. Clinical Trial Data (url)
3. Safety Monitoring Guidelines (url)
```

### Citations
- Format: `[1]`, `[2]` etc. in body
- References section with full APA-style entries
- Different from Sales Coach `[FACT-ID]` format

### Validation
- Worker validates presence of inline citations
- Worker validates References section exists
- No `<coach>` blocks should appear

---

## Mode 4: Emotional Assessment

### Purpose
EI coaching through Socratic questioning.

### Request
```javascript
{
  messages: [...],
  mode: "emotional-assessment",
  disease: "HIV",
  persona: "Difficult HCP",
  goal: "Develop self-awareness"
}
```

### Response
```javascript
{
  reply: string,  // Socratic coaching, MUST end with "?"
  coach: {
    scores: { /* EI-focused scores */ },
    worked: string[],
    improve: string[],
    feedback: string
  },
  plan: { id: string }
}
```

### Reply Format

**Socratic coaching response:**
- 2-4 paragraphs (max 350 words)
- 1-2 reflective questions embedded
- MUST end with a question mark (enforced by worker)
- Triple-Loop Reflection framework
- Warm, empathetic coaching tone

**Framework:**
- Loop 1: Task outcome assessment
- Loop 2: Emotional regulation review
- Loop 3: Mindset reframing

**Example questions:**
- "What did you notice about your tone just now?"
- "How might the HCP have perceived your last statement?"
- "What assumption shaped your approach?"

### Validation
- Worker enforces final "?" at end of response
- Worker adds reflective question if missing
- No sales sections or product info allowed
- Widget renders EI panel with scores

---

## Mode 5: General Knowledge

### Purpose
Answer any question (not limited to pharma/healthcare).

### Request
```javascript
{
  messages: [...],
  mode: "general-knowledge",
  disease: "",  // Usually empty
  persona: "",  // Usually empty
  goal: ""      // Usually empty
}
```

### Response
```javascript
{
  reply: string,  // Markdown-formatted general answer
  coach: null,    // No coaching
  plan: { id: string }
}
```

### Reply Format

**General helpful response:**
- Direct answer upfront
- Well-structured with markdown
- Bullets/lists on separate lines (NOT inline)
- Headers, examples, context as appropriate
- 100-600 words typically

**CRITICAL Formatting Rules:**
- Each numbered item on NEW LINE: `1. First\n2. Second`
- Each bullet on NEW LINE: `- Bullet one\n- Bullet two`
- NO inline lists like `1. First - sub - sub 2. Second`
- Proper markdown with line breaks

### Validation
- No coaching sections
- No sales-coach format
- Standard markdown rendering

---

## Error Handling

### HTTP Status Codes

| Code | Meaning | Widget Behavior |
|------|---------|-----------------|
| 200  | Success | Parse response, render content |
| 400  | Bad request | Show error message from worker |
| 401  | Unauthorized | Show "Authentication required" |
| 403  | Forbidden | Show "Authentication required" |
| 429  | Rate limited | Retry with backoff, show "Too many requests" |
| 500  | Server error | Retry with backoff, show "Service error" |
| 502  | Bad gateway | Retry with backoff, show "Service temporarily unavailable" |
| 503  | Service unavailable | Retry with backoff, show "Service temporarily unavailable" |

### Retry Logic

**Widget implements exponential backoff:**
1. First retry: 300ms delay
2. Second retry: 800ms delay
3. Third retry: 1500ms delay
4. After 3 retries: Show error to user

**Retryable errors:**
- 429 (rate limit)
- 5xx (server errors)
- Network errors
- Timeouts

**Non-retryable errors:**
- 400 (bad request)
- 401, 403 (auth errors)
- Empty response after successful HTTP

### User-Facing Error Messages

**429 Rate Limit:**
> "Too many requests. Please wait a moment and try again."

**503/502 Service Error:**
> "Service temporarily unavailable. Please try again in a moment."

**Network Error:**
> "Cannot connect to backend. Please check your internet connection or try again later."

**Timeout:**
> "Request timed out. Please try again."

**Authentication:**
> "Authentication required - please check access permissions."

**Empty Response:**
> "Received empty response from server. Please retry."

---

## Backward Compatibility

### Legacy Plain-Text Responses

Widget handles both formats:

**Structured (current):**
```javascript
{
  text: "response text",
  _coachData: { /* coach object */ },
  _isStructured: true
}
```

**Legacy (fallback):**
```javascript
"plain text response"
```

### Coach Data Extraction

If worker doesn't provide structured coach data:
1. Widget attempts to extract `<coach>{...}</coach>` from text
2. Falls back to deterministic scoring if extraction fails
3. Ensures coach panel always has data to display

---

## Validation Functions

### Worker Validation

**Function:** `validateModeResponse(mode, reply, coachObj)`

**Per-mode checks:**
- Sales Coach: Validates 4 sections, 3 bullets, citations
- Role Play: Strips coaching format, validates HCP voice
- Product Knowledge: Validates citations, references section
- Emotional Assessment: Validates ends with "?"
- General Knowledge: Validates no mode-specific structure

**Returns:**
```javascript
{
  reply: string,        // Cleaned reply
  warnings: string[],   // Non-breaking issues
  violations: string[]  // Breaking issues
}
```

### Widget Validation

**Sales Coach Format Check (widget.js:900-993):**
- Parses 4 sections using regex
- Counts bullets in Rep Approach
- Validates citation codes against `citationsDb`
- Shows contract warning card if issues found
- Renders available sections even if incomplete

---

## Citation Processing

### Sales Coach Citations

**Format:** `[FACT-ID]` where FACT-ID matches FACTS_DB entry

**Widget Processing:**
1. Extract citation codes from text
2. Look up in `citationsDb` 
3. Convert to clickable links or tooltips
4. Flag malformed citations

**Example:**
```javascript
citationsDb = {
  "HIV-PREP-ELIG-001": {
    text: "CDC PrEP Guidelines 2024",
    url: "https://www.cdc.gov/hiv/risk/prep/index.html"
  }
}
```

### Product Knowledge Citations

**Format:** `[1]`, `[2]` etc. with References section

**Widget Processing:**
1. Render inline citation numbers
2. Link to References section
3. Parse References section for full entries

---

## Testing Contracts

### Minimal Test Cases (per mode)

**Sales Coach:**
```javascript
// Request
{ mode: "sales-coach", messages: [{role:"user",content:"How do I discuss PrEP?"}], disease:"HIV" }

// Validate Response
✓ Has all 4 sections
✓ Rep Approach has exactly 3 bullets
✓ Each bullet includes [FACT-ID]
✓ coach.scores object present
✓ No <coach> blocks in reply text
```

**Role Play:**
```javascript
// Request
{ mode: "role-play", messages: [{role:"user",content:"Tell me about your PrEP experience"}], disease:"HIV", persona:"Difficult HCP" }

// Validate Response
✓ First-person HCP voice
✓ No coaching sections
✓ 1-4 sentences or brief bullets
✓ No meta-commentary
```

**Product Knowledge:**
```javascript
// Request
{ mode: "product-knowledge", messages: [{role:"user",content:"Explain ADC mechanism"}] }

// Validate Response
✓ Has inline citations [1], [2]
✓ Has References section
✓ Well-structured markdown
✓ No sales-coach format
```

**Emotional Assessment:**
```javascript
// Request
{ mode: "emotional-assessment", messages: [{role:"user",content:"That conversation felt tense"}] }

// Validate Response
✓ Ends with "?"
✓ Socratic questions embedded
✓ 2-4 paragraphs
✓ coach.scores present
```

**General Knowledge:**
```javascript
// Request
{ mode: "general-knowledge", messages: [{role:"user",content:"What is quantum computing?"}] }

// Validate Response
✓ Direct, helpful answer
✓ Proper markdown formatting
✓ No mode-specific structures
✓ Lists formatted correctly
```

---

## Troubleshooting Common Issues

### "Empty response from server"
**Cause:** Worker returned empty/null reply  
**Fix:** Check worker logs, verify LLM provider is accessible

### "Contract Warning" in Sales Coach
**Cause:** Missing sections or wrong bullet count  
**Fix:** Worker should auto-repair, check worker logs for format issues

### "Too many requests"
**Cause:** Rate limit hit (429 error)  
**Fix:** Widget retries automatically, user sees friendly message

### HCP voice leak in Role Play
**Cause:** LLM outputting coaching format  
**Fix:** Worker strips coaching markers, may re-request if severe

### Missing citations in Product Knowledge
**Cause:** LLM didn't include [n] references  
**Fix:** Worker validates and can repair with second request

---

## Implementation Files

**Widget Side:**
- `widget.js` - Main widget logic, sendMessage, callModel
- `assets/chat/core/api.js` - HTTP client, retry logic
- `assets/chat/modes/*.js` - Mode-specific UI modules

**Worker Side:**
- `worker.js` - Request handling, validation, LLM calling
- Lines 834-1757: `postChat()` function
- Lines 1062-1251: Mode-specific prompts
- Lines 1640-1650: Validation logic

---

## Version History

**Phase 14 (r10.1) - 2025-11-22:**
- ✅ Complete contract documentation
- ✅ Enhanced 429 error messages
- ✅ Defensive null checks in response handling
- ✅ Improved error message specificity

**Phase 3 (r10) - 2025-11:**
- ✅ Unified payload structure across modes
- ✅ Structured response format `{ reply, coach, plan }`
- ✅ Mode-specific validation
- ✅ Citation system implementation

---

## Contact & Maintenance

For questions or issues with widget-worker contracts:
1. Check this document first
2. Review worker logs for validation warnings
3. Test with `real_test.js` for live validation
4. Update this document when making contract changes

**Document Maintained By:** ReflectivAI Engineering Team  
**Contract Version:** r10.1
