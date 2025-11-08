/**
 * Contract tests for /chat endpoint
 * Validates the widget-worker integration contract
 */
import worker from "./worker.js";

// Mock environment - without real API to avoid actual calls
const mockEnv = {
  CORS_ORIGINS: "https://reflectivai.github.io",
  PROVIDER_URL: "https://api.example.com/mock",
  PROVIDER_MODEL: "test-model",
  PROVIDER_KEY: "mock-key",
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

async function testChatContract() {
  console.log("\n=== Testing /chat Contract ===\n");

  // Test 1: Widget's actual payload structure
  const widgetPayload = {
    mode: "sales-simulation",
    user: "How do I talk to HCPs about PrEP?",
    history: [],
    disease: "HIV",
    persona: "difficult",
    goal: "Overcome objections",
    session: "web-abc123"
  };

  console.log("Test 1: Widget payload acceptance");
  const req1 = new Request("http://test.com/chat", {
    method: "POST",
    headers: { 
      "content-type": "application/json",
      "Origin": "https://reflectivai.github.io"
    },
    body: JSON.stringify(widgetPayload)
  });

  const res1 = await worker.fetch(req1, mockEnv, {});
  const data1 = await res1.json();
  
  // Since we can't reach the real provider, we expect 502
  assert(res1.status === 502, "Returns 502 when provider unavailable");
  assert(data1.error === "upstream_error", "Error type is 'upstream_error'");
  assert(typeof data1.message === "string", "Error includes message");

  // Test 2: Content-Type validation
  console.log("\nTest 2: Content-Type validation");
  const req2 = new Request("http://test.com/chat", {
    method: "POST",
    headers: { 
      "Origin": "https://reflectivai.github.io"
    },
    body: JSON.stringify(widgetPayload)
  });

  const res2 = await worker.fetch(req2, mockEnv, {});
  const data2 = await res2.json();
  
  assert(res2.status === 415, "Returns 415 for missing Content-Type");
  assert(data2.error === "unsupported_media_type", "Error type is correct");

  // Test 3: CORS headers
  console.log("\nTest 3: CORS headers");
  const req3 = new Request("http://test.com/chat", {
    method: "POST",
    headers: { 
      "content-type": "application/json",
      "Origin": "https://reflectivai.github.io"
    },
    body: JSON.stringify(widgetPayload)
  });

  const res3 = await worker.fetch(req3, mockEnv, {});
  
  assert(
    res3.headers.get("Access-Control-Allow-Origin") === "https://reflectivai.github.io",
    "CORS origin header is set correctly"
  );
  assert(
    res3.headers.get("Access-Control-Allow-Methods")?.includes("POST"),
    "CORS methods include POST"
  );

  // Test 4: Payload with history
  console.log("\nTest 4: Payload with conversation history");
  const payloadWithHistory = {
    ...widgetPayload,
    history: [
      { role: "user", content: "What is PrEP?" },
      { role: "assistant", content: "PrEP is pre-exposure prophylaxis..." }
    ]
  };

  const req4 = new Request("http://test.com/chat", {
    method: "POST",
    headers: { 
      "content-type": "application/json",
      "Origin": "https://reflectivai.github.io"
    },
    body: JSON.stringify(payloadWithHistory)
  });

  const res4 = await worker.fetch(req4, mockEnv, {});
  
  // Should accept history without errors (even if provider fails)
  assert(res4.status === 502, "Accepts payload with history");

  // Test 5: All four modes
  console.log("\nTest 5: All supported modes");
  const modes = ["sales-simulation", "role-play", "product-knowledge", "emotional-assessment"];
  
  for (const mode of modes) {
    const req = new Request("http://test.com/chat", {
      method: "POST",
      headers: { 
        "content-type": "application/json",
        "Origin": "https://reflectivai.github.io"
      },
      body: JSON.stringify({ ...widgetPayload, mode })
    });

    const res = await worker.fetch(req, mockEnv, {});
    assert(
      res.status === 502,
      `Accepts mode: ${mode}`
    );
  }

  // Test 6: Optional fields
  console.log("\nTest 6: Optional fields handling");
  const minimalPayload = {
    user: "Test message"
  };

  const req6 = new Request("http://test.com/chat", {
    method: "POST",
    headers: { 
      "content-type": "application/json",
      "Origin": "https://reflectivai.github.io"
    },
    body: JSON.stringify(minimalPayload)
  });

  const res6 = await worker.fetch(req6, mockEnv, {});
  
  // Should work with minimal payload (mode defaults, etc.)
  assert(res6.status === 502, "Accepts minimal payload with defaults");

  console.log("\n=== Contract Test Summary ===");
  console.log(`Passed: ${testsPassed}`);
  console.log(`Failed: ${testsFailed}`);
  
  return testsFailed === 0;
}

// Run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  testChatContract()
    .then(success => process.exit(success ? 0 : 1))
    .catch(err => {
      console.error("Test error:", err);
      process.exit(1);
    });
}

export { testChatContract };
