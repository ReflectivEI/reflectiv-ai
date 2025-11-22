# PHASE 3 VALIDATOR EXPANSION SPECIFICATION

**Document:** Backend Validator Enhancement for Edge-Case Detection  
**Target:** worker.js validateResponseContract() function  
**Scope:** Lines 702-885 (with extensions to ~950)  
**Status:** SPECIFICATION (Ready for Implementation)

---

## EXECUTIVE SUMMARY

Current validateResponseContract() detects major format violations but misses subtle structural hazards:
- Paragraph collapse (sections without blank lines)
- Missing line breaks within sections
- Truncated mid-section (cut off by token limit)
- Duplicate metrics in coach block
- Citation format inconsistencies (PK mode)
- Malformed Socratic questions (EI mode)

PHASE 3 expands validator with 10 new detection rules and 2 enhanced repair strategies.

---

## 1. NEW DETECTION RULES BY MODE

### 1.1 SALES-COACH Mode Enhancements

#### Rule SC-01: Paragraph Separation Validation
**Current:** No check  
**New Check:** Verify blank lines (\\n\\n) between major sections

```javascript
// NEW: Lines ~730-750 (after section detection)
function validateParagraphSeparation(replyText) {
  const errors = [];
  const sections = [
    { name: 'Challenge', pattern: /Challenge:/i },
    { name: 'Rep Approach', pattern: /Rep Approach:/i },
    { name: 'Impact', pattern: /Impact:/i },
    { name: 'Suggested Phrasing', pattern: /Suggested Phrasing:/i }
  ];
  
  for (let i = 0; i < sections.length - 1; i++) {
    const current = sections[i];
    const next = sections[i + 1];
    
    if (current.pattern.test(replyText) && next.pattern.test(replyText)) {
      // Extract text between current and next section
      const between = replyText.split(current.pattern)[1]?.split(next.pattern)[0] || '';
      
      // Check for blank line separator (at least one \n\n)
      if (!/\n\n/.test(between)) {
        errors.push(`SC_NO_SECTION_SEPARATION: ${current.name} → ${next.name}`);
      }
    }
  }
  
  return errors;
}
```

**Error Code:** `SC_NO_SECTION_SEPARATION`  
**Severity:** WARNING → ERROR (can be auto-repaired)  
**Repair Strategy:** Insert \\n\\n between sections

---

#### Rule SC-02: Bullet Minimum Word Count
**Current:** Only checks count (3+ bullets)  
**New Check:** Each bullet should be 20-35 words (minimum 15)

```javascript
// NEW: Lines ~760-785
function validateBulletContent(replyText) {
  const errors = [];
  const warnings = [];
  
  const repMatch = replyText.match(/Rep Approach:\s*([\s\S]*?)(?=Impact:|$)/i);
  if (!repMatch) return { errors, warnings };
  
  const bullets = repMatch[1].split(/\n/).filter(l => /^\s*•/.test(l));
  
  bullets.forEach((bullet, idx) => {
    const text = bullet.replace(/^\s*•\s*/, '').trim();
    const wordCount = text.split(/\s+/).length;
    
    if (wordCount < 15) {
      errors.push(`SC_BULLET_TOO_SHORT: Bullet ${idx + 1} is ${wordCount} words (min 15)`);
    } else if (wordCount < 20) {
      warnings.push(`SC_BULLET_INSUFFICIENT: Bullet ${idx + 1} is ${wordCount} words (recommend 20+)`);
    }
    
    // Check for reference code
    if (!/\[[\w-]+\]/.test(text)) {
      errors.push(`SC_BULLET_MISSING_REF: Bullet ${idx + 1} has no reference code`);
    }
  });
  
  return { errors, warnings };
}
```

**Error Codes:** `SC_BULLET_TOO_SHORT`, `SC_BULLET_MISSING_REF`  
**Severity:** ERROR (require repair)  
**Repair Strategy:** Re-prompt LLM to expand bullets

---

#### Rule SC-03: Duplicate Metrics Detection
**Current:** Checks if metrics present; doesn't detect duplicates  
**New Check:** Ensure each of 10 metrics appears exactly once

