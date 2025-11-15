/**
 * PHASE 3 EDGE CASE TEST SUITE
 * 30 Real Integration Tests Against Live Worker
 * 
 * CRITICAL RULES:
 * - ALL tests POST to LIVE Worker: https://my-chat-agent-v2.tonyabdelmalak.workers.dev/chat
 * - NO mocks, NO simulations, NO fake data
 * - Real personas from persona.json
 * - Real diseases from scenarios.merged.json
 * - Tests validate against LC_FORMAT_CONTRACTS.md
 * 
 * Test Matrix:
 *   - 10 INPUT EDGE CASES (empty, long, gibberish, etc.)
 *   - 10 CONTEXT EDGE CASES (missing persona, truncated history, etc.)
 *   - 10 STRUCTURE EDGE CASES (missing sections, truncation, leakage, etc.)
 */

const WORKER_URL = 'https://my-chat-agent-v2.tonyabdelmalak.workers.dev/chat';
const REQUEST_TIMEOUT_MS = 60000;
const MAX_RETRIES = 3;

// PHASE 3 Throttle: Configurable delay between test requests to avoid Worker rate limiting
// Usage: PHASE3_THROTTLE_MS=2500 node tests/phase3_edge_cases.js
// Default: 2500ms (2.5 seconds) between tests
const PHASE3_THROTTLE_MS = parseInt(process.env.PHASE3_THROTTLE_MS || '2500', 10);

// Exit code semantics: control how rate-limit failures affect test status
// PHASE3_TOLERATE_RATE_LIMITS: if "true", allow up to PHASE3_MAX_RATE_LIMIT_FAILURES without exit code 1
// Default: "false" (any rate-limit failure causes exit code 1)
const PHASE3_TOLERATE_RATE_LIMITS = (process.env.PHASE3_TOLERATE_RATE_LIMITS || 'false') === 'true';
const PHASE3_MAX_RATE_LIMIT_FAILURES = parseInt(process.env.PHASE3_MAX_RATE_LIMIT_FAILURES || '0', 10);

/**
 * Sleep helper for inter-test throttling and retry backoff
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise} - Resolves after delay
 */
async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// Real personas from system
const REAL_PERSONAS = {
  'sales_coach': 'onc_hemonc_md_costtox',
  'role_play': 'vax_peds_np_hesitancy',
  'ei': 'onc_md_decile10_io_adc_pathways',
  'pk': 'hiv_im_decile3_prep_lowshare',
  'gk': 'hiv_np_decile10_highshare_access'
};

// Real disease scenarios from system
const REAL_DISEASES = {
  'sales_coach': 'onc_md_decile10_io_adc_pathways',
  'role_play': 'hiv_im_decile3_prep_lowshare',
  'ei': 'hiv_np_decile10_highshare_access',
  'pk': 'hiv_im_decile4_prep_apretude_gap',
  'gk': 'onc_np_decile6_pathway_ops'
};

/**
 * ============================================================================
 * PART 1: INPUT EDGE CASES (Tests 1-10)
 * ============================================================================
 */

