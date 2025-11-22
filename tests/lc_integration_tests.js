#!/usr/bin/env node

/**
 * PHASE 2: Real Integration Tests for Learning Center Modes
 * 
 * ⚠️  CRITICAL: See ../TESTING_GUARDRAILS.md
 * 
 * This test harness executes 20 REAL HTTP requests to the Cloudflare Worker
 * /chat endpoint. ALL tests use actual mode keys, persona IDs, and scenario
 * IDs from repo files. NO mocks, NO simulations, NO fake data.
 * 
 * Every assertion is backed by a real HTTP response from the live Worker.
 * Tests must NEVER be replaced by theoretical analysis or fictional outputs.
 * 
 * See TESTING_GUARDRAILS.md for rules on what constitutes a "real test."
 * 
 * Executes 20 real HTTP requests to Cloudflare Worker /chat endpoint
 * with real modes, personas, diseases from repo files.
 * 
 * Validates responses against mode-specific contracts.
 */

import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Constants - all real values from PHASE 1
const WORKER_BASE_URL = 'https://my-chat-agent-v2.tonyabdelmalak.workers.dev';
const CHAT_ENDPOINT = '/chat';

// Real personas from persona.json (using actual IDs)
const REAL_PERSONAS = {
  'hiv_fp_md_timepressed': 'Dr. Maya Patel — Family Practice MD',
  'hiv_id_md_guideline_strict': 'Dr. Evelyn Harper — Infectious Diseases',
  'onco_hemonc_md_costtox': 'Dr. Chen — Hematology/Oncology',
  'vax_peds_np_hesitancy': 'Alex Nguyen, NP — Pediatrics'
};

// Real disease scenarios from scenarios.merged.json
const REAL_DISEASES = {
  'hiv_im_decile3_prep_lowshare': 'Low Descovy share with missed PrEP opportunity',
  'hiv_np_decile10_highshare_access': 'High Descovy share but access barriers',
  'onc_md_decile10_io_adc_pathways': 'IO-backbone heavy; ADC toxicity bandwidth',
  'onc_np_decile6_pathway_ops': 'Pathway-driven care with staffing constraints',
  'cv_card_md_decile10_hf_gdmt_uptake': 'HF GDMT uptake in cardiology',
  'vac_np_decile5_primary_care_capture': 'Vaccine series completion in primary care'
};

