# SALES COACH WORKER MAP — Contract & Path Analysis

**Generated:** 2025-11-13  
**File:** worker.js (1561 lines)  
**Mode:** `"sales-coach"`  
**Endpoint:** POST /chat

---

## 1. SYSTEM PROMPT DEFINITION

**Location:** Lines 872-895  
**Function:** `salesCoachPrompt` (array joined with `\n`)

**Format Requirements:**
```
Challenge: [one sentence describing HCP's barrier]

Rep Approach:
• [clinical point with reference [FACT-ID]]
• [supporting strategy with reference [FACT-ID]]
• [safety consideration with reference [FACT-ID]]

Impact: [expected outcome connecting back to Challenge]

Suggested Phrasing: "[exact words rep should say]"

<coach>{...EI scores...}</coach>
```

**Key Instruction:** Line 891 - `DO NOT deviate from this format. DO NOT add extra sections. DO NOT skip sections.`

**Contract Appended:** Lines 894-895 - `salesContract` (defined at lines 860-868)

---

## 2. MODE DETECTION & PROMPT SELECTION

**Location:** Lines 1157-1167  
**Logic:**
```javascript
if (mode === "sales-coach") {
  sys = salesCoachPrompt;  // Line 1158
  maxTokens = 1600;        // Line 1182 - Increased to ensure all 4 sections complete
}
```

**Fallback:** Line 1166 - If mode doesn't match any specific case, defaults to `salesCoachPrompt`

---

## 3. LLM CALL & RAW RESPONSE

**Function:** `providerChat(env, msgs, opts)`  
**Location:** Called around line 1190  
**Returns:** Raw LLM string output containing formatted sections + `<coach>{...}</coach>` JSON

---

## 4. POST-PROCESSING — SALES-COACH SPECIFIC

### 4.1 Format Normalization (Lines 1239-1245)

**Purpose:** Standardize section headings

```javascript
if (mode === "sales-coach") {
  reply = reply
    .replace(/Coach [Gg]uidance:/g, 'Challenge:')
    .replace(/Next[- ]?[Mm]ove [Pp]lanner:/g, 'Rep Approach:')
    .replace(/Risk [Ff]lags:/g, 'Impact:')
    .replace(/Suggested [Pp]hrasing:/g, 'Suggested Phrasing:')  // Line 1244
    .replace(/Rubric [Jj][Ss][Oo][Nn]:/g, '');
}
```

---

### 4.2 Format Validation (Lines 1247-1266)

**Detection:**
```javascript
const hasChallenge = /Challenge:/i.test(reply);      // Line 1248
const hasRepApproach = /Rep Approach:/i.test(reply); // Line 1249
const hasImpact = /Impact:/i.test(reply);            // Line 1250
const hasSuggested = /Suggested Phrasing:/i.test(reply); // Line 1251
```

**Warnings Logged:** Lines 1258-1266  
- Logs `sales_simulation_format_incomplete` if any section missing
- Includes `has_suggested: hasSuggested` in warning payload
- **DOES NOT BLOCK** - only logs for monitoring

---

### 4.3 **CRITICAL: Suggested Phrasing Fallback (Lines 1268-1284)**

**Purpose:** Force-add Suggested Phrasing if model cuts off after Impact

```javascript
// Force-add Suggested Phrasing if missing (model consistently cuts off after Impact)
if (!hasSuggested) {
  console.log("[FALLBACK] Adding missing Suggested Phrasing");  // Line 1270
  const repText = repMatch ? repMatch[1] : '';
  let phrasing = `"Would you like to discuss how this approach fits your practice?"`;

  if (repText.includes('assess') || repText.includes('eligibility')) {
    phrasing = `"Can we review patient eligibility criteria together?"`;
  } else if (repText.includes('renal') || repText.includes('monitor')) {
    phrasing = `"Let's confirm the monitoring protocol that works for your workflow."`;
  } else if (repText.includes('adherence') || repText.includes('follow-up')) {
    phrasing = `"How do you currently support adherence in your at-risk population?"`;
  }

  reply += `\n\nSuggested Phrasing: ${phrasing}`;  // Line 1282
  console.log("[FALLBACK] Suggested Phrasing added:", phrasing);  // Line 1283
}
```

**Context-Aware:**
- Default: Generic phrasing about discussing approach
- If Rep Approach mentions "assess" or "eligibility": Patient criteria question
- If mentions "renal" or "monitor": Monitoring protocol question
- If mentions "adherence" or "follow-up": Adherence support question

---

### 4.4 Bullet Count Enforcement (Lines 1286-1294)

**Purpose:** Ensure exactly 3 bullets in Rep Approach

```javascript
if (hasRepApproach && bulletCount !== 3 && repMatch) {
  const bullets = repMatch[1].split(/\n/).filter(l => l.includes('•')).slice(0, 3);
  while (bullets.length < 3) {
    bullets.push(`• Reinforce evidence-based approach`);
  }
  const newRepSection = `Rep Approach:\n${bullets.join('\n')}`;
  reply = reply.replace(/Rep Approach:.*?(?=Impact:|Suggested Phrasing:|$)/is, newRepSection + '\n\n');
}
```

