# PHASE 3 EDGE-CASE TEST CATALOG

**Document:** Complete Reference for 30 Edge-Case Tests  
**Status:** SPECIFICATION & IMPLEMENTATION GUIDE  
**Test Matrix:** 30 Real Integration Tests (NO mocks, NO simulation)

---

## TEST EXECUTION SUMMARY

```
Total Tests:        30
Test Types:         3 categories
Categories:         Input (10) | Context (10) | Structure (10)
Test Framework:     Node.js + real HTTP POST
Endpoint:           https://my-chat-agent-v2.tonyabdelmalak.workers.dev/chat
Test Data:          Real personas, diseases, messages
Expected Pass Rate: 95%+ (28/30 minimum)
Total Runtime:      ~45 minutes
```

---

## CATEGORY 1: INPUT EDGE CASES (Tests 1-10)

### Test 1-1: INPUT-01 Empty String

| Field | Value |
|-------|-------|
| **Test ID** | INPUT-01 |
| **Test Name** | Empty String |
| **Mode** | sales-coach |
| **Input** | Empty string `""` |
| **Expected Behavior** | Should reject or handle gracefully; no malformed response |
| **Validation** | Response should either be error (HTTP 400) or valid empty response |
| **Pass Criteria** | HTTP 400 with error OR valid response with safe message |
| **Real Data** | Disease: onc_md_decile10_io_adc_pathways, Persona: onc_hemonc_md_costtox |

---

### Test 1-2: INPUT-02 Spaces Only

| Field | Value |
|-------|-------|
| **Test ID** | INPUT-02 |
| **Test Name** | Spaces Only |
| **Mode** | sales-coach |
| **Input** | `"     \n  \t  "` (whitespace only) |
| **Expected Behavior** | Should trim and treat as empty; not generate response |
| **Validation** | Should sanitize to empty and return graceful error |
| **Pass Criteria** | No response generated OR error returned |
| **Real Data** | Same disease/persona as INPUT-01 |

---

### Test 1-3: INPUT-03 Very Long Message

| Field | Value |
|-------|-------|
| **Test ID** | INPUT-03 |
| **Test Name** | Very Long Message (5000+ chars) |
| **Mode** | general-knowledge |
| **Input** | `"What is the impact of " + "climate change ".repeat(300) + " on healthcare systems?"` |
| **Length** | ~5400 characters |
| **Expected Behavior** | Should truncate gracefully or reject; no token overflow |
| **Validation** | Response should be valid OR HTTP 400 with clear error |
| **Pass Criteria** | No 502/503/504 errors; graceful handling |
| **Real Data** | General knowledge (no disease/persona required) |

---

### Test 1-4: INPUT-04 Gibberish Input

| Field | Value |
|-------|-------|
| **Test ID** | INPUT-04 |
| **Test Name** | Gibberish Input |
| **Mode** | product-knowledge |
| **Input** | `"asdfghjkl;qwerty zxcvbnm poiuytrewq"` |
| **Expected Behavior** | Should return valid response or friendly error (not malformed) |
| **Validation** | Response structure should match PK contract or be HTTP 400 |
| **Pass Criteria** | Valid response format; no gibberish in output |
| **Real Data** | Disease: hiv_im_decile4_prep_apretude_gap, Persona: hiv_im_decile3_prep_lowshare |

---

### Test 1-5: INPUT-05 Non-English Input

| Field | Value |
|-------|-------|
| **Test ID** | INPUT-05 |
| **Test Name** | Non-English (Mandarin) |
| **Mode** | general-knowledge |
| **Input** | `"我能问一个关于医疗系统的问题吗？"` (Can I ask a question about healthcare systems?) |
| **Expected Behavior** | Should attempt answer or politely decline; valid response structure |
| **Validation** | Response should be valid format; worker should handle gracefully |
| **Pass Criteria** | No crashes; valid response or polite error |
| **Real Data** | General knowledge mode |

---

### Test 1-6: INPUT-06 Emoji Only