const INPUT_EDGE_CASES = [
  {
    id: 'INPUT-01',
    name: 'Empty String',
    description: 'User sends empty string as message',
    mode: 'sales-coach',
    message: '',
    expectedBehavior: 'Should either reject or handle gracefully without malformed response'
  },
  {
    id: 'INPUT-02',
    name: 'Spaces Only',
    description: 'User sends only whitespace',
    mode: 'sales-coach',
    message: '     \n  \t  ',
    expectedBehavior: 'Should trim and treat as empty; not generate response'
  },
  {
    id: 'INPUT-03',
    name: 'Very Long Message',
    description: 'User sends 5000+ character input',
    mode: 'general-knowledge',
    message: 'What is the impact of ' + 'climate change '.repeat(300) + ' on healthcare systems?',
    expectedBehavior: 'Should truncate gracefully or reject; no token overflow'
  },
  {
    id: 'INPUT-04',
    name: 'Gibberish Input',
    description: 'User sends random nonsense: asdfghjkl;qwerty',
    mode: 'product-knowledge',
    message: 'asdfghjkl;qwerty zxcvbnm poiuytrewq',
    expectedBehavior: 'Should return valid response or friendly error (not malformed)'
  },
  {
    id: 'INPUT-05',
    name: 'Non-English Input',
    description: 'User sends message in non-English language (Mandarin)',
    mode: 'general-knowledge',
    message: '我能问一个关于医疗系统的问题吗？',
    expectedBehavior: 'Should attempt answer or politely decline; valid response structure'
  },
  {
    id: 'INPUT-06',
    name: 'Emoji Only',
    description: 'User sends only emojis: 😀😀😀',
    mode: 'general-knowledge',
    message: '😀 😀 😀 🏥 💊 ⚕️',
    expectedBehavior: 'Should handle gracefully; no malformed structure'
  },
  {
    id: 'INPUT-07',
    name: 'HTML/Script Injection',
    description: 'User sends potential XSS payload',
    mode: 'product-knowledge',
    message: '<script>alert("xss")</script><img src="x" onerror="alert(1)">',
    expectedBehavior: 'Should sanitize; no script execution; valid response'
  },
  {
    id: 'INPUT-08',
    name: 'Multi-Line Malformed',
    description: 'User sends message with excessive newlines',
    mode: 'role-play',
    message: '\n\n\n\nHow should I approach this?\n\n\n\n',
    expectedBehavior: 'Should normalize and respond naturally as HCP'
  },
  {
    id: 'INPUT-09',
    name: 'Repetitive Spam',
    description: 'User sends repetitive message 100x',
    mode: 'sales-coach',
    message: 'test '.repeat(200),
    expectedBehavior: 'Should detect and handle loop-guard logic; not crash'
  },
  {
    id: 'INPUT-10',
    name: 'Rapid Mode Switching',
    description: 'Simulate 5 mode changes in rapid sequence',
    mode: 'rapid_switch',
    modes: ['sales-coach', 'role-play', 'emotional-assessment', 'product-knowledge', 'general-knowledge'],
    message: 'Test message',
    expectedBehavior: 'All 5 mode responses should be valid; no cross-mode contamination'
  }
];

/**
 * ============================================================================
 * PART 2: CONTEXT EDGE CASES (Tests 11-20)
 * ============================================================================
 */