// Test matrix (20 real tests: 4 per mode)
const TEST_MATRIX = [
  // Sales Coach Tests (SC-01 to SC-04)
  {
    id: 'SC-01',
    mode: 'sales-coach',
    persona: 'hiv_fp_md_timepressed',
    disease: 'hiv_im_decile3_prep_lowshare',
    goal: 'Create urgency around PrEP gaps',
    question: 'We\'re seeing more STI testing in young MSM - what\'s your approach to PrEP?'
  },
  {
    id: 'SC-02',
    mode: 'sales-coach',
    persona: 'hiv_id_md_guideline_strict',
    disease: 'hiv_np_decile10_highshare_access',
    goal: 'Broaden appropriate Descovy use',
    question: 'How do you handle Descovy prescribing in your practice?'
  },
  {
    id: 'SC-03',
    mode: 'sales-coach',
    persona: 'onco_hemonc_md_costtox',
    disease: 'onc_md_decile10_io_adc_pathways',
    goal: 'Define biomarker-driven ADC subset',
    question: 'What\'s your experience with ADCs in your patient population?'
  },
  {
    id: 'SC-04',
    mode: 'sales-coach',
    persona: 'vax_peds_np_hesitancy',
    disease: 'vac_np_decile5_primary_care_capture',
    goal: 'Standardize vaccination workflow',
    question: 'How do you manage vaccine series completion in your clinic?'
  },

  // Role Play Tests (RP-01 to RP-04)
  {
    id: 'RP-01',
    mode: 'role-play',
    persona: 'hiv_fp_md_timepressed',
    disease: 'hiv_im_decile3_prep_lowshare',
    goal: 'HCP role-play dialogue',
    question: 'Hi doctor, I wanted to talk about PrEP opportunities in your clinic'
  },
  {
    id: 'RP-02',
    mode: 'role-play',
    persona: 'hiv_id_md_guideline_strict',
    disease: 'hiv_np_decile10_highshare_access',
    goal: 'HCP role-play dialogue',
    question: 'Good morning Dr. Harper, thanks for your time. I wanted to discuss Descovy'
  },
  {
    id: 'RP-03',
    mode: 'role-play',
    persona: 'onco_hemonc_md_costtox',
    disease: 'onc_md_decile10_io_adc_pathways',
    goal: 'HCP role-play dialogue',
    question: 'Dr. Chen, do you have a few minutes to discuss our oncology pathway?'
  },
  {
    id: 'RP-04',
    mode: 'role-play',
    persona: 'vax_peds_np_hesitancy',
    disease: 'vac_np_decile5_primary_care_capture',
    goal: 'HCP role-play dialogue',
    question: 'Hey Alex, quick question about flu shots for your pediatric patients'
  },

  // Emotional Intelligence Tests (EI-01 to EI-04)
  {
    id: 'EI-01',
    mode: 'emotional-assessment',
    persona: 'hiv_fp_md_timepressed',
    disease: 'hiv_im_decile3_prep_lowshare',
    goal: 'EI coaching on self-awareness',
    question: 'I felt the HCP was dismissive of my PrEP evidence. How should I handle that differently?'
  },
  {
    id: 'EI-02',
    mode: 'emotional-assessment',
    persona: 'hiv_id_md_guideline_strict',
    disease: 'hiv_np_decile10_highshare_access',
    goal: 'EI coaching on emotional regulation',
    question: 'The doctor challenged my data on Descovy safety. I got defensive. What can I learn?'
  },
  {
    id: 'EI-03',
    mode: 'emotional-assessment',
    persona: 'onco_hemonc_md_costtox',
    disease: 'onc_md_decile10_io_adc_pathways',
    goal: 'EI coaching on discovery',
    question: 'I\'m not sure how to connect ADC benefits to their workflow. How do I ask better questions?'
  },
  {
    id: 'EI-04',
    mode: 'emotional-assessment',
    persona: 'vax_peds_np_hesitancy',
    disease: 'vac_np_decile5_primary_care_capture',
    goal: 'EI coaching on adaptability',
    question: 'The clinic seems too busy for a new vaccine protocol. How do I adapt my approach?'
  },

  // Product Knowledge Tests (PK-01 to PK-04)
  {
    id: 'PK-01',
    mode: 'product-knowledge',
    persona: 'hiv_fp_md_timepressed',
    disease: 'hiv_im_decile3_prep_lowshare',
    goal: 'Clinical knowledge on renal safety',
    question: 'What are the renal safety considerations for Descovy vs TDF?'
  },
  {
    id: 'PK-02',
    mode: 'product-knowledge',
    persona: 'hiv_id_md_guideline_strict',
    disease: 'hiv_np_decile10_highshare_access',
    goal: 'Clinical knowledge on CAB/RPV',
    question: 'How does cabotegravir/rilpivirine compare to oral regimens in terms of durability?'
  },
  {
    id: 'PK-03',
    mode: 'product-knowledge',
    persona: 'onco_hemonc_md_costtox',
    disease: 'onc_md_decile10_io_adc_pathways',
    goal: 'Clinical knowledge on ADC biomarkers',
    question: 'What biomarkers predict ADC response in solid tumors?'
  },
  {
    id: 'PK-04',
    mode: 'product-knowledge',
    persona: 'vax_peds_np_hesitancy',
    disease: 'vac_np_decile5_primary_care_capture',
    goal: 'Clinical knowledge on vaccine efficacy',
    question: 'How do vaccine efficacy rates compare across different age groups?'
  },

  // General Knowledge Tests (GK-01 to GK-04)
  {
    id: 'GK-01',
    mode: 'general-knowledge',
    persona: 'hiv_fp_md_timepressed',
    disease: 'hiv_im_decile3_prep_lowshare',
    goal: 'General knowledge on AI',
    question: 'What\'s the latest in AI for clinical decision support?'
  },
  {
    id: 'GK-02',
    mode: 'general-knowledge',
    persona: 'hiv_id_md_guideline_strict',
    disease: 'hiv_np_decile10_highshare_access',
    goal: 'General knowledge on telemedicine',
    question: 'How has telemedicine impacted specialist access in recent years?'
  },
  {
    id: 'GK-03',
    mode: 'general-knowledge',
    persona: 'onco_hemonc_md_costtox',
    disease: 'onc_md_decile10_io_adc_pathways',
    goal: 'General knowledge on value-based care',
    question: 'What are the business implications of value-based care models?'
  },
  {
    id: 'GK-04',
    mode: 'general-knowledge',
    persona: 'vax_peds_np_hesitancy',
    disease: 'vac_np_decile5_primary_care_capture',
    goal: 'General knowledge on public health',
    question: 'How do public health campaigns work to build vaccine confidence?'
  }
];

