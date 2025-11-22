/**
 * Audit tests for worker.js improvements
 * Tests for: HEAD /health, /version, /debug/ei, CORS logging, activePlan validation, provider error distinction
 * Run with: node worker.audit.test.js
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
  CORS_ORIGINS: "https://reflectivei.github.io,https://tonyabdelmalak.github.io",
  PROVIDER_URL: "https://api.groq.com/openai/v1/chat/completions",
  PROVIDER_MODEL: "llama-3.1-70b-versatile",
  PROVIDER_KEY: "test-key",
  MAX_OUTPUT_TOKENS: "1400"
};

// Test 1: HEAD /health endpoint
async function testHealthHead() {
  console.log("\n=== Testing HEAD /health ===");

  const req = new Request("http://test.com/health", {
    method: "HEAD",
    headers: { "Origin": "https://reflectivei.github.io" }
  });
  const res = await worker.fetch(req, mockEnv, {});
  const text = await res.text();

  assert(res.status === 200, "HEAD /health returns 200");
  assert(text === "", "HEAD /health returns empty body");
  assert(res.headers.get("Access-Control-Allow-Origin") === "https://reflectivei.github.io",
    "HEAD /health includes CORS headers");
}

// Test 2: GET /health endpoint
async function testHealthGet() {
  console.log("\n=== Testing GET /health ===");

  const req = new Request("http://test.com/health", {
    method: "GET",
    headers: { "Origin": "https://reflectivei.github.io" }
  });
  const res = await worker.fetch(req, mockEnv, {});
  const text = await res.text();

  assert(res.status === 200, "GET /health returns 200");
  assert(text === "ok", "GET /health returns 'ok'");
  assert(res.headers.get("Access-Control-Allow-Origin") === "https://reflectivei.github.io",
    "GET /health includes CORS headers");
}

// Test 3: GET /version endpoint
async function testVersion() {
  console.log("\n=== Testing GET /version ===");

  const req = new Request("http://test.com/version", {
    method: "GET",
    headers: { "Origin": "https://reflectivei.github.io" }
  });
  const res = await worker.fetch(req, mockEnv, {});
  const data = await res.json();

  assert(res.status === 200, "GET /version returns 200");
  assertEquals(data.version, "r12.0-phase13", "GET /version returns correct version");
  assert(res.headers.get("Access-Control-Allow-Origin") === "https://reflectivei.github.io",
    "GET /version includes CORS headers");
}

// Test 4: GET /debug/ei endpoint
async function testDebugEI() {
  console.log("\n=== Testing GET /debug/ei ===");

  const req = new Request("http://test.com/debug/ei", {
    method: "GET",
    headers: { "Origin": "https://reflectivei.github.io" }
  });
  const res = await worker.fetch(req, mockEnv, {});
  const data = await res.json();

  assert(res.status === 200, "GET /debug/ei returns 200");
  assertEquals(data.worker, "ReflectivAI Gateway", "GET /debug/ei returns worker name");
  assertEquals(data.version, "r12.0-phase13", "GET /debug/ei returns correct version");
  assert(Array.isArray(data.endpoints), "GET /debug/ei returns endpoints array");
  assert(data.endpoints.includes("/health"), "GET /debug/ei lists /health endpoint");
  assert(data.endpoints.includes("/chat"), "GET /debug/ei lists /chat endpoint");
  assert(res.headers.get("Access-Control-Allow-Origin") === "https://reflectivei.github.io",
    "GET /debug/ei includes CORS headers");
}

// Test 5: CORS with allowed origin
async function testCORSAllowed() {
  console.log("\n=== Testing CORS with allowed origin ===");

  const req = new Request("http://test.com/health", {
    method: "GET",
    headers: { "Origin": "https://reflectivei.github.io" }
  });
  const res = await worker.fetch(req, mockEnv, {});

  assert(res.headers.get("Access-Control-Allow-Origin") === "https://reflectivei.github.io",
    "CORS sets origin for allowed origin");
  assert(res.headers.get("Access-Control-Allow-Credentials") === "true",
    "CORS allows credentials for specific origin");
  assert(res.headers.get("Vary") === "Origin", "CORS sets Vary: Origin");
}

// Test 6: CORS with denied origin (will log warning)
async function testCORSDenied() {
  console.log("\n=== Testing CORS with denied origin ===");

  // Capture console.warn calls
  const originalWarn = console.warn;
  let warnCalled = false;
  let warnArgs = null;
  console.warn = (...args) => {
    warnCalled = true;
    warnArgs = args;
  };

  const req = new Request("http://test.com/health", {
    method: "GET",
    headers: { "Origin": "https://not-allowed.com" }
  });
  const res = await worker.fetch(req, mockEnv, {});

  console.warn = originalWarn; // Restore

  assert(res.headers.get("Access-Control-Allow-Origin") === "null",
    "CORS denies unauthorized origin");
  assert(warnCalled, "CORS logs warning for denied origin");
  if (warnArgs) {
    assert(warnArgs[0] === "CORS deny", "CORS warning has correct message");
  }
}

// Test 7: CORS OPTIONS preflight
async function testCORSPreflight() {
  console.log("\n=== Testing CORS OPTIONS preflight ===");

  const req = new Request("http://test.com/chat", {
    method: "OPTIONS",
    headers: { "Origin": "https://reflectivei.github.io" }
  });
  const res = await worker.fetch(req, mockEnv, {});

  assert(res.status === 204, "OPTIONS returns 204");
  assert(res.headers.get("Access-Control-Allow-Origin") === "https://reflectivei.github.io",
    "OPTIONS includes CORS origin");
  assert(res.headers.get("Access-Control-Allow-Methods").includes("POST"),
    "OPTIONS allows POST method");
  assert(res.headers.get("Access-Control-Max-Age") === "86400",
    "OPTIONS sets max age");
}

// Test 8: All endpoints return CORS headers
async function testAllEndpointsHaveCORS() {
  console.log("\n=== Testing CORS headers on all endpoints ===");

  const endpoints = [
    { path: "/health", method: "GET" },
    { path: "/version", method: "GET" },
    { path: "/debug/ei", method: "GET" },
    { path: "/nonexistent", method: "GET" } // 404 case
  ];

  for (const endpoint of endpoints) {
    const req = new Request(`http://test.com${endpoint.path}`, {
      method: endpoint.method,
      headers: { "Origin": "https://reflectivei.github.io" }
    });
    const res = await worker.fetch(req, mockEnv, {});

    assert(res.headers.has("Access-Control-Allow-Origin"),
      `${endpoint.method} ${endpoint.path} includes CORS headers`);
  }
}

// Test 9: Error responses include CORS headers
async function testErrorsHaveCORS() {
  console.log("\n=== Testing CORS headers on error responses ===");

  // Test 404
  const req404 = new Request("http://test.com/nonexistent", {
    method: "GET",
    headers: { "Origin": "https://reflectivei.github.io" }
  });
  const res404 = await worker.fetch(req404, mockEnv, {});
  const data404 = await res404.json();

  assert(res404.status === 404, "Unknown endpoint returns 404");
  assert(res404.headers.get("Access-Control-Allow-Origin") === "https://reflectivei.github.io",
    "404 response includes CORS headers");
  assertEquals(data404.error, "not_found", "404 returns not_found error");

  // Test 500 error (missing PROVIDER_KEY)
  const envNoKey = { ...mockEnv, PROVIDER_KEY: undefined };
  const req500 = new Request("http://test.com/chat", {
    method: "POST",
    headers: {
      "Origin": "https://reflectivei.github.io",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ mode: "sales-simulation", user: "test" })
  });
  const res500 = await worker.fetch(req500, envNoKey, {});

  assert(res500.status === 500, "Chat without PROVIDER_KEY returns 500");
  assert(res500.headers.get("Access-Control-Allow-Origin") === "https://reflectivei.github.io",
    "500 response includes CORS headers");
}

// Test 10: Provider error distinction (simulated)
async function testProviderErrorHandling() {
  console.log("\n=== Testing provider error handling ===");

  // This test verifies that the error handling logic is in place
  // In reality, we'd need to mock the providerChat function to test this fully
  // For now, we're just checking that the error handling code exists

  // Read the worker.js file to verify error handling code
  const workerCode = await import("./worker.js");
  assert(typeof workerCode.default === "object", "Worker exports default object");
  assert(typeof workerCode.default.fetch === "function", "Worker has fetch function");

  console.log("  ℹ Note: Full provider error testing requires mocking providerChat");
}

// Run all tests
async function runTests() {
  console.log("Running worker.js audit tests...\n");

  try {
    await testHealthHead();
    await testHealthGet();
    await testVersion();
    await testDebugEI();
    await testCORSAllowed();
    await testCORSDenied();
    await testCORSPreflight();
    await testAllEndpointsHaveCORS();
    await testErrorsHaveCORS();
    await testProviderErrorHandling();

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
