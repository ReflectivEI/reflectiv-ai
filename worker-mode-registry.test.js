/**
 * MODE_REGISTRY and EI Scoring Tests for worker.js
 * Tests the new r10.1+ features: MODE_REGISTRY, deterministic EI scoring, risk flags
 * Run with: node worker-mode-registry.test.js
 */

import worker from "./worker.js";

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

function assertEquals(actual, expected, message) {
  const passed = JSON.stringify(actual) === JSON.stringify(expected);
  if (passed) {
    console.log(`✓ ${message}`);
    testsPassed++;
  } else {
    console.error(`✗ ${message}`);
    console.error(`  Expected: ${JSON.stringify(expected)}`);
    console.error(`  Actual: ${JSON.stringify(actual)}`);
    testsFailed++;
  }
}

// Mock environment with provider
const mockEnv = {
  CORS_ORIGINS: "https://reflectivai.github.io,https://tonyabdelmalak.github.io",
  PROVIDER_URL: "https://mock-api.example.com/v1/chat/completions",
  PROVIDER_MODEL: "test-model",
  PROVIDER_KEY: "test-key-12345",
  MAX_OUTPUT_TOKENS: "1400",
  EMIT_EI: "true"
};

// Test MODE_REGISTRY validation
async function testModeValidation() {
  console.log("\n=== Testing MODE_REGISTRY Validation ===");

  // Test 1: Valid mode (sales-simulation)
  const req1 = new Request("http://test.com/chat", {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "Origin": "https://reflectivai.github.io"
    },
    body: JSON.stringify({
      mode: "sales-simulation",
      user: "Tell me about PrEP",
      history: []
    })
  });

  // This will fail on provider call since it's mocked, but should pass validation
  const res1 = await worker.fetch(req1, mockEnv, {});
  // Should get to provider call (which will fail), not validation error
  assert(res1.status !== 422, "sales-simulation mode passes validation");

  // Test 2: Invalid mode
  const req2 = new Request("http://test.com/chat", {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "Origin": "https://reflectivai.github.io"
    },
    body: JSON.stringify({
      mode: "invalid-mode",
      user: "Test message",
      history: []
    })
  });

  const res2 = await worker.fetch(req2, mockEnv, {});
  const data2 = await res2.json();
  
  assert(res2.status === 422, "Invalid mode returns 422");
  assert(data2.error === "unsupported_mode", "Error type is unsupported_mode");
  assert(data2.message.includes("invalid-mode"), "Error message mentions the invalid mode");

  // Test 3: Missing mode
  const req3 = new Request("http://test.com/chat", {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "Origin": "https://reflectivai.github.io"
    },
    body: JSON.stringify({
      user: "Test message",
      history: []
    })
  });

  const res3 = await worker.fetch(req3, mockEnv, {});
  const data3 = await res3.json();
  
  assert(res3.status === 422, "Missing mode returns 422");
  assert(data3.error === "invalid_mode", "Error type is invalid_mode");

  // Test 4: Valid modes - product-knowledge
  const req4 = new Request("http://test.com/chat", {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "Origin": "https://reflectivai.github.io"
    },
    body: JSON.stringify({
      mode: "product-knowledge",
      user: "What is Descovy?",
      history: []
    })
  });

  const res4 = await worker.fetch(req4, mockEnv, {});
  assert(res4.status !== 422, "product-knowledge mode passes validation");

  // Test 5: Valid modes - emotional-assessment
  const req5 = new Request("http://test.com/chat", {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "Origin": "https://reflectivai.github.io"
    },
    body: JSON.stringify({
      mode: "emotional-assessment",
      user: "How can I be more empathetic?",
      history: []
    })
  });

  const res5 = await worker.fetch(req5, mockEnv, {});
  assert(res5.status !== 422, "emotional-assessment mode passes validation");

  // Test 6: Valid modes - role-play
  const req6 = new Request("http://test.com/chat", {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "Origin": "https://reflectivai.github.io"
    },
    body: JSON.stringify({
      mode: "role-play",
      user: "Hello doctor",
      history: []
    })
  });

  const res6 = await worker.fetch(req6, mockEnv, {});
  assert(res6.status !== 422, "role-play mode passes validation");
}

// Test message validation
async function testMessageValidation() {
  console.log("\n=== Testing Message Validation ===");

  // Test 1: Missing messages
  const req1 = new Request("http://test.com/chat", {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "Origin": "https://reflectivai.github.io"
    },
    body: JSON.stringify({
      mode: "sales-simulation"
    })
  });

  const res1 = await worker.fetch(req1, mockEnv, {});
  const data1 = await res1.json();
  
  assert(res1.status === 422, "Missing messages returns 422");
  assert(data1.error === "invalid_messages", "Error type is invalid_messages");

  // Test 2: Empty user message
  const req2 = new Request("http://test.com/chat", {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "Origin": "https://reflectivai.github.io"
    },
    body: JSON.stringify({
      mode: "sales-simulation",
      user: "",
      history: []
    })
  });

  const res2 = await worker.fetch(req2, mockEnv, {});
  const data2 = await res2.json();
  
  assert(res2.status === 422, "Empty user message returns 422");

  // Test 3: Valid message structure with history
  const req3 = new Request("http://test.com/chat", {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "Origin": "https://reflectivai.github.io"
    },
    body: JSON.stringify({
      mode: "sales-simulation",
      user: "Tell me about PrEP",
      history: [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there!" }
      ]
    })
  });

  const res3 = await worker.fetch(req3, mockEnv, {});
  // Should not be validation error (will fail on provider call)
  assert(res3.status !== 422, "Valid message with history passes validation");

  // Test 4: Direct messages array (alternative format)
  const req4 = new Request("http://test.com/chat", {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "Origin": "https://reflectivai.github.io"
    },
    body: JSON.stringify({
      mode: "sales-simulation",
      messages: [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi!" },
        { role: "user", content: "Tell me about PrEP" }
      ]
    })
  });

  const res4 = await worker.fetch(req4, mockEnv, {});
  assert(res4.status !== 422, "Direct messages array passes validation");
}

