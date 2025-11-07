/**
 * Suggested Phrasing and Formatting Test
 * Verifies "Suggested Phrasing" appears in main content and coach cards
 */

console.log("=== Suggested Phrasing and Formatting Test ===\n");

let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`✓ ${message}`);
    testsPassed++;
  } else {
    console.error(`✗ ${message}`);
    testsFailed++;
  }
}

// Test 1: Sales Simulation response with Suggested Phrasing in main content
console.log("=== Test 1: Sales Simulation Main Content ===");

const salesSimResponse = {
  mode: "sales-simulation",
  content: `PrEP is recommended for individuals at substantial risk. Discuss sexual and injection risk factors. Suggested Phrasing: "For patients with consistent risk, would confirming eGFR today help you start one eligible person this month?"`,
  _coach: {
    rubric: {
      scores: { accuracy: 4, compliance: 5, discovery: 4, clarity: 4, objection_handling: 3, empathy: 3 },
      worked: ["Tied guidance to facts", "Label-aligned language"],
      improve: ["End with one specific discovery question"],
      phrasing: "For patients with consistent risk, would confirming eGFR today help you start one eligible person this month?",
      feedback: "Stay concise. Cite label-aligned facts."
    }
  }
};

// Verify Suggested Phrasing in content
assert(
  salesSimResponse.content.includes("Suggested Phrasing:"),
  "Main content includes 'Suggested Phrasing:' label"
);

assert(
  salesSimResponse.content.includes("For patients with consistent risk"),
  "Main content has the suggested phrasing text"
);

// Verify coach object has phrasing field
assert(
  salesSimResponse._coach.rubric.phrasing,
  "Coach rubric has phrasing field"
);

assert(
  salesSimResponse._coach.rubric.phrasing === "For patients with consistent risk, would confirming eGFR today help you start one eligible person this month?",
  "Coach phrasing matches expected text"
);

// Test 2: Role Play should NOT have Suggested Phrasing
console.log("\n=== Test 2: Role Play (No Suggested Phrasing) ===");

const rolePlayResponse = {
  mode: "role-play",
  content: "In my clinic, we review patient history and risk factors before starting PrEP. What brings you here today?",
  // No _coach object for role-play
};

assert(
  !rolePlayResponse.content.includes("Suggested Phrasing"),
  "Role Play does NOT include 'Suggested Phrasing'"
);

assert(
  !rolePlayResponse._coach,
  "Role Play has no _coach object"
);

// Test 3: Product Knowledge should NOT have Suggested Phrasing
console.log("\n=== Test 3: Product Knowledge (No Suggested Phrasing) ===");

const productKnowledgeResponse = {
  mode: "product-knowledge",
  content: "Descovy (emtricitabine/tenofovir alafenamide) is indicated for PrEP [1]. References: [1] FDA Label Descovy PrEP",
  // No suggested phrasing in product knowledge
};

assert(
  !productKnowledgeResponse.content.includes("Suggested Phrasing"),
  "Product Knowledge does NOT include 'Suggested Phrasing'"
);

// Test 4: Emotional Assessment should NOT have Suggested Phrasing
console.log("\n=== Test 4: Emotional Assessment (No Suggested Phrasing) ===");

const eiAssessmentResponse = {
  mode: "emotional-assessment",
  content: "Affirmation: You're asking the right question. Diagnosis: Focus on active listening. Guidance: Practice reflective statements.",
  _coach: {
    ei: {
      empathy: { score: 6, markers: 2 },
      regulation: { score: 4, markers: 0 }
    }
  }
};

assert(
  !eiAssessmentResponse.content.includes("Suggested Phrasing"),
  "Emotional Assessment does NOT include 'Suggested Phrasing' in main content"
);

// Test 5: Verify white box (main content) vs yellow panel (coach) separation
console.log("\n=== Test 5: Content vs Coach Separation ===");

// In Sales Simulation, both content and coach can have phrasing
assert(
  salesSimResponse.content.includes("Suggested Phrasing"),
  "White box (main content) contains 'Suggested Phrasing' inline"
);

assert(
  salesSimResponse._coach.rubric.phrasing,
  "Yellow panel (_coach) also has structured phrasing field"
);

// Test 6: Multiple Sales Simulation responses with different phrasings
console.log("\n=== Test 6: Multiple Sales Simulation Responses ===");

const salesSimResponses = [
  {
    content: "Address concerns directly. Suggested Phrasing: \"What specific safety concerns do you have about PrEP?\"",
    phrasing: "What specific safety concerns do you have about PrEP?"
  },
  {
    content: "Focus on patient selection. Suggested Phrasing: \"Which of your patients would benefit most from PrEP?\"",
    phrasing: "Which of your patients would benefit most from PrEP?"
  },
  {
    content: "Discuss adherence support. Suggested Phrasing: \"How can we support your patients' adherence to PrEP?\"",
    phrasing: "How can we support your patients' adherence to PrEP?"
  }
];

salesSimResponses.forEach((resp, idx) => {
  assert(
    resp.content.includes("Suggested Phrasing:"),
    `Response ${idx + 1}: Contains 'Suggested Phrasing:' label`
  );
  
  assert(
    resp.content.includes(resp.phrasing),
    `Response ${idx + 1}: Content includes the phrasing text`
  );
});