| Field | Value |
|-------|-------|
| **Test ID** | INPUT-06 |
| **Test Name** | Emoji Only |
| **Mode** | general-knowledge |
| **Input** | `"😀 😀 😀 🏥 💊 ⚕️"` |
| **Expected Behavior** | Should handle gracefully; no malformed structure |
| **Validation** | Response should be valid format |
| **Pass Criteria** | No Unicode errors; valid response |
| **Real Data** | General knowledge mode |

---

### Test 1-7: INPUT-07 HTML/Script Injection

| Field | Value |
|-------|-------|
| **Test ID** | INPUT-07 |
| **Test Name** | HTML/Script Injection (XSS attempt) |
| **Mode** | product-knowledge |
| **Input** | `"<script>alert('xss')</script><img src='x' onerror='alert(1)'>"` |
| **Expected Behavior** | Should sanitize; no script execution; valid response |
| **Validation** | Response should be safe; no HTML tags in output |
| **Pass Criteria** | Payload sanitized; valid response format |
| **Real Data** | PK mode with HIV disease scenario |

---

### Test 1-8: INPUT-08 Multi-Line Malformed

| Field | Value |
|-------|-------|
| **Test ID** | INPUT-08 |
| **Test Name** | Multi-Line Malformed |
| **Mode** | role-play |
| **Input** | `"\n\n\n\nHow should I approach this?\n\n\n\n"` |
| **Expected Behavior** | Should normalize and respond naturally as HCP |
| **Validation** | Response should be valid RP format (no headers, first-person) |
| **Pass Criteria** | Normalized; valid HCP voice response |
| **Real Data** | RP with HIV disease scenario |

---

### Test 1-9: INPUT-09 Repetitive Spam

| Field | Value |
|-------|-------|
| **Test ID** | INPUT-09 |
| **Test Name** | Repetitive Spam (100x repeat) |
| **Mode** | sales-coach |
| **Input** | `"test ".repeat(200)` → "test test test..." (200 times) |
| **Expected Behavior** | Should detect and handle loop-guard logic; not crash |
| **Validation** | Worker should detect repetition; response should be valid or error |
| **Pass Criteria** | No infinite loops; graceful handling |
| **Real Data** | SC mode |

---

### Test 1-10: INPUT-10 Rapid Mode Switching

| Field | Value |
|-------|-------|
| **Test ID** | INPUT-10 |
| **Test Name** | Rapid Mode Switching |
| **Type** | Sequential test (5 requests) |
| **Modes** | sales-coach → role-play → emotional-assessment → product-knowledge → general-knowledge |
| **Message** | Same message: `"Test message"` |
| **Expected Behavior** | All 5 mode responses should be valid; no cross-mode contamination |
| **Validation** | Each response matches its mode's contract |
| **Pass Criteria** | All 5 responses valid with proper mode separation |
| **Real Data** | Real personas/diseases for each mode |

---

## CATEGORY 2: CONTEXT EDGE CASES (Tests 11-20)

### Test 2-1: CTX-11 Missing Persona

| Field | Value |
|-------|-------|
| **Test ID** | CTX-11 |
| **Test Name** | Missing Persona |
| **Mode** | sales-coach |
| **Payload** | `{ mode: "sales-coach", messages: [...], disease: REAL, persona: null, goal: "..." }` |
| **Expected Behavior** | Should use default persona or return graceful error |
| **Validation** | Response should be valid or HTTP 400 with clear message |
| **Pass Criteria** | No malformed response; handles missing persona |
| **Real Data** | Real disease (onc_md_decile10_io_adc_pathways) |

---

### Test 2-2: CTX-12 Missing Disease

| Field | Value |
|-------|-------|
| **Test ID** | CTX-12 |
| **Test Name** | Missing Disease |
| **Mode** | role-play |
| **Payload** | `{ mode: "role-play", messages: [...], disease: null, persona: REAL, goal: "..." }` |
| **Expected Behavior** | Should use generic context or return graceful error |
| **Validation** | Response should be valid RP format |
| **Pass Criteria** | Valid HCP response despite missing disease context |
| **Real Data** | Real persona (vax_peds_np_hesitancy) |

---

### Test 2-3: CTX-13 Persona/Disease Mismatch