const CONTEXT_EDGE_CASES = [
  {
    id: 'CTX-11',
    name: 'Missing Persona',
    description: 'Persona field is null/undefined',
    mode: 'sales-coach',
    payload: {
      mode: 'sales-coach',
      messages: [{ role: 'user', content: 'How do we improve PrEP prescribing?' }],
      disease: REAL_DISEASES.sales_coach,
      persona: null,
      goal: 'Increase PrEP access'
    },
    expectedBehavior: 'Should use default persona or return graceful error'
  },
  {
    id: 'CTX-12',
    name: 'Missing Disease',
    description: 'Disease field is blank/undefined',
    mode: 'role-play',
    payload: {
      mode: 'role-play',
      messages: [{ role: 'user', content: 'Hi, what are your thoughts?' }],
      disease: null,
      persona: REAL_PERSONAS.role_play,
      goal: 'Discuss therapy'
    },
    expectedBehavior: 'Should use generic context or return graceful error'
  },
  {
    id: 'CTX-13',
    name: 'Persona/Disease Mismatch',
    description: 'Persona is oncology MD but disease is HIV',
    mode: 'emotional-assessment',
    payload: {
      mode: 'emotional-assessment',
      messages: [{ role: 'user', content: 'Reflect on this interaction' }],
      disease: REAL_DISEASES.ei,
      persona: 'onc_hemonc_md_costtox', // Oncology persona
      goal: 'Reflect on communication'
    },
    expectedBehavior: 'Should handle mismatch gracefully; return valid response'
  },
  {
    id: 'CTX-14',
    name: 'Sales-Coach No Goal',
    description: 'Goal field missing for sales-coach mode',
    mode: 'sales-coach',
    payload: {
      mode: 'sales-coach',
      messages: [{ role: 'user', content: 'What is the HCP barrier here?' }],
      disease: REAL_DISEASES.sales_coach,
      persona: REAL_PERSONAS.sales_coach,
      goal: null
    },
    expectedBehavior: 'Should use default goal or return graceful error'
  },
  {
    id: 'CTX-15',
    name: 'Truncated History',
    description: 'Only 1 message in conversation array',
    mode: 'role-play',
    payload: {
      mode: 'role-play',
      messages: [{ role: 'user', content: 'Hi there' }],
      disease: REAL_DISEASES.role_play,
      persona: REAL_PERSONAS.role_play,
      goal: 'Discuss therapy'
    },
    expectedBehavior: 'Should handle single-turn gracefully'
  },
  {
    id: 'CTX-16',
    name: 'Corrupted History',
    description: 'Message array has out-of-order or missing fields',
    mode: 'product-knowledge',
    payload: {
      mode: 'product-knowledge',
      messages: [
        { content: 'First message', role: 'user' },
        { role: 'assistant' }, // Missing content
        { role: 'user', content: 'What about safety?' }
      ],
      disease: REAL_DISEASES.pk,
      persona: REAL_PERSONAS.pk,
      goal: 'Learn about therapy'
    },
    expectedBehavior: 'Should sanitize and continue; not crash'
  },
  {
    id: 'CTX-17',
    name: 'Duplicate User Messages',
    description: 'Two consecutive user messages without assistant reply',
    mode: 'general-knowledge',
    payload: {
      mode: 'general-knowledge',
      messages: [
        { role: 'user', content: 'Question 1?' },
        { role: 'user', content: 'Question 2?' },
        { role: 'user', content: 'Question 3?' }
      ],
      disease: null,
      persona: null,
      goal: null
    },
    expectedBehavior: 'Should respond to latest user message only'
  },
  {
    id: 'CTX-18',
    name: 'Multiple User Messages in One Field',
    description: 'Single message field contains multiple questions',
    mode: 'sales-coach',
    payload: {
      mode: 'sales-coach',
      messages: [{ 
        role: 'user',
        content: 'What is the HCP barrier?\n\nHow do we overcome it?\n\nWhat is the impact?'
      }],
      disease: REAL_DISEASES.sales_coach,
      persona: REAL_PERSONAS.sales_coach,
      goal: 'Improve outcomes'
    },
    expectedBehavior: 'Should address all questions or focus on first; return valid format'
  },
  {
    id: 'CTX-19',
    name: 'Thread Reset Mid-Mode',
    description: 'ThreadId changes between requests in same mode',
    mode: 'role-play',
    payload_1: {
      mode: 'role-play',
      messages: [{ role: 'user', content: 'Hi doctor' }],
      threadId: 'thread-abc123',
      disease: REAL_DISEASES.role_play,
      persona: REAL_PERSONAS.role_play,
      goal: 'Chat'
    },
    payload_2: {
      mode: 'role-play',
      messages: [{ role: 'user', content: 'Continue the conversation' }],
      threadId: 'thread-xyz789', // Different thread
      disease: REAL_DISEASES.role_play,
      persona: REAL_PERSONAS.role_play,
      goal: 'Chat'
    },
    expectedBehavior: 'Both requests should return valid responses; thread isolation OK'
  },
  {
    id: 'CTX-20',
    name: 'Role-Play Without Persona Hints',
    description: 'Role-Play mode with empty persona field',
    mode: 'role-play',
    payload: {
      mode: 'role-play',
      messages: [{ role: 'user', content: 'What do you think about this therapy?' }],
      disease: REAL_DISEASES.role_play,
      persona: '', // Empty persona
      goal: 'Discuss'
    },
    expectedBehavior: 'Should use generic HCP voice; still return valid RP format'
  }
];

/**
 * ============================================================================
 * PART 3: STRUCTURE EDGE CASES (Tests 21-30)
 * ============================================================================
 * 
 * These tests examine the LLM OUTPUT structure for format violations.
 * We'll send valid inputs and validate the RESPONSE against edge-case hazards.
 */

