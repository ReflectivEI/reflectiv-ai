// Local validation test for ReflectivAI worker changes
// Tests mode normalization, validation, and formatting without full worker runtime

// Copy of validateModeResponse function from worker.js
function validateModeResponse(mode, reply, coach) {
  let cleaned = reply;
  const warnings = [];
  const violations = [];

  // ROLE-PLAY: Enforce HCP-only voice, NO coaching language
  if (mode === "role-play") {
    // ───────────────── PASS 1: Detect coaching / non-HCP leakage ─────────────────
    const leakPatterns = [
      /Challenge:/i,
      /Rep Approach:/i,
      /Impact:/i,
      /Suggested Phrasing:/i,
      /Coach Guidance:/i,
      /Next-Move Planner:/i,
      /Risk Flags:/i,
      /<coach>/i,
      /\bcoaching\b/i,
      /\bsales rep\b/i,
      /\bmy approach\b/i,
      /\bhere's how you should approach\b/i,
      /\bAs your coach\b/i
    ];
    let pass1Leaks = leakPatterns.filter(p => p.test(cleaned));
    pass1Leaks.forEach(p => violations.push(`pass1_leak:${p.source}`));

    // ───────────────── PASS 2: Remove Sales Coach structural tokens ─────────────
    if (pass1Leaks.length) {
      cleaned = cleaned
        .replace(/Challenge:[\s\S]*?(?=Rep Approach:|Impact:|Suggested Phrasing:|$)/gi, '')
        .replace(/Rep Approach:[\s\S]*?(?=Impact:|Suggested Phrasing:|$)/gi, '')
        .replace(/Impact:[\s\S]*?(?=Suggested Phrasing:|$)/gi, '')
        .replace(/Suggested Phrasing:[\s\S]*$/gi, '')
        .replace(/<coach>[\s\S]*?<\/coach>/gi, '')
        .replace(/Coach Guidance:/gi, '')
        .replace(/Next-Move Planner:/gi, '')
        .replace(/Risk Flags:/gi, '')
        .trim();
    }

    // ───────────────── PASS 3: Strip meta reasoning / JSON / instructions ───────
    cleaned = cleaned
      .replace(/```[\s\S]*?```/g, '')
      .replace(/^[#>*].*$/gm, '')
      .replace(/"scores"\s*:\s*\{[\s\S]*?\}/gi, '')
      .replace(/"rationales"\s*:\s*\{[\s\S]*?\}/gi, '')
      .replace(/"worked"\s*:\s*\[[\s\S]*?\]/gi, '')
      .replace(/"improve"\s*:\s*\[[\s\S]*?\]/gi, '')
      .replace(/"feedback"\s*:\s*"[^"]*"/gi, '')
      .replace(/"rubric_version"\s*:\s*"[^"]*"/gi, '')
      .replace(/\b(as your coach|I will coach|sales coaching|rep should|you should)\b/gi, '')
      .replace(/^[\s]*[{}\[\]]+[\s]*$/gm, '')
      .trim();

    // Remove meta phrases about instructions or prompts
    cleaned = cleaned.replace(/(system prompt|instructions|format requirements)/gi, '').trim();

    // ───────────────── PASS 4: Final HCP voice check & auto-repair ──────────────
    const hcpVoiceOk = /\b(I|my|we|our|patient|clinic|practice)\b/i.test(cleaned);
    const residualCoachMarkers = leakPatterns.some(p => p.test(cleaned));
    if (!hcpVoiceOk || residualCoachMarkers) {
      violations.push('final_voice_repair');
      // Auto-repair: produce succinct neutral HCP statement fallback if too corrupted
      if (cleaned.length < 20 || residualCoachMarkers) {
        cleaned = 'I focus on clinical relevance, patient safety, and appropriate monitoring. What specific aspect would you like me to address?';
      }
    }

    // Positive signal (not a violation): first-person clinical framing
    if (/\b(I think|I prioritize|In my practice|We evaluate)\b/i.test(cleaned)) {
      warnings.push('hcp_first_person_confirmed');
    }
  }

  // SALES-COACH: Strict contract enforcement
  if (mode === "sales-coach") {
    // Detect HCP voice
    // Expanded 8 drift heuristics (reverse drift into HCP role)
    const hcpVoicePatterns = [
      /^I'm a (busy|difficult|engaged|indifferent)/i,                  // persona self-identification
      /^From my clinic's perspective/i,                                // clinic perspective framing
      /^We don't have time for/i,                                      // time pressure rejection
      /^I've got a few minutes/i,                                      // time allotment statement
      /\bIn my practice\b/i,                                           // ownership of practice
      /\bWe evaluate (patients|risk)/i,                                // evaluation workflow
      /\bI already know (that|this)\b/i,                               // prior knowledge dismissal
      /\bI don't (need|want)\b/i                                      // refusal pattern
    ];
    for (const pattern of hcpVoicePatterns) {
      if (pattern.test(cleaned)) {
        violations.push(`hcp_voice_in_sales_sim: ${pattern.source}`);
      }
    }
    // Strictly enforce 4 headers in order
    const headers = ["Challenge:", "Rep Approach:", "Impact:", "Suggested Phrasing:"];
    let lastIdx = -1;
    for (const h of headers) {
      const idx = cleaned.indexOf(h);
      if (idx < 0 || idx < lastIdx) {
        violations.push(`missing_or_misordered_header:${h}`);
      }
      lastIdx = idx;
    }
    // Rep Approach: exactly 3 bullets
    const repMatch = cleaned.match(/Rep Approach:[\s\S]*?(\n|\r|\r\n)([•\-].+?)(\n|\r|\r\n)([•\-].+?)(\n|\r|\r\n)([•\-].+?)(?=\n|\r|\r\n|Impact:)/);
    if (!repMatch) violations.push("rep_approach_wrong_bullet_count");
    // <coach> block
    const coachMatch = cleaned.match(/<coach>\s*({[\s\S]+})\s*<\/coach>/);
    if (!coachMatch) {
      violations.push("missing_coach_block");
    } else {
      try {
        const coachBlock = JSON.parse(coachMatch[1]);
        const requiredMetrics = ["empathy","clarity","compliance","discovery","objection_handling","confidence","active_listening","adaptability","action_insight","resilience"];
        for (const k of requiredMetrics) {
          if (!coachBlock.scores || typeof coachBlock.scores[k] !== "number" || coachBlock.scores[k] < 1 || coachBlock.scores[k] > 5) {
            violations.push(`missing_or_invalid_metric:${k}`);
          }
        }
        const requiredKeys = ["scores","rationales","worked","improve","feedback","rubric_version"];
        for (const k of requiredKeys) {
          if (!(k in coachBlock)) {
            violations.push(`missing_coach_key:${k}`);
          }
        }
      } catch (e) {
        violations.push("coach_json_parse_error");
      }
    }
  }

  // PRODUCT-KNOWLEDGE: Strict contract enforcement
  if (mode === "product-knowledge") {
    // At least one [n] citation
    const citationMatch = cleaned.match(/\[\d+\]/);
    if (!citationMatch) violations.push("missing_inline_citation");
    // References section
    const refMatch = cleaned.match(/References:\s*([\s\S]+)/);
    if (!refMatch) {
      violations.push("missing_references_section");
    } else {
      const refs = refMatch[1].split(/\n|\r|\r\n/).filter(l => /^\d+\. /.test(l));
      if (refs.length === 0) violations.push("references_no_numbered_entries");
      for (let i = 0; i < refs.length; i++) {
        if (!cleaned.includes(`[${i + 1}]`)) violations.push(`missing_citation_for_reference_${i + 1}`);
        if (!refs[i].match(/https?:\/\//)) violations.push(`reference_${i + 1}_missing_url`);
      }
    }
    // No sales-coach headings or <coach>
    if (/Challenge:|Rep Approach:|Impact:|Suggested Phrasing:|<coach>/i.test(cleaned)) {
      violations.push("sales_coach_headings_or_coach_block_present");
    }
  }

  // EMOTIONAL-ASSESSMENT: Verify Socratic questions
  if (mode === "emotional-assessment") {
    const questionCount = (cleaned.match(/\?/g) || []).length;
    if (questionCount === 0) {
      warnings.push("no_socratic_questions_detected");
    } else if (questionCount >= 2) {
      warnings.push(`socratic_questions_present: ${questionCount}`);
    }
  }

  return { reply: cleaned, warnings, violations };
}

// Mock environment
const mockEnv = {
  PROVIDER_KEY: 'test',
  CORS_ORIGINS: 'https://reflectivei.github.io'
};

// Test data
const testCases = [
  {
    mode: 'sales-coach',
    reply: `Challenge: The HCP may not be prioritizing PrEP prescriptions due to lack of awareness about substantial risk.

Rep Approach:
• Discuss the importance of assessing sexual and injection risk factors to identify individuals at substantial risk of HIV, as recommended for PrEP eligibility [HIV-PREP-ELIG-001].
• Highlight the efficacy and safety profile of Descovy for PrEP, excluding receptive vaginal sex, as indicated in the FDA label [HIV-PREP-TAF-002].
• Emphasize the need for renal function assessment before and during PrEP, considering eGFR thresholds per the FDA label [HIV-PREP-SAFETY-003].

Impact: By emphasizing risk assessment, Descovy benefits, and renal monitoring, the HCP will prioritize PrEP for at-risk patients.

Suggested Phrasing: "Given the substantial risk of HIV in certain patient populations, I recommend we discuss how to identify and assess these individuals for PrEP eligibility, and consider Descovy as a safe and effective option."

<coach>{"scores":{"empathy":4,"clarity":4,"compliance":4,"discovery":4,"objection_handling":3,"confidence":4,"active_listening":4,"adaptability":4,"action_insight":4,"resilience":4},"rationales":{"empathy":"Good listening skills"},"worked":["Clear structure","Evidence-based"],"improve":["More discovery questions"],"feedback":"Good job","rubric_version":"1.0"}</coach>`,
    coach: { scores: { empathy: 4 } },
    expected: { violations: [], warnings: [] }
  },
  {
    mode: 'role-play',
    reply: 'In my practice, I prioritize patient safety and clinical evidence. We evaluate new treatments carefully.',
    coach: {},
    expected: { violations: [], warnings: ['hcp_first_person_confirmed'] }
  },
  {
    mode: 'sales-coach',
    reply: `I'm a busy HCP who doesn't have time for new protocols.

Challenge: HCP resistance to change
Rep Approach:
• Build trust
• Show evidence
• Address concerns
Impact: Better adoption
Suggested Phrasing: "Consider this approach..."

<coach>{"scores":{"empathy":4,"clarity":4,"compliance":4,"discovery":4,"objection_handling":3,"confidence":4,"active_listening":4,"adaptability":4,"action_insight":4,"resilience":4},"rationales":{"empathy":"Good listening"},"worked":["Clear structure"],"improve":["More detail"],"feedback":"Good job","rubric_version":"1.0"}</coach>`,
    coach: {},
    expected: { violations: ['hcp_voice_in_sales_sim: /^I\'m a (busy|difficult|engaged|indifferent)/i'], warnings: [] }
  },
  {
    mode: 'product-knowledge',
    reply: `The medication is effective [1]. Studies show benefits [2].

References:
1. Study 2023 - https://example.com/study1
2. Analysis 2024 - https://example.com/study2`,
    coach: {},
    expected: { violations: [], warnings: [] }
  },
  {
    mode: 'emotional-assessment',
    reply: 'How are you feeling about this change? What concerns do you have? Have you thought about the impact?',
    coach: {},
    expected: { violations: [], warnings: ['socratic_questions_present: 3'] }
  },
  {
    mode: 'role-play',
    reply: 'As your coach, I recommend you focus on building rapport first.',
    coach: {},
    expected: { violations: ['pass1_leak:\\bAs your coach\\b'], warnings: [] }
  }
];

console.log('🧪 Local Validation Tests for ReflectivAI Worker Changes\n');

let passed = 0;
let total = testCases.length;

testCases.forEach((test, i) => {
  console.log(`Test ${i + 1}: ${test.mode} mode`);
  try {
    const result = validateModeResponse(test.mode, test.reply, test.coach);
    const violationsMatch = result.violations.length === test.expected.violations.length &&
      result.violations.every(v => test.expected.violations.some(e => v.includes(e.split(':')[0])));
    const warningsMatch = result.warnings.length === test.expected.warnings.length;

    if (violationsMatch && warningsMatch) {
      console.log('  ✅ PASSED');
      passed++;
    } else {
      console.log('  ❌ FAILED');
      console.log('    Expected violations:', test.expected.violations);
      console.log('    Actual violations:', result.violations);
      console.log('    Expected warnings:', test.expected.warnings);
      console.log('    Actual warnings:', result.warnings);
    }
  } catch (e) {
    console.log('  ❌ ERROR:', e.message);
  }
  console.log('');
});

console.log(`Results: ${passed}/${total} tests passed`);

if (passed === total) {
  console.log('🎉 All validation tests passed! Ready for deployment review.');
} else {
  console.log('⚠️  Some tests failed. Review and fix before deployment.');
}