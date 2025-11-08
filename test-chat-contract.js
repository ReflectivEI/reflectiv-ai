/**
 * Test to validate /chat endpoint contract
 */
import worker from "./worker.js";

// Mock environment - without PROVIDER_KEY to avoid actual API calls
const mockEnv = {
  CORS_ORIGINS: "https://reflectivai.github.io",
  PROVIDER_URL: "https://api.example.com/mock",
  PROVIDER_MODEL: "test-model",
  PROVIDER_KEY: "mock-key",
  MAX_OUTPUT_TOKENS: "1400"
};

async function testChatContract() {
  console.log("\n=== Testing /chat Contract ===\n");

  // Test 1: Widget's actual payload (from problem statement)
  const widgetPayload = {
    mode: "sales-simulation",
    user: "How do I talk to HCPs about PrEP?",
    history: [],
    disease: "HIV",
    persona: "difficult",
    goal: "Overcome objections",
    session: "web-abc123"
  };

  console.log("Widget sends:", JSON.stringify(widgetPayload, null, 2));

  const req = new Request("http://test.com/chat", {
    method: "POST",
    headers: { 
      "content-type": "application/json",
      "Origin": "https://reflectivai.github.io"
    },
    body: JSON.stringify(widgetPayload)
  });

  try {
    const res = await worker.fetch(req, mockEnv, {});
    console.log("\nResponse status:", res.status);
    
    const data = await res.json();
    console.log("\nResponse structure:");
    console.log("  - Has 'reply':", 'reply' in data);
    console.log("  - Has 'coach':", 'coach' in data);
    console.log("  - Has 'error':", 'error' in data);

    if (res.status === 200) {
      console.log("\n✓ /chat accepts widget payload");
    } else {
      console.log("\n✗ /chat returned error:", res.status);
      console.log("Error details:", data);
    }
  } catch (e) {
    console.error("\n✗ Error:", e.message);
    console.error(e.stack);
  }
}

testChatContract().catch(console.error);
