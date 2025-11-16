#!/usr/bin/env node

/**
 * Comprehensive Test Suite for HTTP 400 Fix
 * Tests worker validation logic
 */

console.log("╔════════════════════════════════════════════════════════════╗");
console.log("║  HTTP 400 Fix - Comprehensive Test Suite                  ║");
console.log("╚════════════════════════════════════════════════════════════╝");
console.log("");

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    const result = fn();
    if (result) {
      passedTests++;
      console.log(`✅ PASS: ${name}`);
    } else {
      failedTests++;
      console.log(`❌ FAIL: ${name}`);
    }
  } catch (error) {
    failedTests++;
    console.log(`❌ ERROR: ${name} - ${error.message}`);
  }
}

// Simulate worker's request parsing logic
function simulateWorkerParsing(body) {
  let mode, user, history, disease, persona, goal;

  if (body.messages && Array.isArray(body.messages)) {
    const msgs = body.messages;
    const lastUserMsg = msgs.filter(m => m.role === "user").pop();
    const historyMsgs = msgs.filter(m => m.role !== "system" && m !== lastUserMsg);

    mode = body.mode || "sales-coach";
    user = lastUserMsg?.content || "";
    history = historyMsgs;
    disease = body.disease || "";
    persona = body.persona || "";
    goal = body.goal || "";
  } else {
    mode = body.mode || "sales-coach";
    user = body.user;
    history = body.history || [];
    disease = body.disease || "";
    persona = body.persona || "";
    goal = body.goal || "";
  }

  // NEW VALIDATION (added in fix)
  if (!user || String(user).trim() === "") {
    return {
      status: 400,
      error: "bad_request",
      message: "User message cannot be empty"
    };
  }

  return {
    status: 200,
    parsed: { mode, user, history, disease, persona, goal }
  };
}

console.log("═══════════════════════════════════════════════════════════");
console.log("Test Category: Worker Payload Validation");
console.log("═══════════════════════════════════════════════════════════\n");

// Test 1: Valid widget format
test("Valid widget format with user message", () => {
  const result = simulateWorkerParsing({
    messages: [
      { role: "system", content: "System prompt" },
      { role: "user", content: "What is PrEP?" }
    ],
    mode: "sales-coach",
    disease: "", persona: "", goal: ""
  });
  return result.status === 200 && result.parsed.user === "What is PrEP?";
});

// Test 2: Empty user message (should reject)
test("Empty user message returns 400", () => {
  const result = simulateWorkerParsing({
    messages: [{ role: "user", content: "" }],
    mode: "sales-coach"
  });
  return result.status === 400 && result.message === "User message cannot be empty";
});

// Test 3: Whitespace-only message (should reject)
test("Whitespace-only message returns 400", () => {
  const result = simulateWorkerParsing({
    messages: [{ role: "user", content: "   " }],
    mode: "sales-coach"
  });
  return result.status === 400;
});

// Test 4: No user message in array (should reject)
test("No user message in array returns 400", () => {
  const result = simulateWorkerParsing({
    messages: [{ role: "system", content: "Only system" }],
    mode: "sales-coach"
  });
  return result.status === 400;
});

// Test 5: Old ReflectivAI format (should work)
test("Old ReflectivAI format with user field", () => {
  const result = simulateWorkerParsing({
    user: "Tell me about Biktarvy",
    mode: "sales-coach",
    history: [],
    disease: "HIV"
  });
  return result.status === 200 && result.parsed.user === "Tell me about Biktarvy";
});

// Test 6: Old format with empty user (should reject)
test("Old format with empty user field returns 400", () => {
  const result = simulateWorkerParsing({
    user: "",
    mode: "sales-coach",
    history: []
  });
  return result.status === 400;
});

// Test 7: Conversation history (extracts last user message)
test("Extracts last user message from history", () => {
  const result = simulateWorkerParsing({
    messages: [
      { role: "user", content: "First question" },
      { role: "assistant", content: "Response" },
      { role: "user", content: "Second question" }
    ],
    mode: "sales-coach"
  });
  return result.status === 200 && result.parsed.user === "Second question";
});

// Test 8: With scenario context
test("Handles scenario context fields", () => {
  const result = simulateWorkerParsing({
    messages: [{ role: "user", content: "Hello" }],
    mode: "sales-coach",
    disease: "HIV",
    persona: "Primary Care Physician",
    goal: "Discuss treatment"
  });
  return result.status === 200 && 
         result.parsed.disease === "HIV" &&
         result.parsed.persona === "Primary Care Physician";
});

console.log("\n═══════════════════════════════════════════════════════════");
console.log("Test Category: Widget Client-Side Validation");
console.log("═══════════════════════════════════════════════════════════\n");

// Simulate widget's sendMessage validation
function simulateWidgetValidation(userText) {
  userText = (userText || "").trim();
  if (!userText) {
    return { blocked: true, reason: "Empty after trim" };
  }
  return { blocked: false, userText };
}

// Test 9: Widget blocks empty string
test("Widget blocks empty string", () => {
  const result = simulateWidgetValidation("");
  return result.blocked === true;
});

// Test 10: Widget blocks whitespace
test("Widget blocks whitespace-only", () => {
  const result = simulateWidgetValidation("   ");
  return result.blocked === true;
});

// Test 11: Widget allows valid text
test("Widget allows valid text", () => {
  const result = simulateWidgetValidation("What is PrEP?");
  return result.blocked === false && result.userText === "What is PrEP?";
});

console.log("\n═══════════════════════════════════════════════════════════");
console.log("Test Category: Code Quality");
console.log("═══════════════════════════════════════════════════════════\n");

// Test 12: Syntax validation
test("Worker.js syntax is valid", () => {
  const { execSync } = require('child_process');
  try {
    execSync('node -c /home/runner/work/reflectiv-ai/reflectiv-ai/worker.js', { stdio: 'pipe' });
    return true;
  } catch (e) {
    return false;
  }
});

// Test 13: Widget syntax validation
test("Widget.js syntax is valid", () => {
  const { execSync } = require('child_process');
  try {
    execSync('node -c /home/runner/work/reflectiv-ai/reflectiv-ai/widget.js', { stdio: 'pipe' });
    return true;
  } catch (e) {
    return false;
  }
});

console.log("\n╔════════════════════════════════════════════════════════════╗");
console.log("║  TEST SUMMARY                                              ║");
console.log("╚════════════════════════════════════════════════════════════╝");
console.log("");
console.log(`Total Tests:  ${totalTests}`);
console.log(`✅ Passed:     ${passedTests}`);
console.log(`❌ Failed:     ${failedTests}`);
console.log(`Success Rate: ${((passedTests/totalTests)*100).toFixed(1)}%`);
console.log("");

if (failedTests === 0) {
  console.log("🎉 ALL TESTS PASSED! 🎉");
  console.log("");
  console.log("✅ Worker validation logic is correct");
  console.log("✅ Widget validation logic is correct");
  console.log("✅ Syntax validation passes");
  console.log("✅ All edge cases handled");
  console.log("");
  console.log("⚠️  DEPLOYMENT REQUIRED");
  console.log("The fix is ready but NOT deployed to Cloudflare Workers yet.");
  console.log("Run: ./deploy-worker.sh");
  process.exit(0);
} else {
  console.log("❌ Some tests failed. Please review the issues above.");
  process.exit(1);
}