// ============================================================================
// VALIDATORS - Mode-specific response contract validation
// ============================================================================

function validateSalesCoachResponse(reply, coachData) {
  const violations = [];
  
  // Check for 4 required sections in reply
  if (!reply.includes('Challenge:')) violations.push('Missing "Challenge:" section');
  if (!reply.includes('Rep Approach:')) violations.push('Missing "Rep Approach:" section');
  if (!reply.includes('Impact:')) violations.push('Missing "Impact:" section');
  if (!reply.includes('Suggested Phrasing:')) violations.push('Missing "Suggested Phrasing:" section');
  
  // Check for 10 EI metrics in coach data (either XML tag or JSON object)
  const requiredMetrics = [
    'empathy', 'clarity', 'compliance', 'discovery', 'objection_handling',
    'confidence', 'active_listening', 'adaptability', 'action_insight', 'resilience'
  ];
  
  if (coachData && coachData.scores) {
    const scores = coachData.scores;
    const missingMetrics = requiredMetrics.filter(m => !(m in scores));
    if (missingMetrics.length > 0) {
      violations.push(`Missing EI metrics: ${missingMetrics.join(', ')}`);
    }
  } else if (reply.includes('<coach>')) {
    // Coach block is in XML format in reply
    const coachMatch = reply.match(/<coach>(.*?)<\/coach>/s);
    if (coachMatch) {
      const coachText = coachMatch[1];
      for (const metric of requiredMetrics) {
        if (!coachText.includes(metric)) {
          violations.push(`Missing EI metric in <coach> block: ${metric}`);
        }
      }
    }
  } else {
    violations.push('No coach data with scores found');
  }
  
  return {
    valid: violations.length === 0,
    violations
  };
}

function validateRolePlayResponse(reply) {
  const violations = [];
  
  // Must be HCP first-person voice (hard to validate perfectly, but check for disqualifiers)
  if (reply.includes('Suggested Phrasing:')) violations.push('Should NOT contain "Suggested Phrasing:"');
  if (reply.includes('Rep Approach:')) violations.push('Should NOT contain "Rep Approach:"');
  if (reply.includes('Challenge:')) violations.push('Should NOT contain "Challenge:"');
  if (reply.includes('<coach>')) violations.push('Should NOT contain <coach> block');
  if (reply.includes('You should have') || reply.includes('You must')) {
    violations.push('Contains coaching language ("You should have", "You must")');
  }
  
  // Must not be empty
  if (!reply || reply.trim().length < 20) violations.push('Response too short or empty');
  
  return {
    valid: violations.length === 0,
    violations
  };
}

function validateEIResponse(reply) {
  const violations = [];
  
  // Must not include sales-coach formatting
  if (reply.includes('Rep Approach:')) violations.push('Should NOT contain "Rep Approach:"');
  if (reply.includes('Suggested Phrasing:')) violations.push('Should NOT contain "Suggested Phrasing:"');
  if (reply.includes('Challenge:')) violations.push('Should NOT contain "Challenge:"');
  if (reply.includes('<coach>')) violations.push('Should NOT contain <coach> block');
  
  // Must include EI/reflection language
  const eiKeywords = ['reflection', 'emotion', 'awareness', 'regulation', 'Socratic', 'question', 'mindset', 'pattern', 'Loop'];
  const hasEILanguage = eiKeywords.some(kw => reply.toLowerCase().includes(kw.toLowerCase()));
  if (!hasEILanguage) {
    violations.push('Does not contain EI reflection language');
  }
  
  // Must have at least 1 question (Socratic)
  const questionCount = (reply.match(/\?/g) || []).length;
  if (questionCount < 1) violations.push('Should contain at least 1 Socratic question');
  
  // Length check: 2-4 paragraphs is roughly 200-1200 words (flexible per prompt)
  const wordCount = reply.split(/\s+/).length;
  if (wordCount < 100) violations.push('Response too short (should be 2-4 paragraphs)');
  if (wordCount > 1500) violations.push('Response too long (should be 2-4 paragraphs)');
  
  return {
    valid: violations.length === 0,
    violations
  };
}

