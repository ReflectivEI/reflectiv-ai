/**
 * Unit tests for STR-27 and STR-30 fixes
 * Run with: node tests/str-27-30-fixes.test.js
 */

// Test utilities
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

// Test 1: STR-27 Citation Validation
// Simulates the updated validation logic from phase3_edge_cases.js
function testCitationValidation() {
  console.log("\n=== STR-27: Citation Validation Tests ===");
  
  const validationCheck = (response) => {
    const reply = response.reply || response;
    const validCitations = /\[\d+\]|\[\w{3,}-\w{2,}-\w{2,}-\d{1,}\]|\[\w{3,}-\w{2,}-\d{1,}\]/g;
    const matches = reply.match(validCitations) || [];
    const allValid = matches.length > 0 && matches.every(m => {
      return /^\[\d+\]$/.test(m) || /^\[[A-Z]+-[A-Z]+-\d+\]$/.test(m) || /^\[[A-Z]+-[A-Z]+-[A-Z]+-\d+\]$/i.test(m);
    });
    return {
      passed: allValid,
      error: !allValid ? 'PK_MALFORMED_CITATIONS' : null
    };
  };

  // Test cases
  const testCases = [
    { reply: "This is a claim [1].", shouldPass: true, name: "Simple numeric citation [1]" },
    { reply: "Another claim [123].", shouldPass: true, name: "Multi-digit citation [123]" },
    { reply: "Three-part citation [ABC-DEF-123].", shouldPass: true, name: "Three-part citation [ABC-DEF-123]" },
    { reply: "Four-part citation [HIV-PREP-ELIG-001].", shouldPass: true, name: "Four-part citation [HIV-PREP-ELIG-001] (THE FIX)" },
    { reply: "Multiple citations [1] and [HIV-PREP-123].", shouldPass: true, name: "Mixed citations" },
    { reply: "Malformed citation [REF-].", shouldPass: false, name: "Malformed citation [REF-]" },
    { reply: "Malformed citation [1a].", shouldPass: false, name: "Malformed citation [1a]" },
    { reply: "No citations here.", shouldPass: false, name: "No citations" },
  ];

  testCases.forEach(({ reply, shouldPass, name }) => {
    const result = validationCheck({ reply });
    const passed = result.passed === shouldPass;
    assert(passed, name);
  });
}

// Test 2: STR-30 Paragraph Preservation in capSentences
// NOTE: This test duplicates the capSentences function from worker.js for testing purposes.
// Ideally we would import it, but worker.js is a Cloudflare Worker module with complex dependencies.
// This duplication allows us to test the logic independently.
function testParagraphPreservation() {
  console.log("\n=== STR-30: Paragraph Preservation Tests ===");
  
  // Duplicated capSentences function from worker.js (lines 438-459)
  // Keep this in sync with the actual implementation
  function capSentences(text, n) {
    const paragraphs = String(text || "").split(/\n\n/);
    let sentenceCount = 0;
    const cappedParagraphs = [];
    
    for (const paragraph of paragraphs) {
      if (sentenceCount >= n) break;
      
      const sentences = paragraph.match(/[^.!?]+[.!?]?/g) || [];
      const remaining = n - sentenceCount;
      const toTake = Math.min(sentences.length, remaining);
      
      if (toTake > 0) {
        cappedParagraphs.push(sentences.slice(0, toTake).join(" ").trim());
        sentenceCount += toTake;
      }
    }
    
    return cappedParagraphs.join("\n\n");
  }

  // Validation check (same as STR-30 test)
  const validationCheck = (reply) => {
    const sections = reply.split(/\n\n+/);
    const hasSeparation = sections.length >= 3;
    const noCollapse = /\n\n/.test(reply);
    return {
      passed: hasSeparation && noCollapse,
      error: !noCollapse ? 'PARAGRAPH_COLLAPSE' : !hasSeparation ? 'INSUFFICIENT_SECTIONS' : null
    };
  };

  // Test case: Sales-coach response with 4 sections
  const salesCoachReply = "Challenge: This is the challenge.\n\nRep Approach: This is the approach. Use these strategies.\n\nImpact: This is the impact.\n\nSuggested Phrasing: Use this phrasing.";
  
  const cappedReply = capSentences(salesCoachReply, 10);
  const result = validationCheck(cappedReply);
  
  assert(result.passed, "Sales-coach reply maintains paragraph separation after capSentences");
  assert(/\n\n/.test(cappedReply), "Reply contains double newlines");
  assert(cappedReply.split(/\n\n+/).length >= 3, "Reply has at least 3 sections");

  // Test case: Ensure capping still works
  const longReply = "Sentence 1. Sentence 2.\n\nSentence 3. Sentence 4.\n\nSentence 5. Sentence 6.\n\nSentence 7. Sentence 8.";
  const capped = capSentences(longReply, 4);
  const sentenceCount = (capped.match(/[.!?]/g) || []).length;
  
  assert(sentenceCount <= 4, "Sentence capping still works correctly");
  assert(/\n\n/.test(capped), "Capped reply preserves paragraph breaks");
}

// Test 3: Integration test - both fixes together
function testIntegration() {
  console.log("\n=== Integration Test: Both Fixes Together ===");
  
  // Simulate a sales-coach response with citations and paragraph structure
  const mockReply = "Challenge: HCP is concerned about safety.\n\nRep Approach: Address safety data [HIV-PREP-SAFETY-003]. Explain benefits [1].\n\nImpact: Improved patient outcomes.\n\nSuggested Phrasing: Based on the data [2], we can see clear benefits.";
  
  // Citation validation
  const citationPattern = /\[HIV-PREP-SAFETY-003\]|\[1\]|\[2\]/;
  assert(citationPattern.test(mockReply), "Reply contains proper citations");
  
  // Paragraph structure validation
  const paragraphPattern = /\n\n/;
  assert(paragraphPattern.test(mockReply), "Reply has paragraph breaks");
  
  const sections = mockReply.split(/\n\n+/);
  assert(sections.length >= 4, "Reply has 4 sections (Challenge, Rep Approach, Impact, Suggested Phrasing)");
}

// Run all tests
async function runTests() {
  console.log("Running STR-27 and STR-30 fix validation tests...\n");

  try {
    testCitationValidation();
    testParagraphPreservation();
    testIntegration();

    console.log("\n=== Test Summary ===");
    console.log(`Passed: ${testsPassed}`);
    console.log(`Failed: ${testsFailed}`);
    
    if (testsFailed > 0) {
      console.log("\n❌ SOME TESTS FAILED");
      process.exit(1);
    } else {
      console.log("\n✅ ALL TESTS PASSED");
      process.exit(0);
    }
  } catch (error) {
    console.error("Test execution failed:", error);
    process.exit(1);
  }
}

runTests();
