/**
 * Unit tests for empty provider response handling
 * Tests the fix for preventing empty replies from surfacing as blank JS errors
 * Run with: node worker.empty-response.test.js
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

// Create a mock fetch that returns empty responses
function createMockFetch(responseBody) {
  return async (url, options) => {
    return {
      ok: true,
      status: 200,
      json: async () => responseBody,
      text: async () => JSON.stringify(responseBody)
    };
  };
}

// Test empty response handling
async function testEmptyProviderResponse() {
  console.log("\n=== Testing empty provider response handling ===");

  // Mock environment with valid keys
  const mockEnv = {
    CORS_ORIGINS: "https://reflectivai.github.io",
    PROVIDER_URL: "https://api.groq.com/openai/v1/chat/completions",
    PROVIDER_MODEL: "llama-3.1-70b-versatile",
    PROVIDER_KEY: "test-key-123"
  };

  // Override global fetch to simulate empty provider response
  const originalFetch = global.fetch;
  
  // Test 1: Empty content string
  global.fetch = createMockFetch({
    choices: [
      {
        message: {
          content: ""
        }
      }
    ]
  });

  const req1 = new Request("http://test.com/chat", {
    method: "POST",
    headers: { 
      "Origin": "https://reflectivai.github.io",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ 
      mode: "sales-coach",
      user: "How do I approach this HCP?",
      disease: "HIV",
      session: "test-session-1"
    })
  });

  const res1 = await worker.fetch(req1, mockEnv, {});
  const data1 = await res1.json();
  
  assert(res1.status === 502, "Returns 502 for empty provider response");
  assert(data1.error === "provider_empty_completion", "Returns provider_empty_completion error");
  assert(data1.message.includes("language model or provider did not return a response"), 
    "Error message mentions provider not returning response");
  assert(res1.headers.get("Access-Control-Allow-Origin") === "https://reflectivai.github.io",
    "Empty response error includes CORS header");

  // Test 2: Whitespace-only response
  global.fetch = createMockFetch({
    choices: [
      {
        message: {
          content: "   \n\t  "
        }
      }
    ]
  });

  const req2 = new Request("http://test.com/chat", {
    method: "POST",
    headers: { 
      "Origin": "https://reflectivai.github.io",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ 
      mode: "role-play",
      user: "I need help with this objection",
      disease: "Oncology",
      session: "test-session-2"
    })
  });

  const res2 = await worker.fetch(req2, mockEnv, {});
  const data2 = await res2.json();
  
  assert(res2.status === 502, "Returns 502 for whitespace-only response");
  assert(data2.error === "provider_empty_completion", "Returns provider_empty_completion error for whitespace");

  // Test 3: Null content
  global.fetch = createMockFetch({
    choices: [
      {
        message: {
          content: null
        }
      }
    ]
  });

  const req3 = new Request("http://test.com/chat", {
    method: "POST",
    headers: { 
      "Origin": "https://reflectivai.github.io",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ 
      mode: "emotional-assessment",
      user: "How did I do?",
      session: "test-session-3"
    })
  });

  const res3 = await worker.fetch(req3, mockEnv, {});
  const data3 = await res3.json();
  
  assert(res3.status === 502, "Returns 502 for null content");
  assert(data3.error === "provider_empty_completion", "Returns provider_empty_completion error for null");

  // Test 4: Valid response should still work
  global.fetch = createMockFetch({
    choices: [
      {
        message: {
          content: "Challenge: The HCP may not be aware of PrEP eligibility criteria.\n\nRep Approach:\n• Discuss risk assessment [HIV-PREP-001]\n• Highlight safety profile [HIV-PREP-002]\n• Emphasize monitoring [HIV-PREP-003]\n\nImpact: Improved prescribing practices.\n\nSuggested Phrasing: \"Would you like to review eligibility criteria?\"\n\n<coach>{\"scores\":{\"empathy\":4,\"clarity\":5}}</coach>"
        }
      }
    ]
  });

  const req4 = new Request("http://test.com/chat", {
    method: "POST",
    headers: { 
      "Origin": "https://reflectivai.github.io",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ 
      mode: "sales-coach",
      user: "How do I discuss PrEP?",
      disease: "HIV",
      session: "test-session-4"
    })
  });

  const res4 = await worker.fetch(req4, mockEnv, {});
  const data4 = await res4.json();
  
  assert(res4.status === 200, "Returns 200 for valid provider response");
  assert(data4.reply && data4.reply.length > 0, "Returns non-empty reply for valid response");
  assert(!data4.error, "No error for valid response");

  // Restore original fetch
  global.fetch = originalFetch;
}

// Test empty response after all retries
async function testEmptyAfterRetries() {
  console.log("\n=== Testing empty response after all retry attempts ===");

  const mockEnv = {
    CORS_ORIGINS: "https://reflectivai.github.io",
    PROVIDER_URL: "https://api.groq.com/openai/v1/chat/completions",
    PROVIDER_MODEL: "llama-3.1-70b-versatile",
    PROVIDER_KEY: "test-key-123",
    RATELIMIT_RATE: "1000", // High rate limit to avoid throttling during tests
    RATELIMIT_BURST: "100"
  };

  const originalFetch = global.fetch;
  let callCount = 0;
  
  // Mock fetch that returns empty on all attempts
  global.fetch = async (url, options) => {
    callCount++;
    return {
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: "" } }]
      })
    };
  };

  const req = new Request("http://test.com/chat", {
    method: "POST",
    headers: { 
      "Origin": "https://reflectivai.github.io",
      "Content-Type": "application/json",
      "CF-Connecting-IP": "192.168.100.50" // Different IP to avoid rate limit
    },
    body: JSON.stringify({ 
      mode: "product-knowledge",
      user: "What is PrEP?",
      session: "test-session-retry"
    })
  });

  const res = await worker.fetch(req, mockEnv, {});
  const data = await res.json();
  
  console.log("Response status:", res.status);
  console.log("Response data:", JSON.stringify(data, null, 2));
  console.log("Call count:", callCount);
  
  assert(res.status === 502, "Returns 502 after all retries fail to get content");
  assert(data.error === "provider_empty_completion", "Returns provider_empty_completion after retries");
  assert(callCount >= 1, "Provider was called at least once");

  global.fetch = originalFetch;
}

// Run all tests
async function runTests() {
  console.log("Running empty provider response tests...\n");

  try {
    await testEmptyProviderResponse();
    await testEmptyAfterRetries();

    console.log("\n=== Test Summary ===");
    console.log(`Passed: ${testsPassed}`);
    console.log(`Failed: ${testsFailed}`);
    
    if (testsFailed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error("Test execution failed:", error);
    console.error(error.stack);
    process.exit(1);
  }
}

runTests();