function validateProductKnowledgeResponse(reply) {
  const violations = [];
  
  // Must not use sales-coach formatting
  if (reply.includes('Rep Approach:')) violations.push('Should NOT contain "Rep Approach:"');
  if (reply.includes('Suggested Phrasing:')) violations.push('Should NOT contain "Suggested Phrasing:"');
  if (reply.includes('<coach>')) violations.push('Should NOT contain <coach> block');
  
  // Should have citations [1], [2], etc.
  const citationPattern = /\[\d+\]/;
  if (!citationPattern.test(reply)) {
    violations.push('Missing bracketed citations [1], [2], etc.');
  }
  
  // Must not be empty
  if (!reply || reply.trim().length < 50) violations.push('Response too short');
  
  return {
    valid: violations.length === 0,
    violations
  };
}

function validateGeneralKnowledgeResponse(reply) {
  const violations = [];
  
  // Must not use any structured LC formats
  if (reply.includes('Rep Approach:')) violations.push('Should NOT contain "Rep Approach:"');
  if (reply.includes('Suggested Phrasing:')) violations.push('Should NOT contain "Suggested Phrasing:"');
  if (reply.includes('Challenge:')) violations.push('Should NOT contain "Challenge:"');
  if (reply.includes('<coach>')) violations.push('Should NOT contain <coach> block');
  
  // Must not be empty
  if (!reply || reply.trim().length < 20) violations.push('Response too short or empty');
  
  return {
    valid: violations.length === 0,
    violations
  };
}

function validateResponse(mode, reply, coachData) {
  switch (mode) {
    case 'sales-coach':
      return validateSalesCoachResponse(reply, coachData);
    case 'role-play':
      return validateRolePlayResponse(reply);
    case 'emotional-assessment':
      return validateEIResponse(reply);
    case 'product-knowledge':
      return validateProductKnowledgeResponse(reply);
    case 'general-knowledge':
      return validateGeneralKnowledgeResponse(reply);
    default:
      return { valid: false, violations: [`Unknown mode: ${mode}`] };
  }
}

// ============================================================================
// HTTP REQUEST HANDLER
// ============================================================================

function postToWorker(payload) {
  return new Promise((resolve, reject) => {
    const url = new URL(CHAT_ENDPOINT, WORKER_BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'LC-Integration-Tests/1.0'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: parsed,
            rawBody: data
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: null,
            rawBody: data,
            parseError: e.message
          });
        }
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    req.write(JSON.stringify(payload));
    req.end();
  });
}