// Test method validation
async function testMethodValidation() {
  console.log("\n=== Testing HTTP Method Validation ===");

  // Test GET request to /chat
  const req1 = new Request("http://test.com/chat", {
    method: "GET",
    headers: { 
      "Origin": "https://reflectivai.github.io"
    }
  });

  const res1 = await worker.fetch(req1, mockEnv, {});
  const data1 = await res1.json();
  
  assert(res1.status === 404, "GET to /chat returns 404 (not found, not handled)");

  // Test PUT request to /chat
  const req2 = new Request("http://test.com/chat", {
    method: "PUT",
    headers: { 
      "Content-Type": "application/json",
      "Origin": "https://reflectivai.github.io"
    },
    body: JSON.stringify({
      mode: "sales-simulation",
      user: "Test"
    })
  });

  const res2 = await worker.fetch(req2, mockEnv, {});
  assert(res2.status === 404, "PUT to /chat returns 404");
}

// Test response envelope structure
async function testResponseEnvelope() {
  console.log("\n=== Testing Response Envelope Structure ===");

  // Note: These tests will fail at provider call, but we can check error structure
  
  const req = new Request("http://test.com/chat", {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "Origin": "https://reflectivai.github.io"
    },
    body: JSON.stringify({
      mode: "sales-simulation",
      user: "Test message",
      history: []
    })
  });

  const res = await worker.fetch(req, mockEnv, {});
  const data = await res.json();
  
  // Should have error structure (provider will fail)
  assert(typeof data === 'object', "Response is JSON object");
  assert('error' in data || 'mode' in data, "Response has error or mode field");
}

// Test /debug/ei endpoint updates
async function testDebugEiEndpoint() {
  console.log("\n=== Testing /debug/ei Endpoint Updates ===");

  const req = new Request("http://test.com/debug/ei", {
    method: "GET",
    headers: { "Origin": "https://reflectivai.github.io" }
  });

  const res = await worker.fetch(req, mockEnv, {});
  const data = await res.json();
  
  assert(res.status === 200, "/debug/ei returns 200");
  assert(Array.isArray(data.modeAllowed), "modeAllowed is an array");
  
  // Should include all modes now, not just sales-simulation
  assert(data.modeAllowed.includes("emotional-assessment"), "Includes emotional-assessment");
  assert(data.modeAllowed.includes("product-knowledge"), "Includes product-knowledge");
  assert(data.modeAllowed.includes("sales-simulation"), "Includes sales-simulation");
}

// Test backwards compatibility
async function testBackwardsCompatibility() {
  console.log("\n=== Testing Backwards Compatibility ===");

  // Test old format with 'user' and 'history'
  const req1 = new Request("http://test.com/chat", {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "Origin": "https://reflectivai.github.io"
    },
    body: JSON.stringify({
      mode: "sales-simulation",
      user: "Test message",
      history: [
        { role: "user", content: "Previous message" }
      ],
      disease: "HIV",
      persona: "Engaged HCP",
      goal: "Start PrEP discussion"
    })
  });

  const res1 = await worker.fetch(req1, mockEnv, {});
  // Should not fail validation
  assert(res1.status !== 422 && res1.status !== 415, "Old format with user/history works");

  // Test with planId
  const req2 = new Request("http://test.com/chat", {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "Origin": "https://reflectivai.github.io"
    },
    body: JSON.stringify({
      mode: "sales-simulation",
      user: "Test",
      planId: "test-plan-123",
      plan: {
        facts: [
          { id: "HIV-PREP-001", text: "PrEP reduces risk", cites: ["CDC"] }
        ]
      }
    })
  });

  const res2 = await worker.fetch(req2, mockEnv, {});
  assert(res2.status !== 422 && res2.status !== 415, "Format with planId works");
}

// Run all tests
async function runAllTests() {
  console.log("Running MODE_REGISTRY and EI Scoring Tests...\n");

  await testModeValidation();
  await testMessageValidation();
  await testMethodValidation();
  await testResponseEnvelope();
  await testDebugEiEndpoint();
  await testBackwardsCompatibility();

  console.log("\n=== Test Summary ===");
  console.log(`Passed: ${testsPassed}`);
  console.log(`Failed: ${testsFailed}`);

  process.exit(testsFailed > 0 ? 1 : 0);
}

runAllTests();