| Field | Value |
|-------|-------|
| **Test ID** | CTX-13 |
| **Test Name** | Persona/Disease Mismatch |
| **Mode** | emotional-assessment |
| **Payload** | Oncology MD persona + HIV disease context |
| **Expected Behavior** | Should handle mismatch gracefully; return valid response |
| **Validation** | Response should still follow EI contract (Socratic, framework) |
| **Pass Criteria** | Valid EI response despite mismatch |
| **Real Data** | Real but mismatched persona/disease |

---

### Test 2-4: CTX-14 Sales-Coach No Goal

| Field | Value |
|-------|-------|
| **Test ID** | CTX-14 |
| **Test Name** | Sales-Coach No Goal |
| **Mode** | sales-coach |
| **Payload** | `{ mode: "sales-coach", ..., goal: null }` |
| **Expected Behavior** | Should use default goal or return graceful error |
| **Validation** | Response should have 4-section format regardless |
| **Pass Criteria** | Valid SC response with null goal |
| **Real Data** | Real disease + persona |

---

### Test 2-5: CTX-15 Truncated History

| Field | Value |
|-------|-------|
| **Test ID** | CTX-15 |
| **Test Name** | Truncated History (1 message only) |
| **Mode** | role-play |
| **Payload** | `{ messages: [{ role: "user", content: "Hi there" }] }` |
| **Expected Behavior** | Should handle single-turn gracefully |
| **Validation** | Valid RP response despite short history |
| **Pass Criteria** | Response is natural HCP greeting |
| **Real Data** | Real RP scenario |

---

### Test 2-6: CTX-16 Corrupted History

| Field | Value |
|-------|-------|
| **Test ID** | CTX-16 |
| **Test Name** | Corrupted History |
| **Mode** | product-knowledge |
| **Payload** | Messages with missing `content` field, out-of-order roles |
| **Expected Behavior** | Should sanitize and continue; not crash |
| **Validation** | Worker sanitizes broken fields; returns valid response |
| **Pass Criteria** | No crashes; graceful sanitization |
| **Real Data** | PK mode |

---

### Test 2-7: CTX-17 Duplicate User Messages

| Field | Value |
|-------|-------|
| **Test ID** | CTX-17 |
| **Test Name** | Duplicate User Messages |
| **Mode** | general-knowledge |
| **Payload** | `{ messages: [{ user: Q1 }, { user: Q2 }, { user: Q3 }] }` (3 consecutive user) |
| **Expected Behavior** | Should respond to latest user message only |
| **Validation** | Response addresses Q3 or combines all three |
| **Pass Criteria** | Doesn't crash; generates one coherent response |
| **Real Data** | General knowledge mode |

---

### Test 2-8: CTX-18 Multiple User Messages in One Field

| Field | Value |
|-------|-------|
| **Test ID** | CTX-18 |
| **Test Name** | Multiple Questions in Single Message |
| **Mode** | sales-coach |
| **Payload** | `{ messages: [{ role: "user", content: "Q1?\n\nQ2?\n\nQ3?" }] }` |
| **Expected Behavior** | Should address all questions or focus on first; return valid format |
| **Validation** | Response covers main questions; 4-section SC format |
| **Pass Criteria** | Valid SC response addressing the questions |
| **Real Data** | SC mode |

---

### Test 2-9: CTX-19 Thread Reset Mid-Mode

| Field | Value |
|-------|-------|
| **Test ID** | CTX-19 |
| **Test Name** | Thread Reset Mid-Mode |
| **Type** | Two sequential requests |
| **Request 1** | `{ threadId: "abc123", mode: "role-play", messages: [Q1] }` |
| **Request 2** | `{ threadId: "xyz789", mode: "role-play", messages: [Q2] }` (different thread) |
| **Expected Behavior** | Both requests should return valid responses; thread isolation OK |
| **Validation** | Both responses are valid RP format |
| **Pass Criteria** | No cross-thread contamination |
| **Real Data** | Real RP scenario |

---

### Test 2-10: CTX-20 Role-Play Without Persona Hints

| Field | Value |
|-------|-------|
| **Test ID** | CTX-20 |
| **Test Name** | Role-Play with Empty Persona |
| **Mode** | role-play |
| **Payload** | `{ mode: "role-play", ..., persona: "" }` (empty string) |
| **Expected Behavior** | Should use generic HCP voice; still return valid RP format |
| **Validation** | Response is first-person HCP without coaching |
| **Pass Criteria** | Valid generic HCP response |
| **Real Data** | RP with real disease |