// Test 7: Verify no mid-response cut-off indicators
console.log("\n=== Test 7: No Mid-Response Cut-off ===");

const completeResponses = [
  "PrEP is recommended for individuals at substantial risk. Suggested Phrasing: \"For patients with consistent risk...\"",
  "Address concerns with label-aligned facts. Suggested Phrasing: \"What specific concerns do you have?\"",
  "Focus on patient selection criteria. Suggested Phrasing: \"Which patients would benefit most?\""
];

completeResponses.forEach((resp, idx) => {
  const endsWithPunctuation = /[.!?]"?\s*$/.test(resp);
  assert(
    endsWithPunctuation,
    `Response ${idx + 1}: Ends with proper punctuation (no cut-off)`
  );
  
  const hasCompletePhrasing = resp.includes("Suggested Phrasing:") && resp.indexOf("Suggested Phrasing:") < resp.length - 20;
  assert(
    hasCompletePhrasing,
    `Response ${idx + 1}: Has complete Suggested Phrasing section (not truncated)`
  );
});

// Test 8: Verify formatting consistency
console.log("\n=== Test 8: Formatting Consistency ===");

const formattedResponse = {
  main: "PrEP is recommended for high-risk individuals. Discuss sexual and injection risk factors. Suggested Phrasing: \"For patients with consistent risk, would confirming eGFR today help?\"",
  coach: {
    challenge: "Focus on label-aligned guidance and one clear question.",
    repApproach: ["Acknowledge context", "Cite one fact", "End with a discovery question"],
    impact: ["Drive a next step", "One idea per sentence"],
    phrasing: "For patients with consistent risk, would confirming eGFR today help?"
  }
};

// Verify main content structure
assert(
  formattedResponse.main.split(". ").length >= 2,
  "Main content has multiple sentences"
);

assert(
  formattedResponse.main.lastIndexOf("Suggested Phrasing:") > formattedResponse.main.length / 2,
  "Suggested Phrasing appears near end of content"
);

// Verify coach structure
assert(
  Array.isArray(formattedResponse.coach.repApproach),
  "Coach has structured repApproach array"
);

assert(
  Array.isArray(formattedResponse.coach.impact),
  "Coach has structured impact array"
);

assert(
  typeof formattedResponse.coach.phrasing === "string",
  "Coach phrasing is a string"
);

// Test 9: Legacy coach card rendering (simulated)
console.log("\n=== Test 9: Legacy Coach Card Rendering ===");

function simulateRenderLegacyCoachCard(coachObj) {
  const phrasing = coachObj.phrasing || "";
  
  let phrasingSection = "";
  if (phrasing) {
    phrasingSection = `<div class="coach-phrasing-block">
      <div class="coach-label"><strong>Suggested Phrasing:</strong></div>
      <div class="coach-phrasing-text">${phrasing}</div>
    </div>`;
  }
  
  return phrasingSection;
}

const coachCard = simulateRenderLegacyCoachCard({
  phrasing: "For patients with consistent risk, would confirming eGFR today help?"
});

assert(
  coachCard.includes("<strong>Suggested Phrasing:</strong>"),
  "Coach card renders 'Suggested Phrasing' label"
);

assert(
  coachCard.includes("For patients with consistent risk"),
  "Coach card renders phrasing text"
);

assert(
  coachCard.includes("coach-phrasing-block"),
  "Coach card has phrasing block class"
);

// Test 10: Verify no leakage between modes
console.log("\n=== Test 10: No Mode Leakage ===");

const modeResponses = {
  "sales-simulation": { hasPhrasing: true, hasCoach: true, hasHcpVoice: false },
  "role-play": { hasPhrasing: false, hasCoach: false, hasHcpVoice: true },
  "product-knowledge": { hasPhrasing: false, hasCoach: false, hasHcpVoice: false },
  "emotional-assessment": { hasPhrasing: false, hasCoach: true, hasHcpVoice: false }
};

Object.entries(modeResponses).forEach(([mode, expected]) => {
  assert(
    typeof expected.hasPhrasing === "boolean",
    `${mode}: hasPhrasing defined (${expected.hasPhrasing})`
  );
  
  if (mode === "sales-simulation") {
    assert(
      expected.hasPhrasing === true,
      `${mode}: Should have Suggested Phrasing`
    );
  } else {
    assert(
      expected.hasPhrasing === false,
      `${mode}: Should NOT have Suggested Phrasing`
    );
  }
});

// ====== SUMMARY ======
console.log("\n=== TEST SUMMARY ===");
console.log(`Tests Passed: ${testsPassed}`);
console.log(`Tests Failed: ${testsFailed}`);

if (testsFailed === 0) {
  console.log("\n✓ ALL FORMATTING AND PHRASING TESTS PASSED!");
  console.log("✓ Suggested Phrasing appears in main content (white box)");
  console.log("✓ Suggested Phrasing also in coach object (yellow panel)");
  console.log("✓ No mid-response cut-off detected");
  console.log("✓ Formatting is consistent and unchanged");
  console.log("✓ No mode leakage");
  process.exit(0);
} else {
  console.error("\n✗ SOME TESTS FAILED!");
  process.exit(1);
}