```javascript
// NEW: Lines ~800-830
function validateMetricUniqueness(coachData) {
  const errors = [];
  const requiredMetrics = [
    "empathy", "clarity", "compliance", "discovery",
    "objection_handling", "confidence", "active_listening",
    "adaptability", "action_insight", "resilience"
  ];
  
  if (!coachData || !coachData.scores) return errors;
  
  const scores = coachData.scores;
  const metricsPresent = Object.keys(scores);
  
  // Check for duplicate keys (shouldn't happen in JS object, but could in raw JSON)
  const duplicates = requiredMetrics.filter(m => metricsPresent.filter(p => p === m).length > 1);
  if (duplicates.length > 0) {
    errors.push(`SC_DUPLICATE_METRICS: ${duplicates.join(", ")}`);
  }
  
  // Check for unexpected extra metrics
  const extra = metricsPresent.filter(m => !requiredMetrics.includes(m));
  if (extra.length > 0) {
    errors.push(`SC_EXTRA_METRICS: ${extra.join(", ")} (should be exactly 10)`);
  }
  
  return errors;
}
```

**Error Code:** `SC_DUPLICATE_METRICS`, `SC_EXTRA_METRICS`  
**Severity:** ERROR (auto-correctable via repair)  
**Repair Strategy:** Re-prompt to regenerate metrics correctly

---

### 1.2 ROLE-PLAY Mode Enhancements

#### Rule RP-01: First-Person Consistency Check
**Current:** Checks for coaching language only  
**New Check:** Ensure response maintains first-person perspective throughout

```javascript
// NEW: Lines ~850-880
function validateFirstPersonConsistency(replyText) {
  const errors = [];
  const warnings = [];
  
  // Extract sentences
  const sentences = replyText.match(/[^.!?]+[.!?]/g) || [];
  
  const firstPersonMarkers = /\b(I|we|my|me|our)\b/i;
  const secondPersonMarkers = /\b(you|your|yourself)\b/i;
  const thirdPersonMarkers = /\b(the|a|this|that)\s+(rep|rep|provider|doc|physician|clinic)/i;
  
  let hasFirstPerson = false;
  let hasSecondPerson = false;
  let hasThirdPerson = false;
  
  sentences.forEach((sentence, idx) => {
    if (firstPersonMarkers.test(sentence)) hasFirstPerson = true;
    if (secondPersonMarkers.test(sentence) && !/\?\s*$/.test(sentence)) { // Q&As OK
      hasSecondPerson = true;
      warnings.push(`RP_SECOND_PERSON: Sentence ${idx + 1} contains "you"`);
    }
    if (thirdPersonMarkers.test(sentence)) {
      hasThirdPerson = true;
      errors.push(`RP_THIRD_PERSON: Sentence ${idx + 1} is narrator voice`);
    }
  });
  
  // Response should be predominantly first-person
  const firstPersonCount = replyText.match(/\bI\s|we\s/gi)?.length || 0;
  if (firstPersonCount === 0 && sentences.length > 2) {
    errors.push(`RP_NO_FIRST_PERSON: Response lacks "I" or "we" markers`);
  }
  
  return { errors, warnings };
}
```

**Error Codes:** `RP_THIRD_PERSON`, `RP_NO_FIRST_PERSON`  
**Severity:** ERROR (high fidelity requirement)  
**Repair Strategy:** Multi-pass rewrite (currently in widget.js; move to worker)

---

#### Rule RP-02: Ultra-Long Monologue Detection
**Current:** No length check  
**New Check:** Flag if single response >300 words without natural pauses

```javascript
// NEW: Lines ~890-910
function validateResponseLength(replyText, mode) {
  const warnings = [];
  
  const wordCount = replyText.split(/\s+/).length;
  const sentences = (replyText.match(/[.!?]+/g) || []).length;
  const avgWordsPerSentence = wordCount / Math.max(sentences, 1);
  
  if (mode === 'role-play') {
    if (wordCount > 300) {
      warnings.push(`RP_LONG_RESPONSE: ${wordCount} words (typically 50-150 for HCP)`);
    }
    if (avgWordsPerSentence > 25) {
      warnings.push(`RP_LONG_SENTENCES: Average ${avgWordsPerSentence.toFixed(1)} words/sentence (prefer <20)`);
    }
  }
  
  return warnings;
}
```