---

## CATEGORY 3: STRUCTURE EDGE CASES (Tests 21-30)

### Test 3-1: STR-21 Sales-Coach Missing Single Section

| Field | Value |
|-------|-------|
| **Test ID** | STR-21 |
| **Test Name** | Sales-Coach Missing Impact Section |
| **Mode** | sales-coach |
| **Message** | `"How do we improve patient adherence?"` |
| **Validation Logic** | Check response has Challenge, Rep Approach, Impact, Suggested Phrasing |
| **Expected** | Should have all 4 sections (or error) |
| **Repair Expected** | If validation fails, repair should re-prompt for all sections |
| **Pass Criteria** | Response either valid with 4 sections OR HTTP 400 error |
| **Error Code** | `SALES_COACH_MISSING_IMPACT` (caught by validator) |

---

### Test 3-2: STR-22 Sales-Coach Missing Bullets

| Field | Value |
|-------|-------|
| **Test ID** | STR-22 |
| **Test Name** | Sales-Coach with 0-2 Bullets |
| **Mode** | sales-coach |
| **Message** | `"What is the best approach to this challenge?"` |
| **Validation Logic** | Count `•` in Rep Approach section; must have 3+ |
| **Expected** | Should have 3+ bullets or error |
| **Repair Expected** | Repair should expand bullets to 3+ with 20-35 words each |
| **Pass Criteria** | Response has ≥3 bullets with reference codes |
| **Error Code** | `SALES_COACH_INSUFFICIENT_BULLETS` |

---

### Test 3-3: STR-23 Role-Play Produces Coaching Advice

| Field | Value |
|-------|-------|
| **Test ID** | STR-23 |
| **Test Name** | Role-Play with Coaching Language |
| **Mode** | role-play |
| **Message** | `"What is your typical workflow?"` |
| **Validation Logic** | Regex check for "Challenge:", "You should", "Grade:", etc. |
| **Expected** | Should have NO coaching headers or language |
| **Pass Criteria** | Response is pure HCP voice (first-person, no meta-commentary) |
| **Error Code** | `ROLEPLAY_COACHING_LANGUAGE` |

---

### Test 3-4: STR-24 EI Missing Socratic Questions

| Field | Value |
|-------|-------|
| **Test ID** | STR-24 |
| **Test Name** | EI Missing Socratic Questions |
| **Mode** | emotional-assessment |
| **Message** | `"Reflect on this patient interaction"` |
| **Validation Logic** | Count `?` marks; must have 1+ |
| **Expected** | Should have reflective questions |
| **Pass Criteria** | Response contains 1+ Socratic questions |
| **Error Code** | `EI_NO_SOCRATIC_QUESTIONS` |

---

### Test 3-5: STR-25 EI Missing Final Reflective Question

| Field | Value |
|-------|-------|
| **Test ID** | STR-25 |
| **Test Name** | EI Ends with Period (not Question) |
| **Mode** | emotional-assessment |
| **Message** | `"What should I learn from this?"` |
| **Validation Logic** | Check if response ends with `?` or `.` |
| **Expected** | Should end with reflective question |
| **Pass Criteria** | Response ends with `?` |
| **Error Code** | `EI_NO_FINAL_QUESTION` (WARNING) |

---

### Test 3-6: STR-26 PK Missing Citations

| Field | Value |
|-------|-------|
| **Test ID** | STR-26 |
| **Test Name** | Product Knowledge without Citations |
| **Mode** | product-knowledge |
| **Message** | `"What is the clinical benefit of this therapy?"` |
| **Validation Logic** | Check for `[1]`, `[2]`, `[REF-CODE]` patterns |
| **Expected** | Should have citations for claims |
| **Pass Criteria** | Response contains valid citations |
| **Error Code** | `PK_MISSING_CITATIONS` |

---

### Test 3-7: STR-27 PK Malformed Citations

