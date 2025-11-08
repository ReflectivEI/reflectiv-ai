/**
 * Unit tests for worker.js
 * Run with: node worker.test.js
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

// Mock environment
const mockEnv = {
  CORS_ORIGINS: "https://reflectivai.github.io,https://tonyabdelmalak.github.io",
  PROVIDER_URL: "https://api.groq.com/openai/v1/chat/completions",
  PROVIDER_MODEL: "llama-3.1-70b-versatile",
  PROVIDER_KEY: "test-key",
  MAX_OUTPUT_TOKENS: "1400"
};

// Test /chat error handling
// Test existing endpoints still work
async function testExistingEndpoints() {
  console.log("\n=== Testing existing endpoints ===");

  // Test /health
  const req1 = new Request("http://test.com/health", {
    method: "GET",
    headers: { "Origin": "https://reflectivai.github.io" }
  });
  const res1 = await worker.fetch(req1, mockEnv, {});
  const text1 = await res1.text();
  
  assert(res1.status === 200, "/health returns 200");
  assert(text1 === "ok", "/health returns 'ok'");

  // Test /version
  const req2 = new Request("http://test.com/version", {
    method: "GET",
    headers: { "Origin": "https://reflectivai.github.io" }
  });
  const res2 = await worker.fetch(req2, mockEnv, {});
  const data2 = await res2.json();
  
  assert(res2.status === 200, "/version returns 200");
  assert(data2.version === "r10.1", "/version returns correct version");

  // Test 404
  const req3 = new Request("http://test.com/nonexistent", {
    method: "GET",
    headers: { "Origin": "https://reflectivai.github.io" }
  });
  const res3 = await worker.fetch(req3, mockEnv, {});
  const data3 = await res3.json();
  
  assert(res3.status === 404, "Unknown endpoint returns 404");
  assert(data3.error === "not_found", "Returns not_found error");
}

// Run all tests
async function runTests() {
  console.log("Running worker.js tests...\n");

  try {
    await testExistingEndpoints();

    console.log("\n=== Test Summary ===");
    console.log(`Passed: ${testsPassed}`);
    console.log(`Failed: ${testsFailed}`);
    
    if (testsFailed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error("Test execution failed:", error);
    process.exit(1);
  }
}

runTests();