**Error Code:** `RP_LONG_RESPONSE` (WARNING)  
**Severity:** WARNING (non-blocking)

---

### 1.3 EMOTIONAL-ASSESSMENT Mode Enhancements

#### Rule EI-01: Socratic Question Quality
**Current:** Counts `?` marks only  
**New Check:** Ensure questions are reflective, not rhetorical or closed-ended

```javascript
// NEW: Lines ~920-960
function validateSocraticQuality(replyText) {
  const errors = [];
  const warnings = [];
  
  // Extract sentences ending with ?
  const questions = replyText.match(/[^.!?]*\?/g) || [];
  
  if (questions.length === 0) {
    errors.push('EI_NO_SOCRATIC_QUESTIONS');
    return { errors, warnings };
  }
  
  const socraticKeywords = /what|how|why|which|where|when|who|might|could|would|notice|observe|reflect/i;
  
  let goodQuestions = 0;
  questions.forEach((q, idx) => {
    // Check if it's actually reflective (not just factual "Is this true?")
    if (socraticKeywords.test(q)) {
      goodQuestions++;
    } else {
      warnings.push(`EI_YES_NO_QUESTION: Question ${idx + 1} is closed-ended (consider Socratic)`);
    }
  });
  
  if (goodQuestions === 0) {
    errors.push('EI_NO_REFLECTIVE_QUESTIONS: Questions are not Socratic');
  }
  
  return { errors, warnings };
}
```

**Error Code:** `EI_NO_REFLECTIVE_QUESTIONS`  
**Severity:** ERROR (defines EI mode)

---

#### Rule EI-02: Framework Depth Validation
**Current:** Regex test for keywords  
**New Check:** Ensure framework is substantively integrated, not just mentioned

```javascript
// NEW: Lines ~970-1010
function validateFrameworkDepth(replyText) {
  const errors = [];
  const warnings = [];
  
  // Framework concepts that should be discussed substantively
  const frameworkConcepts = {
    'CASEL': /CASEL|competencies?|self-awareness|self-management|responsible decision|relationship|social/i,
    'Triple-Loop': /triple.?loop|loop\s1|loop\s2|loop\s3|task outcome|regulation|mindset/i,
    'Metacognition': /metacognition|metacognitive|self-monitor|pattern|reflection|belief/i,
    'Emotional Regulation': /regulat|stress|tension|pause|breath|ground|calm/i
  };
  
  const referencedConcepts = Object.entries(frameworkConcepts).filter(
    ([name, pattern]) => pattern.test(replyText)
  );
  
  if (referencedConcepts.length === 0) {
    errors.push('EI_NO_FRAMEWORK_REFERENCE');
  } else if (referencedConcepts.length === 1) {
    // Only one concept mentioned - ensure it's substantive
    const conceptLength = replyText.length;
    if (conceptLength < 300) {
      warnings.push(`EI_SHALLOW_FRAMEWORK: Only ${referencedConcepts[0][0]} mentioned; consider deeper integration`);
    }
  }
  
  // Check that concepts aren't just in title/opening
  const firstThird = replyText.substring(0, replyText.length / 3);
  const restOfText = replyText.substring(replyText.length / 3);
  const conceptsInBody = referencedConcepts.filter(([name, pattern]) => pattern.test(restOfText));
  
  if (conceptsInBody.length < referencedConcepts.length) {
    warnings.push('EI_FRAMEWORK_ONLY_IN_INTRO: Framework concepts mentioned early but not reinforced');
  }
  
  return { errors, warnings };
}
```

**Error Code:** `EI_NO_FRAMEWORK_REFERENCE`, `EI_SHALLOW_FRAMEWORK` (WARNING)  
**Severity:** ERROR (required for EI mode) / WARNING (quality)

