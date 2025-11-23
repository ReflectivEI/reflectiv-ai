/**
 * Test localhost CORS origins
 * Verifies that local development origins are allowed
 */

import worker from "./worker.js";

// Mock environment with localhost origins
const mockEnvWithLocalhost = {
  CORS_ORIGINS: "https://reflectivei.github.io,http://localhost:3000,http://127.0.0.1:3000,http://localhost:5500,http://127.0.0.1:5500,http://localhost:8080,http://127.0.0.1:8080",
  PROVIDER_URL: "https://api.groq.com/openai/v1/chat/completions",
  PROVIDER_MODEL: "llama-3.1-8b-instant",
  PROVIDER_KEY: "test-key",
  MAX_OUTPUT_TOKENS: "1400"
};

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

async function testLocalhostOrigins() {
  console.log("\n=== Testing Localhost CORS Origins ===\n");

  const localhostOrigins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5500",
    "http://127.0.0.1:5500",
    "http://localhost:8080",
    "http://127.0.0.1:8080"
  ];

  for (const origin of localhostOrigins) {
    console.log(`\nTesting origin: ${origin}`);
    
    // Test OPTIONS preflight
    const req1 = new Request("http://test.com/chat", {
      method: "OPTIONS",
      headers: {
        "Origin": origin,
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type"
      }
    });
    const res1 = await worker.fetch(req1, mockEnvWithLocalhost, {});

    assert(
      res1.status === 204,
      `  OPTIONS preflight returns 204 for ${origin}`
    );
    assert(
      res1.headers.get("Access-Control-Allow-Origin") === origin,
      `  OPTIONS returns exact origin: ${origin}`
    );
    assert(
      res1.headers.get("Access-Control-Allow-Credentials") === "true",
      `  OPTIONS sets credentials for ${origin}`
    );
    assert(
      res1.headers.get("Access-Control-Allow-Methods")?.includes("POST"),
      `  OPTIONS includes POST method for ${origin}`
    );

    // Test actual endpoint (health check - doesn't require API key)
    const req2 = new Request("http://test.com/health", {
      method: "GET",
      headers: { "Origin": origin }
    });
    const res2 = await worker.fetch(req2, mockEnvWithLocalhost, {});

    assert(
      res2.status === 200,
      `  GET /health returns 200 for ${origin}`
    );
    assert(
      res2.headers.get("Access-Control-Allow-Origin") === origin,
      `  GET /health returns exact origin: ${origin}`
    );
    assert(
      res2.headers.get("Access-Control-Allow-Credentials") === "true",
      `  GET /health sets credentials for ${origin}`
    );
  }
}

async function testMixedOrigins() {
  console.log("\n=== Testing Mixed Production + Localhost Origins ===\n");

  const mixedOrigins = [
    "https://reflectivei.github.io",
    "http://localhost:3000",
    "http://127.0.0.1:5500"
  ];

  for (const origin of mixedOrigins) {
    const req = new Request("http://test.com/version", {
      method: "GET",
      headers: { "Origin": origin }
    });
    const res = await worker.fetch(req, mockEnvWithLocalhost, {});

    assert(
      res.status === 200,
      `GET /version returns 200 for ${origin}`
    );
    assert(
      res.headers.get("Access-Control-Allow-Origin") === origin,
      `GET /version echoes origin: ${origin}`
    );
  }
}

async function testDisallowedLocalhost() {
  console.log("\n=== Testing Disallowed Localhost Ports ===\n");

  const disallowedOrigins = [
    "http://localhost:4200",  // Not in allowlist
    "http://localhost:8000",  // Not in allowlist
    "http://127.0.0.1:9000"   // Not in allowlist
  ];

  for (const origin of disallowedOrigins) {
    const req = new Request("http://test.com/chat", {
      method: "OPTIONS",
      headers: {
        "Origin": origin,
        "Access-Control-Request-Method": "POST"
      }
    });
    const res = await worker.fetch(req, mockEnvWithLocalhost, {});

    assert(
      res.headers.get("Access-Control-Allow-Origin") === "null",
      `Disallowed origin ${origin} gets "null"`
    );
    assert(
      !res.headers.has("Access-Control-Allow-Credentials") ||
      res.headers.get("Access-Control-Allow-Credentials") !== "true",
      `Disallowed origin ${origin} has no credentials header`
    );
  }
}

async function runTests() {
  console.log("Testing Localhost CORS Origins...\n");

  try {
    await testLocalhostOrigins();
    await testMixedOrigins();
    await testDisallowedLocalhost();

    console.log("\n=== Test Summary ===");
    console.log(`Passed: ${testsPassed}`);
    console.log(`Failed: ${testsFailed}`);

    if (testsFailed > 0) {
      console.error("\n❌ Some tests failed!");
      process.exit(1);
    } else {
      console.log("\n✅ All localhost CORS tests passed!");
    }
  } catch (error) {
    console.error("\n❌ Test execution failed:", error);
    process.exit(1);
  }
}

runTests();
