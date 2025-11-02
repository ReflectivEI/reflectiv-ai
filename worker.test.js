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

// Test /debug/ei endpoint
async function testDebugEi() {
  console.log("\n=== Testing /debug/ei endpoint ===");

  // Test 1: Basic request without flags
  const req1 = new Request("http://test.com/debug/ei", {
    method: "GET",
    headers: { "Origin": "https://reflectivai.github.io" }
  });
  const res1 = await worker.fetch(req1, mockEnv, {});
  const data1 = await res1.json();
  
  assert(res1.status === 200, "Returns 200 OK");
  assert(data1.queryFlag === false, "queryFlag is false when not set");
  assert(data1.headerFlag === false, "headerFlag is false when not set");
  assert(data1.envFlag === false, "envFlag is false when not set");
  assert(Array.isArray(data1.modeAllowed), "modeAllowed is an array");
  assert(data1.modeAllowed.includes("sales-simulation"), "modeAllowed includes sales-simulation");
  assert(typeof data1.time === "string", "time is a string");

  // Test 2: With query parameter emitEi=true
  const req2 = new Request("http://test.com/debug/ei?emitEi=true", {
    method: "GET",
    headers: { "Origin": "https://reflectivai.github.io" }
  });
  const res2 = await worker.fetch(req2, mockEnv, {});
  const data2 = await res2.json();
  
  assert(data2.queryFlag === true, "queryFlag is true when emitEi=true");

  // Test 3: With query parameter emitEi=1
  const req3 = new Request("http://test.com/debug/ei?emitEi=1", {
    method: "GET",
    headers: { "Origin": "https://reflectivai.github.io" }
  });
  const res3 = await worker.fetch(req3, mockEnv, {});
  const data3 = await res3.json();
  
  assert(data3.queryFlag === true, "queryFlag is true when emitEi=1");

  // Test 4: With header x-emit-ei=true
  const req4 = new Request("http://test.com/debug/ei", {
    method: "GET",
    headers: { 
      "Origin": "https://reflectivai.github.io",
      "x-emit-ei": "true"
    }
  });
  const res4 = await worker.fetch(req4, mockEnv, {});
  const data4 = await res4.json();
  
  assert(data4.headerFlag === true, "headerFlag is true when x-emit-ei=true");

  // Test 5: With env EMIT_EI=true
  const envWithEmit = { ...mockEnv, EMIT_EI: "true" };
  const req5 = new Request("http://test.com/debug/ei", {
    method: "GET",
    headers: { "Origin": "https://reflectivai.github.io" }
  });
  const res5 = await worker.fetch(req5, envWithEmit, {});
  const data5 = await res5.json();
  
  assert(data5.envFlag === true, "envFlag is true when EMIT_EI=true");
}

// Test /chat error handling
async function testChatErrorHandling() {
  console.log("\n=== Testing /chat error handling ===");

  // Test 1: Wrong Content-Type
  const req1 = new Request("http://test.com/chat", {
    method: "POST",
    headers: { 
      "Origin": "https://reflectivai.github.io",
      "content-type": "text/plain"
    },
    body: JSON.stringify({ mode: "sales-simulation", user: "test" })
  });
  const res1 = await worker.fetch(req1, mockEnv, {});
  const data1 = await res1.json();
  
  assert(res1.status === 415, "Returns 415 for wrong Content-Type");
  assert(data1.error === "unsupported_media_type", "Error type is unsupported_media_type");

  // Test 2: Invalid JSON
  const req2 = new Request("http://test.com/chat", {
    method: "POST",
    headers: { 
      "Origin": "https://reflectivai.github.io",
      "content-type": "application/json"
    },
    body: "invalid json {{"
  });
  const res2 = await worker.fetch(req2, mockEnv, {});
  const data2 = await res2.json();
  
  // readJson catches parse errors gracefully, so this might still return 200 with empty body processing
  // or could fail elsewhere - let's check it doesn't crash
  assert(res2.status >= 200 && res2.status < 500, "Handles invalid JSON without crashing");
}

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
    await testDebugEi();
    await testChatErrorHandling();
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