---

### 1.4 PRODUCT-KNOWLEDGE Mode Enhancements

#### Rule PK-01: Citation Completeness & Format
**Current:** Just checks if citations present  
**New Check:** Validate citation format consistency and per-claim coverage

```javascript
// NEW: Lines ~1030-1080
function validateCitationFormat(replyText) {
  const errors = [];
  const warnings = [];
  
  // Find all citations
  const citations = replyText.match(/\[\d+\]|\[[A-Z]+-[A-Z]+-\d+\]/g) || [];
  
  if (citations.length === 0) {
    errors.push('PK_MISSING_CITATIONS');
    return { errors, warnings };
  }
  
  // Check for malformed citations
  const malformedCitations = replyText.match(/\[[^\]]*\]/g) || [];
  const malformed = malformedCitations.filter(c => {
    return !/^\[\d+\]$/.test(c) && !/^\[[A-Z]+-[A-Z]+-\d+\]$/.test(c);
  });
  
  if (malformed.length > 0) {
    errors.push(`PK_MALFORMED_CITATIONS: ${malformed.slice(0, 3).join(', ')}`);
  }
  
  // Check for consistency (all numeric or all REF-CODE)
  const numericCitations = citations.filter(c => /^\[\d+\]$/.test(c));
  const refCodeCitations = citations.filter(c => /^\[[A-Z]+-[A-Z]+-\d+\]$/.test(c));
  
  if (numericCitations.length > 0 && refCodeCitations.length > 0) {
    warnings.push('PK_MIXED_CITATION_FORMATS: Some citations are [1] and others are [REF-CODE]');
  }
  
  // Check for citation gaps (claims without citations)
  const claimPatterns = [
    /\b(effective|efficacy|shows|demonstrates|proven|FDA|approved|indicated|benefits?|superior|advantage)\b/i,
    /\b(side effect|adverse|complication|risk|contraindication|monitoring)\b/i,
    /\b(mechanism|pathway|molecular|targets?|inhibits?|blocks?)\b/i
  ];
  
  const sentences = replyText.match(/[^.!?]+[.!?]/g) || [];
  let claimsWithoutCitations = 0;
  
  sentences.forEach((sentence, idx) => {
    const hasClaim = claimPatterns.some(p => p.test(sentence));
    const hasCitation = /\[\d+\]|\[[A-Z]+-[A-Z]+-\d+\]/.test(sentence);
    
    if (hasClaim && !hasCitation) {
      claimsWithoutCitations++;
    }
  });
  
  if (claimsWithoutCitations > 0) {
    errors.push(`PK_CLAIMS_WITHOUT_CITATIONS: ${claimsWithoutCitations} scientific claims lack citations`);
  }
  
  return { errors, warnings };
}
```

**Error Codes:** `PK_MISSING_CITATIONS`, `PK_MALFORMED_CITATIONS`, `PK_CLAIMS_WITHOUT_CITATIONS`  
**Severity:** ERROR (regulatory requirement for PK)

---

#### Rule PK-02: Off-Label Contextualization
**Current:** Requires "explicitly stated" if off-label mentioned  
**New Check:** Enhanced context detection for incomplete contextualization

```javascript
// NEW: Lines ~1090-1130
function validateOffLabelContext(replyText) {
  const errors = [];
  const warnings = [];
  
  const offLabelIndicators = /off.?label|unapproved|not.?indicated|outside.?FDA|beyond.?indication|off-indication/i;
  
  if (!offLabelIndicators.test(replyText)) {
    return { errors, warnings }; // No off-label mention
  }
  
  // Off-label mentioned - check for proper contextualization
  const contextPatterns = [
    /explicitly.?(state|approv|indicate)/i,
    /not.?recommended|not.?indicated|contraindicated/i,
    /outside.?FDA|beyond.?label|off.?label|unapproved/i,
    /clinical.?judgment|provider.?discretion|individualized|case.?by.?case/i
  ];
  
  const hasContext = contextPatterns.some(p => p.test(replyText));
  
  if (!hasContext) {
    errors.push('PK_OFFABEL_NOT_CONTEXTUALIZED: Off-label use mentioned without proper context');
  }
  
  // Extract off-label segment and check its length
  const offLabelMatch = replyText.match(/[^.!?]*off.?label[^.!?]*[.!?]/i);
  if (offLabelMatch && offLabelMatch[0].length < 50) {
    warnings.push('PK_BRIEF_OFFABEL_CONTEXT: Off-label discussion is brief; consider expansion');
  }
  
  return { errors, warnings };
}
```