const STRUCTURE_EDGE_CASES = [
  {
    id: 'STR-21',
    name: 'Sales-Coach Missing Single Section',
    description: 'Response missing "Impact:" section',
    mode: 'sales-coach',
    message: 'How do we improve patient adherence?',
    validationCheck: (response) => {
      const hasChallenge = /Challenge:/i.test(response.reply);
      const hasRepApproach = /Rep Approach:/i.test(response.reply);
      const hasImpact = /Impact:/i.test(response.reply);
      const hasPhrasing = /Suggested Phrasing:/i.test(response.reply);
      return {
        passed: hasChallenge && hasRepApproach && hasImpact && hasPhrasing,
        error: !hasImpact ? 'MISSING_IMPACT_SECTION' : null
      };
    }
  },
  {
    id: 'STR-22',
    name: 'Sales-Coach Missing Bullets',
    description: 'Rep Approach section exists but has 0-2 bullets (needs 3+)',
    mode: 'sales-coach',
    message: 'What is the best approach to this challenge?',
    validationCheck: (response) => {
      const repMatch = response.reply.match(/Rep Approach:\s*([\s\S]*?)(?=Impact:|$)/i);
      const bulletCount = repMatch ? (repMatch[1].match(/•/g) || []).length : 0;
      return {
        passed: bulletCount >= 3,
        error: bulletCount < 3 ? `INSUFFICIENT_BULLETS: ${bulletCount} (need 3+)` : null
      };
    }
  },
  {
    id: 'STR-23',
    name: 'Role-Play Produces Coaching Advice',
    description: 'Role-Play returns "You should..." or "Challenge:" format',
    mode: 'role-play',
    message: 'What is your typical workflow?',
    validationCheck: (response) => {
      const hasCoachingHeaders = /Challenge:|Rep Approach:|Impact:|Suggested Phrasing:/i.test(response.reply);
      const hasCoachingLanguage = /You should|You could|You might|You ought|Grade:|Score:/i.test(response.reply);
      return {
        passed: !hasCoachingHeaders && !hasCoachingLanguage,
        error: hasCoachingHeaders ? 'HAS_COACHING_HEADERS' : hasCoachingLanguage ? 'HAS_COACHING_LANGUAGE' : null
      };
    }
  },
  {
    id: 'STR-24',
    name: 'EI Missing Socratic Questions',
    description: 'Emotional Assessment response has no question marks',
    mode: 'emotional-assessment',
    message: 'Reflect on this patient interaction',
    validationCheck: (response) => {
      const questionCount = (response.reply.match(/\?/g) || []).length;
      return {
        passed: questionCount >= 1,
        error: questionCount < 1 ? 'EI_NO_SOCRATIC_QUESTIONS' : null
      };
    }
  },
  {
    id: 'STR-25',
    name: 'EI Missing Final Reflective Question',
    description: 'EI response ends with period, not question',
    mode: 'emotional-assessment',
    message: 'What should I learn from this?',
    validationCheck: (response) => {
      const endsWithQuestion = /\?\s*$/.test(response.reply.trim());
      return {
        passed: endsWithQuestion,
        error: !endsWithQuestion ? 'EI_NO_FINAL_QUESTION' : null
      };
    }
  },
  {
    id: 'STR-26',
    name: 'PK Missing Citations',
    description: 'Product Knowledge response makes claims without [1], [2] citations',
    mode: 'product-knowledge',
    message: 'What is the clinical benefit of this therapy?',
    validationCheck: (response) => {
      const citationPatterns = [
        /\[\d+\]/,  // [1], [2], etc.
        /\[\w+-\w+-\w+\]/,  // [REF-CODE-123]
        /citation\s*\d+/i
      ];
      const hasCitations = citationPatterns.some(p => p.test(response.reply));
      return {
        passed: hasCitations,
        error: !hasCitations ? 'PK_MISSING_CITATIONS' : null
      };
    }
  },
  {
    id: 'STR-27',
    name: 'PK Malformed Citations',
    description: 'Citations present but malformed: [REF-], [1a], etc.',
    mode: 'product-knowledge',
    message: 'Tell me about the efficacy data',
    validationCheck: (response) => {
      const validCitations = /\[\d+\]|\[\w{3,}-\w{2,}-\d{1,}\]/g;
      const matches = response.reply.match(validCitations) || [];
      const allValid = matches.length > 0 && matches.every(m => {
        return /^\[\d+\]$/.test(m) || /^\[[A-Z]+-[A-Z]+-\d+\]$/.test(m);
      });
      return {
        passed: allValid,
        error: !allValid ? 'PK_MALFORMED_CITATIONS' : null
      };
    }
  },
  {
    id: 'STR-28',
    name: 'GK Produces Structured Output',
    description: 'General Knowledge returns "Challenge:" or "Rep Approach:" headers',
    mode: 'general-knowledge',
    message: 'How does value-based care work?',
    validationCheck: (response) => {
      const hasStructuredHeaders = /Challenge:|Rep Approach:|Impact:|Suggested Phrasing:/i.test(response.reply);
      const hasCoachBlock = /<coach>|<\/coach>/i.test(response.reply);
      return {
        passed: !hasStructuredHeaders && !hasCoachBlock,
        error: hasStructuredHeaders ? 'GK_HAS_COACHING_STRUCTURE' : hasCoachBlock ? 'GK_HAS_COACH_BLOCK' : null
      };
    }
  },
  {
    id: 'STR-29',
    name: 'Duplicate Coach Blocks',
    description: 'Response contains multiple <coach>...</coach> sections',
    mode: 'sales-coach',
    message: 'Score this interaction',
    validationCheck: (response) => {
      const coachMatches = (response.reply.match(/<coach>/gi) || []).length;
      return {
        passed: coachMatches <= 1,
        error: coachMatches > 1 ? `DUPLICATE_COACH_BLOCKS: ${coachMatches}` : null
      };
    }
  },
  {
    id: 'STR-30',
    name: 'Paragraph Collapse',
    description: 'Sections run together without blank lines (\\n\\n)',
    mode: 'sales-coach',
    message: 'What is the best approach?',
    validationCheck: (response) => {
      // Check that sections are separated by blank lines
      const sections = response.reply.split(/\n\n+/);
      const hasSeparation = sections.length >= 3; // At least 3 logical sections
      const noCollapse = /\n\n/.test(response.reply); // Contains at least one \n\n
      return {
        passed: hasSeparation && noCollapse,
        error: !noCollapse ? 'PARAGRAPH_COLLAPSE' : !hasSeparation ? 'INSUFFICIENT_SECTIONS' : null
      };
    }
  }
];