| Field | Value |
|-------|-------|
| **Test ID** | STR-27 |
| **Test Name** | Product Knowledge with Malformed Citations |
| **Mode** | product-knowledge |
| **Message** | `"Tell me about the efficacy data"` |
| **Validation Logic** | Check citation format: `[1]` or `[REF-CODE-123]` only |
| **Expected** | Citations should be well-formed |
| **Bad Examples** | `[REF-]`, `[1a]`, `[citation1]` |
| **Pass Criteria** | All citations are valid format |
| **Error Code** | `PK_MALFORMED_CITATIONS` |

---

### Test 3-8: STR-28 GK Produces Structured Output

| Field | Value |
|-------|-------|
| **Test ID** | STR-28 |
| **Test Name** | General Knowledge with Structure Headers |
| **Mode** | general-knowledge |
| **Message** | `"How does value-based care work?"` |
| **Validation Logic** | Check for `Challenge:`, `Rep Approach:`, `<coach>` |
| **Expected** | General Knowledge should NOT have these structures |
| **Pass Criteria** | Response is natural paragraphs; no headers |
| **Error Code** | `GK_HAS_COACHING_STRUCTURE` |

---

### Test 3-9: STR-29 Duplicate Coach Blocks

| Field | Value |
|-------|-------|
| **Test ID** | STR-29 |
| **Test Name** | Duplicate Coach Blocks |
| **Mode** | sales-coach |
| **Message** | `"Score this interaction"` |
| **Validation Logic** | Count `<coach>` blocks; should be exactly 1 |
| **Expected** | Only one coach block in response |
| **Pass Criteria** | Response has exactly 1 `<coach>` block |
| **Error Code** | `DUPLICATE_COACH_BLOCKS` |

---

### Test 3-10: STR-30 Paragraph Collapse

| Field | Value |
|-------|-------|
| **Test ID** | STR-30 |
| **Test Name** | Sections Run Together (No Blank Lines) |
| **Mode** | sales-coach |
| **Message** | `"What is the best approach?"` |
| **Validation Logic** | Check for `\n\n` between sections |
| **Expected** | Sections should be separated by blank lines |
| **Pass Criteria** | Response has proper section separation (`\n\n`) |
| **Error Code** | `PARAGRAPH_COLLAPSE` |

---

## TEST EXECUTION WORKFLOW

### Phase 1: Setup

1. Install Node.js dependencies
2. Configure WORKER_URL environment variable
3. Load real personas and diseases from repository files
4. Initialize test result logger

### Phase 2: Run Tests

```bash
node tests/phase3_edge_cases.js
```

### Phase 3: Validate Results

```bash
# Check pass rate
grep "TOTAL:" tests/results/phase3_summary.txt

# Expect: 28/30+ passed (93%+)
# If <28: Investigate failed tests
```

### Phase 4: Report

Results saved to:
- `tests/results/phase3_edge_cases/` (detailed test runs)
- `tests/results/phase3_summary.json` (aggregated results)
- `tests/results/phase3_summary.txt` (human-readable)

---

## EXPECTED RESULTS

| Category | Expected Pass Rate | Target | Status |
|----------|-------------------|--------|--------|
| Input Edge Cases | 10/10 (100%) | ✅ | Should pass all |
| Context Edge Cases | 10/10 (100%) | ✅ | Should pass all |
| Structure Edge Cases | 8/10 (80%) | ⚠️ | Some may fail if validators not expanded |
| **TOTAL** | **28/30+ (93%+)** | ✅ | Pass threshold |

---

## DEBUGGING FAILED TESTS

If a test fails:

1. **Check Worker Response:**
   ```bash
   curl -X POST https://my-chat-agent-v2.tonyabdelmalak.workers.dev/chat \
     -H "Content-Type: application/json" \
     -d '{"mode":"sales-coach","messages":[...]}'
   ```

2. **Review Test Output:**
   - Look for specific error code (e.g., `SC_MISSING_CHALLENGE`)
   - Check response structure
   - Verify mode-specific validation

3. **Check Worker Logs:**
   - Cloudflare Dashboard → Workers → Logs
   - Search for request ID from test output

4. **Common Issues:**
   - Rate limiting (429) → Retry test with backoff
   - Token overflow → Reduce test input length
   - Mode routing error → Verify mode key spelling
   - Validation false positive → Review validator logic

---

**END OF PHASE 3 EDGE-CASE CATALOG**