**Error Code:** `PK_OFFABEL_NOT_CONTEXTUALIZED`  
**Severity:** ERROR (compliance requirement)

---

### 1.5 GENERAL-KNOWLEDGE Mode Enhancements

#### Rule GK-01: Structure Leakage Detection
**Current:** Detects major headers; misses subtle leakage  
**New Check:** Detect RP "In my clinic..." voice, SC "Challenge:" anywhere

```javascript
// NEW: Lines ~1150-1190
function validateGKStructureLeakage(replyText) {
  const errors = [];
  const warnings = [];
  
  // Check for Role-Play voice leakage
  const rpVoicePatterns = [
    /\bIn my (?:clinic|practice|office|hospital|setting|experience|workflow)\b/i,
    /\b(?:I usually|I typically|I always|I generally) (?:start|begin|recommend)/i,
    /\b(?:I would|I\d recommend)\b/i // "I'd recommend"
  ];
  
  // First sentence check (RP often starts with "In my clinic...")
  const firstSentence = replyText.split(/[.!?]/)[0];
  if (rpVoicePatterns.some(p => p.test(firstSentence)) && replyText.split(/\n/).length < 3) {
    errors.push('GK_ROLEPLAY_VOICE_LEAKAGE: Sounds like HCP first-person (RP contamination)');
  }
  
  // Check for Sales Coach structure anywhere in response
  const scStructurePatterns = [
    /^Challenge:/im,
    /\nChallenge:/m,
    /^Rep Approach:/im,
    /^Impact:/im,
    /^Suggested Phrasing:/im
  ];
  
  if (scStructurePatterns.some(p => p.test(replyText))) {
    errors.push('GK_SALES_COACH_STRUCTURE: Contains Sales Coach format headers');
  }
  
  // Check for coach blocks (should not exist in GK)
  if (/<coach>/i.test(replyText)) {
    errors.push('GK_HAS_COACH_BLOCK: General Knowledge should not include coach scoring');
  }
  
  return { errors, warnings };
}
```

**Error Codes:** `GK_ROLEPLAY_VOICE_LEAKAGE`, `GK_SALES_COACH_STRUCTURE`, `GK_HAS_COACH_BLOCK`  
**Severity:** ERROR (define GK vs other modes)

---

## 2. ENHANCED REPAIR STRATEGIES

### 2.1 Repair Strategy for Sales-Coach Paragraph Collapse

**Trigger:** `SC_NO_SECTION_SEPARATION` error

**Implementation:** Lines ~1200-1250 in postChat() repair block

```javascript
// ENHANCED REPAIR: After initial repair attempt fails, try targeted fix
if (!finalValidation.valid && mode === 'sales-coach') {
  const paragraphErrors = finalValidation.errors.filter(e => e.includes('SEPARATION'));
  
  if (paragraphErrors.length > 0) {
    // Simple regex-based fix: add blank lines between sections
    let repaired = reply;
    repaired = repaired.replace(/(Challenge:[^\n]*)\n(Rep Approach:)/g, '$1\n\n$2');
    repaired = repaired.replace(/(Rep Approach:[\s\S]*?)\n(Impact:)/g, '$1\n\n$2');
    repaired = repaired.replace(/(Impact:[^\n]*)\n(Suggested Phrasing:)/g, '$1\n\n$2');
    
    // Re-validate paragraphed version
    const paragraphValidation = validateResponseContract(mode, repaired, coachObj);
    if (paragraphValidation.valid) {
      console.info('response_paragraph_repair_successful', { req_id: reqId });
      reply = repaired;
      finalValidation = paragraphValidation;
    }
  }
}
```