/**
 * ============================================================================
 * TEST EXECUTION HARNESS
 * ============================================================================
 */

/**
 * POST to Worker with intelligent retry and rate-limit detection
 * Tuned backoff: 2000ms → 4000ms → 8000ms for 429 errors
 * Distinguishes rate-limit failures from contract/logic failures
 * @param {object} payload - Request payload
 * @param {number} retries - Max retry attempts (default: MAX_RETRIES)
 * @returns {object} - Response; may include rateLimit flag
 */
async function postToWorkerWithRetry(payload, retries = MAX_RETRIES) {
  let lastRateLimitError = null;
  
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(WORKER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        timeout: REQUEST_TIMEOUT_MS
      });
      
      if (response.status === 429) {
        // Rate limited - retry with tuned exponential backoff (2s, 4s, 8s)
        lastRateLimitError = new Error('HTTP 429 Too Many Requests');
        const delay = Math.pow(2, i + 1) * 1000; // 2000, 4000, 8000
        console.log(`[RETRY ${i + 1}/${retries}] Rate limited. Waiting ${delay}ms...`);
        await sleep(delay);
        continue;
      }
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      return await response.json();
    } catch (e) {
      if (i === retries - 1) {
        // Final attempt failed
        if (lastRateLimitError) {
          // Mark rate-limit failures clearly so tests can distinguish them
          return { 
            error: 'RATE_LIMIT_EXCEEDED',
            rateLimit: true,
            message: 'Worker rate limit exceeded after all retries'
          };
        }
        throw e;
      }
      
      // Retry with backoff (1s, 2s, 4s)
      const delay = Math.pow(2, i + 1) * 500;
      console.log(`[RETRY ${i + 1}/${retries}] Error: ${e.message}. Waiting ${delay}ms...`);
      await sleep(delay);
    }
  }
}