---

## 5. FSM SENTENCE CAPPING (Lines 1313-1316)

**CRITICAL PATH:**

```javascript
// FSM clamps
const fsm = FSM[mode] || FSM["sales-coach"];
const cap = fsm?.states?.[fsm?.start]?.capSentences || 5;
reply = capSentences(reply, cap);  // Line 1316
```

**FSM Definition (Lines 182-185):**
```javascript
"sales-coach": {
  states: { START: { capSentences: 0, next: "COACH" }, COACH: { capSentences: 0, next: "COACH" } },
  start: "START"
}
```

**Function `capSentences()` (Lines 318-322):**
```javascript
function capSentences(text, n) {
  if (n === 0) return text; // Skip capping when n=0 (sales-coach has explicit format validation)
  const parts = String(text || "").replace(/\s+/g, " ").match(/[^.!?]+[.!?]?/g) || [];
  return parts.slice(0, n).join(" ").trim();
}
```

**✅ NO TRUNCATION** for sales-coach since `cap = 0` → early return at line 319

---

## 6. FINAL FORMATTING (Lines 1411-1419)

**Purpose:** Add newlines between sections (AFTER capSentences)

```javascript
if (mode === "sales-coach") {
  reply = reply
    .replace(/(Challenge:)/g, '\n\n$1')
    .replace(/(\.)\s+(Rep Approach:)/g, '$1\n\n$2')
    .replace(/(\.)\s+(Impact:)/g, '$1\n\n$2')
    .replace(/(\.)\s+(Suggested Phrasing:)/g, '$1\n\n$2')  // Line 1417
    .trim();
}
```

**Timing:** This runs AFTER capSentences() and before return, so it operates on the final reply string.

---

## 7. COACH JSON EXTRACTION (Lines 631-681)

**Function:** `extractCoach(text)`  
**Purpose:** Parse `<coach>{...}</coach>` JSON block from response

**Returns:**
```javascript
{
  clean: text,    // Reply with <coach> block removed
  coach: {...}    // Parsed coach JSON object
}
```

**Does NOT extract/structure Suggested Phrasing** - that stays in `clean` text only.

---

## 8. FINAL JSON RESPONSE STRUCTURE

**Location:** Lines 1400-1410  
**Format:**
```javascript
return json({
  reply: reply,           // Full formatted text (Challenge...Impact...Suggested Phrasing)
  coach: coachObj,        // { scores, rationales, tips, worked, improve, phrasing, feedback, context }
  plan_id: planId,
  facts: activePlan?.facts || []
}, 200, env, req, { "x-req-id": reqId });
```

**Key Fields:**
- `reply`: String containing all 4 sections formatted with newlines
- `coach.phrasing`: MAY contain phrasing from `<coach>` JSON (different from reply's "Suggested Phrasing:")
- **NO** structured extraction of reply sections into separate JSON fields

---

## 9. CONTROL FLOW SUMMARY

```
1. User sends POST /chat with mode: "sales-coach"
2. Build system prompt (salesCoachPrompt) with 4-section format requirement
3. Call LLM with maxTokens: 1600
4. Receive raw response
5. Extract <coach>{...}</coach> JSON → coachObj
6. Clean reply text (remove coach block)
7. Normalize section headings (line 1239-1245)
8. Validate format (line 1247-1251): hasChallenge, hasRepApproach, hasImpact, hasSuggested
9. **IF !hasSuggested:** Append fallback Suggested Phrasing (line 1268-1284) ← CRITICAL
10. Enforce 3 bullets in Rep Approach (line 1286-1294)
11. Apply FSM capping (line 1316) - NO-OP for sales-coach (cap=0)
12. Add newlines between sections (line 1411-1419)
13. Return JSON: { reply, coach, plan_id, facts }
```

---

## 10. CURRENT ISSUE HYPOTHESIS

**Test Results:**
- `grep "Suggested Phrasing:"` → 0 matches
- Response length ≈ 2.5K chars
- Challenge, Rep Approach, Impact present

**Possible Causes:**

### A. Fallback NOT Executing
- `hasSuggested = true` when it shouldn't be (model output contains "Suggested Phrasing:" but truncated)
- Logging added at lines 1270 & 1283 not appearing in Cloudflare logs

### B. Fallback Executing But Result Stripped
- Line 1282 appends to `reply`
- Later processing (lines 1313-1419) removes it
- BUT: capSentences() skips for cap=0, and newline replacement shouldn't strip content

### C. Model Response Format Different
- LLM returning "Suggested Phrasing:" in unexpected format (typo, extra chars)
- Regex `/Suggested Phrasing:/i` not matching actual output
- Need to inspect raw LLM response before any processing

---

## NEXT STEPS (PHASE 2)

1. Add logging BEFORE line 1239 to capture raw LLM response
2. Add logging at line 1251 to show `hasSuggested` value
3. Add logging at line 1282 to confirm fallback appended text
4. Add logging at line 1316 BEFORE and AFTER capSentences()
5. Redeploy and capture logs for Oncology + HIV test cases
6. Analyze logs to determine which hypothesis is correct

---

**END OF PHASE 1 MAPPING**