---

### 2.2 Repair Strategy for Bullet Expansion

**Trigger:** `SC_BULLET_TOO_SHORT` error

**Implementation:** Lines ~1260-1320 in postChat() repair block

```javascript
// ENHANCED REPAIR: Expand short bullets
if (!finalValidation.valid && mode === 'sales-coach') {
  const bulletErrors = finalValidation.errors.filter(e => e.includes('BULLET'));
  
  if (bulletErrors.length > 0 && retryCount === 0) {
    const bulletRepairPrompt = `Your Rep Approach bullets are too brief. REGENERATE with expanded bullets:
    
Each bullet must be 20-35 words. Current bullets:
${reply.match(/Rep Approach:\s*([\s\S]*?)(?=Impact:|$)/i)?.[1]}

Rewrite as 20-35 word bullets, each with a [FACT-ID] reference.`;
    
    try {
      const expandedRaw = await providerChat(env, 
        [...messages.slice(0, -1), { role: 'user', content: bulletRepairPrompt }],
        { maxTokens: 800, temperature: 0.2, session }
      );
      
      const { coach: expandedCoach, clean: expandedClean } = extractCoach(expandedRaw);
      const expandedValidation = validateResponseContract(mode, expandedClean, expandedCoach);
      
      if (expandedValidation.valid) {
        reply = expandedClean;
        coachObj = expandedCoach || coachObj;
        finalValidation = expandedValidation;
      }
    } catch (_) { }
  }
}
```

---

## 3. PERFORMANCE & BACKWARDS COMPATIBILITY

### 3.1 Performance Requirements

- **Time:** Each validation function must complete in <10ms
- **Memory:** No large object allocations
- **Regex:** Pre-compile patterns or cache results

**Implementation:**

```javascript
// At module level, pre-compile regex
const REGEX_CACHE = {
  rpVoicePatterns: [
    /\bIn my (?:clinic|practice|office|hospital|setting|experience|workflow)\b/i,
    /\b(?:I usually|I typically|I always|I generally) (?:start|begin|recommend)/i
  ],
  citationPattern: /\[\d+\]|\[[A-Z]+-[A-Z]+-\d+\]/g,
  // ... other patterns
};

// In validators, use cache instead of creating inline
if (REGEX_CACHE.rpVoicePatterns.some(p => p.test(sentence))) { ... }
```

---

### 3.2 Backwards Compatibility

**Rule:** All new validations are **warnings first, errors later**

```javascript
// All new detections output to warnings[] initially
return {
  valid: errors.length === 0,  // Only old errors block response
  errors: errors,              // Existing critical errors
  warnings: [...oldWarnings, ...newWarnings],  // New checks here
  mode
};
```

**Phase-In Schedule:**
- **Week 1:** All new checks in warnings only
- **Week 2:** Non-breaking checks become errors (SC_DUPLICATE_METRICS)
- **Week 3:** All checks enforced

---

## 4. IMPLEMENTATION CHECKLIST

- [ ] Add Rule SC-01: Paragraph Separation
- [ ] Add Rule SC-02: Bullet Content Validation
- [ ] Add Rule SC-03: Metric Uniqueness
- [ ] Add Rule RP-01: First-Person Consistency
- [ ] Add Rule RP-02: Monologue Detection
- [ ] Add Rule EI-01: Socratic Quality
- [ ] Add Rule EI-02: Framework Depth
- [ ] Add Rule PK-01: Citation Format
- [ ] Add Rule PK-02: Off-Label Context
- [ ] Add Rule GK-01: Structure Leakage
- [ ] Implement enhanced repair for paragraph collapse
- [ ] Implement enhanced repair for bullet expansion
- [ ] Pre-compile all regex patterns
- [ ] Performance test (<10ms per validation)
- [ ] Update PHASE 3 test suite to exercise all rules
- [ ] Create PHASE3_VALIDATOR_TEST_RESULTS.md

---

**END OF VALIDATOR EXPANSION SPECIFICATION**