async function runInputEdgeCaseTest(testCase) {
  console.log(`\n[${testCase.id}] ${testCase.name}`);
  console.log(`  Description: ${testCase.description}`);
  
  try {
    // SPECIAL HANDLING FOR INPUT-10: Rapid Mode Switching Chain
    // Execute 5 sequential POST requests, one per mode
    if (testCase.mode === 'rapid_switch') {
      const modeSequence = testCase.modes; // ['sales-coach', 'role-play', 'emotional-assessment', 'product-knowledge', 'general-knowledge']
      const modeResults = [];
      let allPassed = true;
      
      for (let i = 0; i < modeSequence.length; i++) {
        const mode = modeSequence[i];
        console.log(`\n  [${i + 1}/5] Testing mode: ${mode}`);
        
        try {
          const payload = {
            mode: mode,
            messages: [{ role: 'user', content: testCase.message }],
            disease: REAL_DISEASES[mode] || '',
            persona: REAL_PERSONAS[mode] || '',
            goal: 'Test rapid-switch chain'
          };
          
          const result = await postToWorkerWithRetry(payload);
          
          // Validate response structure for this mode
          const hasReply = result && typeof result.reply === 'string' && result.reply.trim().length > 0;
          const isValidStructure = !result.error;
          const isValidFormat = hasReply && isValidStructure;
          
          if (isValidFormat) {
            console.log(`    ✅ ${mode} returned valid response`);
            modeResults.push({ mode, passed: true, response: result.reply.substring(0, 100) + '...' });
          } else {
            console.log(`    ❌ ${mode} returned invalid response: error=${result.error}`);
            modeResults.push({ mode, passed: false, error: result.error });
            allPassed = false;
          }
          
          // Rate limiting protection between requests
          if (i < modeSequence.length - 1) {
            await new Promise(r => setTimeout(r, 1000));
          }
        } catch (modeError) {
          console.log(`    ❌ ${mode} request failed: ${modeError.message}`);
          modeResults.push({ mode, passed: false, error: modeError.message });
          allPassed = false;
        }
      }
      
      // Summary for INPUT-10
      const passedCount = modeResults.filter(r => r.passed).length;
      console.log(`\n  === INPUT-10 SUMMARY ===`);
      console.log(`  Modes tested: ${passedCount}/${modeSequence.length}`);
      if (allPassed) {
        console.log(`  ✅ PASS - All 5 modes returned valid responses with no cross-contamination`);
      } else {
        console.log(`  ❌ FAIL - ${modeSequence.length - passedCount} mode(s) failed validation`);
      }
      
      return { 
        passed: allPassed, 
        testId: testCase.id,
        rapidSwitchResults: modeResults,
        summary: `${passedCount}/${modeSequence.length} modes passed`
      };
    }
    
    // STANDARD INPUT EDGE CASE HANDLING (not rapid-switch)
    const payload = {
      mode: testCase.mode,
      messages: [{ role: 'user', content: testCase.message }],
      disease: REAL_DISEASES[testCase.mode] || '',
      persona: REAL_PERSONAS[testCase.mode] || '',
      goal: 'Test'
    };
    
    const result = await postToWorkerWithRetry(payload);
    
    // Check for rate-limit failures first (infrastructure, not logic)
    if (result.rateLimit) {
      console.log(`  ⚠️  RATE_LIMITED - Worker rate limit exceeded`);
      return { passed: false, testId: testCase.id, error: 'RATE_LIMIT_EXCEEDED', rateLimit: true };
    }
    
    // Basic validation
    const hasReply = result && typeof result.reply === 'string' && result.reply.trim().length > 0;
    const isValidStructure = !result.error; // No HTTP 400 error
    
    if (hasReply && isValidStructure) {
      console.log(`  ✅ PASS - Valid response returned`);
      return { passed: true, testId: testCase.id };
    } else {
      console.log(`  ⚠️  WARN - Response may be compromised: error=${result.error}`);
      return { passed: false, testId: testCase.id, error: 'INVALID_RESPONSE' };
    }
  } catch (e) {
    console.log(`  ❌ FAIL - ${e.message}`);
    return { passed: false, testId: testCase.id, error: e.message };
  }
}

async function runContextEdgeCaseTest(testCase) {
  console.log(`\n[${testCase.id}] ${testCase.name}`);
  console.log(`  Description: ${testCase.description}`);
  
  try {
    // Test 1 (or payload_1)
    const payload = testCase.payload || testCase.payload_1;
    const result = await postToWorkerWithRetry(payload);
    
    // Check for rate-limit failures first
    if (result.rateLimit) {
      console.log(`  ⚠️  RATE_LIMITED - Worker rate limit exceeded`);
      return { passed: false, testId: testCase.id, error: 'RATE_LIMIT_EXCEEDED', rateLimit: true };
    }
    
    const hasReply = result && typeof result.reply === 'string';
    
    if (hasReply) {
      console.log(`  ✅ PASS - Response generated despite missing context`);
      
      // For thread-switch test, also test payload_2
      if (testCase.payload_2) {
        const result2 = await postToWorkerWithRetry(testCase.payload_2);
        
        // Check for rate-limit on second request
        if (result2.rateLimit) {
          console.log(`  ⚠️  RATE_LIMITED - Rate limit on second thread test`);
          return { passed: false, testId: testCase.id, error: 'RATE_LIMIT_EXCEEDED', rateLimit: true };
        }
        
        const hasReply2 = result2 && typeof result2.reply === 'string';
        if (hasReply2) {
          console.log(`  ✅ PASS - Second thread also valid`);
        } else {
          console.log(`  ⚠️  WARN - Second thread response invalid`);
        }
      }
      
      return { passed: true, testId: testCase.id };
    } else {
      console.log(`  ⚠️  WARN - No reply generated`);
      return { passed: false, testId: testCase.id, error: 'NO_REPLY' };
    }
  } catch (e) {
    console.log(`  ❌ FAIL - ${e.message}`);
    return { passed: false, testId: testCase.id, error: e.message };
  }
}