async function postToWorkerWithRetry(testId, payload, maxRetries = 3) {
  let lastResponse = null;
  let retryCount = 0;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await postToWorker(payload);
      lastResponse = response;

      // If not 429, return immediately (success or other error)
      if (response.statusCode !== 429) {
        return {
          response,
          retries: retryCount,
          success: true
        };
      }

      // If 429, check if we should retry
      if (attempt < maxRetries) {
        // Extract retry-after from headers
        const retryAfter = response.headers['retry-after'];
        let waitMs = 2000; // default 2 seconds

        if (retryAfter) {
          const retryAfterNum = parseInt(retryAfter, 10);
          if (!isNaN(retryAfterNum)) {
            waitMs = retryAfterNum * 1000;
          }
        }

        // Add exponential backoff
        const backoffMs = Math.pow(2, attempt) * 1000;
        waitMs = Math.max(waitMs, backoffMs);

        console.log(`    ⏳ Rate limited (429). Retry ${attempt + 1}/${maxRetries} in ${waitMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitMs));
        retryCount++;
      }
    } catch (error) {
      // Network error - propagate
      throw error;
    }
  }

  // After all retries exhausted, return with persistent 429 marker
  return {
    response: lastResponse,
    retries: retryCount,
    success: false,
    persistent429: true
  };
}

// ============================================================================
// MAIN TEST EXECUTION
// ============================================================================

async function runAllTests() {
  console.log(`\n${'='.repeat(80)}`);
  console.log('PHASE 2: REAL INTEGRATION TESTS');
  console.log(`${'='.repeat(80)}\n`);
  
  const results = [];
  let httpCallCount = 0;

  for (let i = 0; i < TEST_MATRIX.length; i++) {
    const testCase = TEST_MATRIX[i];
    console.log(`Running ${testCase.id} (${testCase.mode})...`);

    // Build request payload (Widget format)
    const payload = {
      mode: testCase.mode,
      disease: testCase.disease,
      persona: testCase.persona,
      goal: testCase.goal,
      messages: [
        { role: 'user', content: testCase.question }
      ]
    };

    try {
      // REAL HTTP CALL TO WORKER WITH RETRY LOGIC
      const retryResult = await postToWorkerWithRetry(testCase.id, payload, 3);
      httpCallCount++;

      const response = retryResult.response;
      const reply = response.body?.reply || '';
      const coachData = response.body?.coach;
      const hasError = response.statusCode >= 400;

      // Validate response
      const validation = !hasError ? validateResponse(testCase.mode, reply, coachData) : {
        valid: false,
        violations: [
          retryResult.persistent429
            ? `HTTP 429: persistent rate limit after ${retryResult.retries} retries`
            : `HTTP ${response.statusCode}: ${response.body?.error || 'Unknown error'}`
        ]
      };

      const result = {
        testId: testCase.id,
        mode: testCase.mode,
        persona: testCase.persona,
        disease: testCase.disease,
        httpStatus: response.statusCode,
        retriesNeeded: retryResult.retries,
        persistentRateLimit: retryResult.persistent429,
        requestPayload: payload,
        responseBody: response.body,
        validation: {
          passed: validation.valid,
          violations: validation.violations,
          failureType: hasError ? (retryResult.persistent429 ? 'infrastructure' : 'error') : 'contract'
        },
        timestamp: new Date().toISOString()
      };

      results.push(result);

      const retryStr = retryResult.retries > 0 ? ` (${retryResult.retries} retries)` : '';
      const status = validation.valid ? '✓ PASS' : '✗ FAIL';
      console.log(`  ${status}${retryStr}: ${validation.violations.length === 0 ? 'All contracts met' : validation.violations[0]}\n`);

    } catch (error) {
      console.error(`  ✗ NETWORK ERROR: ${error.message}\n`);
      results.push({
        testId: testCase.id,
        mode: testCase.mode,
        persona: testCase.persona,
        disease: testCase.disease,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }

    // Adaptive rate limiting: increase delay if we get 429
    let delayMs = 3000;
    if (i > 0 && results[results.length - 1]?.validation?.violations?.some(v => v.includes('429'))) {
      delayMs = 5000;
    }
    
    // Don't delay after last test
    if (i < TEST_MATRIX.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  // ========================================================================
  // WRITE RESULTS TO FILES
  // ========================================================================

  // Raw results JSON
  const rawResultsPath = path.join(__dirname, 'lc_integration_raw_results.json');
  fs.writeFileSync(rawResultsPath, JSON.stringify({
    executionTime: new Date().toISOString(),
    httpCallCount,
    totalTests: TEST_MATRIX.length,
    results
  }, null, 2));

  console.log(`\nRaw results saved to: ${rawResultsPath}`);

  // Categorize failures
  const contractFailures = results.filter(r => !r.validation?.passed && r.validation?.failureType === 'contract');
  const infrastructureFailures = results.filter(r => !r.validation?.passed && r.validation?.failureType === 'infrastructure');
  const passCount = results.filter(r => r.validation?.passed).length;

  // Summary markdown
  let summaryMd = `# LC Integration Tests Summary (With Retry)\n\n`;
  summaryMd += `**Execution Date:** ${new Date().toISOString()}\n`;
  summaryMd += `**HTTP Calls Made:** ${httpCallCount} (all to real Worker endpoint)\n`;
  summaryMd += `**Total Tests:** ${results.length}\n`;
  summaryMd += `**Passed:** ${passCount}\n`;
  summaryMd += `**Failed (Contract):** ${contractFailures.length}\n`;
  summaryMd += `**Failed (Infrastructure/429):** ${infrastructureFailures.length}\n\n`;

  summaryMd += `## Test Results by Mode\n\n`;

  const modes = ['sales-coach', 'role-play', 'emotional-assessment', 'product-knowledge', 'general-knowledge'];
  for (const mode of modes) {
    const modeResults = results.filter(r => r.mode === mode);
    const modePassed = modeResults.filter(r => r.validation?.passed).length;
    summaryMd += `### ${mode.toUpperCase()}\n`;
    summaryMd += `**Status:** ${modePassed}/${modeResults.length} passed\n\n`;
    summaryMd += `| Test ID | Persona | Disease | Status | Retries | Details |\n`;
    summaryMd += `|---------|---------|---------|--------|---------|----------|\n`;
    
    for (const result of modeResults) {
      const status = !result.validation?.passed ? '❌ FAIL' : '✅ PASS';
      const retries = result.retriesNeeded || 0;
      const details = result.validation?.passed ? 'None' : (result.validation?.violations.join('; ') || 'Unknown');
      summaryMd += `| ${result.testId} | ${result.persona} | ${result.disease} | ${status} | ${retries} | ${details} |\n`;
    }
    summaryMd += '\n';
  }

  // Detailed violations by type
  summaryMd += `\n## Failure Analysis\n\n`;
  
  if (contractFailures.length > 0) {
    summaryMd += `### Contract Violations (${contractFailures.length})\n\n`;
    for (const result of contractFailures) {
      summaryMd += `**${result.testId}** (${result.mode} / ${result.persona}):\n`;
      for (const v of (result.validation?.violations || [])) {
        summaryMd += `- ${v}\n`;
      }
      summaryMd += '\n';
    }
  }
  
  if (infrastructureFailures.length > 0) {
    summaryMd += `### Infrastructure Failures (${infrastructureFailures.length})\n\n`;
    summaryMd += `These tests were rate-limited after retry attempts. They are not contract failures.\n\n`;
    for (const result of infrastructureFailures) {
      summaryMd += `**${result.testId}** (${result.mode}):\n`;
      summaryMd += `- Retries: ${result.retriesNeeded}\n`;
      summaryMd += `- Status: ${result.httpStatus}\n`;
      summaryMd += `- Persistent Rate Limit: ${result.persistentRateLimit ? 'Yes' : 'No'}\n`;
      summaryMd += '\n';
    }
  }

  // Recommendations
  summaryMd += `\n## Rate Limiting Analysis\n\n`;
  summaryMd += `**Current Rate Limit Config (from worker.js):**\n`;
  summaryMd += `- Base rate: 10 requests per minute (RATELIMIT_RATE)\n`;
  summaryMd += `- Burst capacity: 4 requests (RATELIMIT_BURST)\n`;
  summaryMd += `- Bucket key: \`\${IP}:chat\`\n`;
  summaryMd += `- Retry-After: 2 seconds (default, configurable via RATELIMIT_RETRY_AFTER)\n\n`;

  if (infrastructureFailures.length > 0) {
    summaryMd += `**Recommendation for Persistent Rate Limiting:**\n`;
    summaryMd += `Option A: Increase inter-test delay to 5-7 seconds (test harness only)\n`;
    summaryMd += `Option B: Increase RATELIMIT_RATE in worker.js (affects all clients)\n`;
    summaryMd += `Option C: Add internal test bypass (requires security review)\n\n`;
  }

  summaryMd += `\n## Conclusion\n\n`;
  if (contractFailures.length === 0) {
    summaryMd += `✅ **NO CONTRACT FAILURES.** All successful responses met their contracts.\n`;
    if (infrastructureFailures.length === 0) {
      summaryMd += `✅ **NO INFRASTRUCTURE FAILURES.** All tests completed successfully.\n`;
    } else {
      summaryMd += `⚠️ **${infrastructureFailures.length} INFRASTRUCTURE FAILURES** after retry.\n`;
    }
  } else {
    summaryMd += `❌ **${contractFailures.length} CONTRACT FAILURES.** See violations above.\n`;
  }

  const summaryPath = path.join(__dirname, 'lc_integration_summary_v2.md');
  fs.writeFileSync(summaryPath, summaryMd);

  console.log(`Summary saved to: ${summaryPath}\n`);

  // ========================================================================
  // FINAL REPORT
  // ========================================================================
  
  console.log(`${'='.repeat(80)}`);
  console.log('PHASE 2B: INTEGRATION TESTS WITH RETRY - COMPLETE');
  console.log(`${'='.repeat(80)}\n`);

  console.log(`📊 Test Results:`);
  console.log(`   ✅ PASSED: ${passCount}/${results.length}`);
  console.log(`   ❌ FAILED (Contract): ${contractFailures.length}/${results.length}`);
  console.log(`   ⚠️  FAILED (Infrastructure): ${infrastructureFailures.length}/${results.length}`);
  console.log(`\n📡 HTTP Calls: ${httpCallCount} real requests to Worker`);
  console.log(`📁 Results saved to: tests/lc_integration_raw_results.json`);
  console.log(`📄 Summary saved to: tests/lc_integration_summary_v2.md\n`);

  return {
    passCount,
    contractFailures: contractFailures.length,
    infrastructureFailures: infrastructureFailures.length,
    totalTests: results.length,
    httpCallCount,
    results
  };
}

// Run tests
runAllTests().catch(console.error);