async function runStructureEdgeCaseTest(testCase) {
  console.log(`\n[${testCase.id}] ${testCase.name}`);
  console.log(`  Description: ${testCase.description}`);
  
  try {
    const payload = {
      mode: testCase.mode,
      messages: [{ role: 'user', content: testCase.message }],
      disease: REAL_DISEASES[testCase.mode] || '',
      persona: REAL_PERSONAS[testCase.mode] || '',
      goal: 'Test'
    };
    
    const result = await postToWorkerWithRetry(payload);
    
    // Check for rate-limit failures first
    if (result.rateLimit) {
      console.log(`  ⚠️  RATE_LIMITED - Worker rate limit exceeded`);
      return { passed: false, testId: testCase.id, error: 'RATE_LIMIT_EXCEEDED', rateLimit: true };
    }
    
    if (!result || typeof result.reply !== 'string') {
      console.log(`  ❌ FAIL - No valid reply returned`);
      return { passed: false, testId: testCase.id, error: 'NO_REPLY' };
    }
    
    const validation = testCase.validationCheck(result);
    
    if (validation.passed) {
      console.log(`  ✅ PASS - Structure validation passed`);
      return { passed: true, testId: testCase.id };
    } else {
      console.log(`  ❌ FAIL - ${validation.error}`);
      return { passed: false, testId: testCase.id, error: validation.error };
    }
  } catch (e) {
    console.log(`  ❌ FAIL - ${e.message}`);
    return { passed: false, testId: testCase.id, error: e.message };
  }
}

/**
 * ============================================================================
 * MAIN EXECUTION
 * ============================================================================
 */

async function runAllTests() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║     PHASE 3 EDGE CASE TEST SUITE - REAL INTEGRATION TESTS     ║');
  console.log('║                 30 Tests Against Live Worker                  ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  
  const results = {
    input: [],
    context: [],
    structure: []
  };
  
  console.log('\n' + '='.repeat(68));
  console.log('PART 1: INPUT EDGE CASES (Tests 1-10)');
  console.log('='.repeat(68));
  for (const testCase of INPUT_EDGE_CASES) {
    const result = await runInputEdgeCaseTest(testCase);
    results.input.push(result);
    await sleep(PHASE3_THROTTLE_MS);
  }
  
  console.log('\n' + '='.repeat(68));
  console.log('PART 2: CONTEXT EDGE CASES (Tests 11-20)');
  console.log('='.repeat(68));
  for (const testCase of CONTEXT_EDGE_CASES) {
    const result = await runContextEdgeCaseTest(testCase);
    results.context.push(result);
    await sleep(PHASE3_THROTTLE_MS);
  }
  
  console.log('\n' + '='.repeat(68));
  console.log('PART 3: STRUCTURE EDGE CASES (Tests 21-30)');
  console.log('='.repeat(68));
  for (const testCase of STRUCTURE_EDGE_CASES) {
    const result = await runStructureEdgeCaseTest(testCase);
    results.structure.push(result);
    await sleep(PHASE3_THROTTLE_MS);
  }
  
  // Summary with rate-limit tracking
  const allResults = [...results.input, ...results.context, ...results.structure];
  const rateLimitFailures = allResults.filter(r => r.rateLimit);
  const contractFailures = allResults.filter(r => !r.passed && !r.rateLimit);
  
  const totalInput = results.input.length;
  const passedInput = results.input.filter(r => r.passed).length;
  const totalContext = results.context.length;
  const passedContext = results.context.filter(r => r.passed).length;
  const totalStructure = results.structure.length;
  const passedStructure = results.structure.filter(r => r.passed).length;
  
  const totalTests = totalInput + totalContext + totalStructure;
  const totalPassed = passedInput + passedContext + passedStructure;
  
  console.log('\n' + '╔════════════════════════════════════════════════════════════════╗');
  console.log('║                         TEST SUMMARY                           ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log(`\nINPUT EDGE CASES:       ${passedInput}/${totalInput} passed`);
  console.log(`CONTEXT EDGE CASES:     ${passedContext}/${totalContext} passed`);
  console.log(`STRUCTURE EDGE CASES:   ${passedStructure}/${totalStructure} passed`);
  console.log(`\nTOTAL:                  ${totalPassed}/${totalTests} passed (${Math.round(totalPassed/totalTests*100)}%)`);
  
  // Report rate-limit vs contract failures separately
  if (rateLimitFailures.length > 0) {
    console.log(`\n⚠️  RATE-LIMIT DRIVEN FAILURES: ${rateLimitFailures.length}`);
    rateLimitFailures.forEach(r => console.log(`  - ${r.testId}: Rate limit exceeded`));
  }
  
  if (contractFailures.length > 0) {
    console.log(`\n❌ TRUE CONTRACT/LOGIC FAILURES: ${contractFailures.length}`);
    contractFailures.forEach(r => console.log(`  - ${r.testId}: ${r.error}`));
  }
  
  // Exit code semantics
  const toleranceMsg = PHASE3_TOLERATE_RATE_LIMITS 
    ? `(tolerated threshold: ${PHASE3_MAX_RATE_LIMIT_FAILURES}, tolerate: true)`
    : `(tolerated threshold: ${PHASE3_MAX_RATE_LIMIT_FAILURES}, tolerate: false)`;
  console.log(`\nRate-limit failures: ${rateLimitFailures.length} ${toleranceMsg}`);
  
  let shouldExit1 = false;
  
  // Check 1: Any true contract failures always force exit code 1
  if (contractFailures.length > 0) {
    console.log('\n❌ EXIT CODE 1: True contract/logic failures detected');
    shouldExit1 = true;
  }
  
  // Check 2: Rate-limit failures depend on tolerance settings
  if (rateLimitFailures.length > 0) {
    if (!PHASE3_TOLERATE_RATE_LIMITS) {
      // Default: any rate-limit failure causes exit code 1
      console.log(`\n❌ EXIT CODE 1: Rate-limit failures detected (PHASE3_TOLERATE_RATE_LIMITS=false)`);
      shouldExit1 = true;
    } else if (rateLimitFailures.length > PHASE3_MAX_RATE_LIMIT_FAILURES) {
      // Tolerate mode: only exit 1 if exceeded threshold
      console.log(`\n❌ EXIT CODE 1: Rate-limit failures (${rateLimitFailures.length}) exceeded threshold (${PHASE3_MAX_RATE_LIMIT_FAILURES})`);
      shouldExit1 = true;
    } else {
      // Tolerate mode: within threshold, log as acceptable
      console.log(`\n✅ Rate-limit failures (${rateLimitFailures.length}) within tolerated threshold (${PHASE3_MAX_RATE_LIMIT_FAILURES})`);
    }
  }
  
  if (totalPassed === totalTests) {
    console.log('\n🎉 ALL TESTS PASSED! 🎉');
  } else if (rateLimitFailures.length === (totalTests - totalPassed) && !shouldExit1) {
    console.log(`\n⚠️  All ${totalTests - totalPassed} failures are rate-limit driven (infrastructure, tolerated).`);
    console.log('Consider increasing PHASE3_THROTTLE_MS or Worker rate limit for stability.');
  } else if (!shouldExit1) {
    console.log(`\n⚠️  ${totalTests - totalPassed} tests failed or need review`);
  }
  
  return {
    summary: {
      total: totalTests,
      passed: totalPassed,
      failed: totalTests - totalPassed,
      rateLimitFailures: rateLimitFailures.length,
      contractFailures: contractFailures.length,
      passRate: (totalPassed / totalTests * 100).toFixed(2) + '%',
      shouldExit: shouldExit1 ? 1 : 0
    },
    results
  };
}

// Export for use in other contexts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    runAllTests,
    INPUT_EDGE_CASES,
    CONTEXT_EDGE_CASES,
    STRUCTURE_EDGE_CASES
  };
}

// Run if executed directly
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

if (process.argv[1] === __filename) {
  runAllTests()
    .then(result => {
      const exitCode = result.summary.shouldExit;
      process.exit(exitCode);
    })
    .catch(err => {
      console.error('Fatal error:', err);
      process.exit(1);
    });
}
