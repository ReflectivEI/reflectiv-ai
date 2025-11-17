/**
 * Test for general-knowledge mode date context fix
 * Validates that the general-knowledge mode includes current date information
 * Run with: node test-general-knowledge-date.js
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

// Mock fetch for provider API
let mockProviderResponse = null;
let capturedSystemPrompt = null;

globalThis.fetch = async (url, options) => {
  // Capture the system prompt from the request
  if (url.includes("chat/completions")) {
    const body = JSON.parse(options.body);
    capturedSystemPrompt = body.messages.find(m => m.role === "system")?.content || "";
    
    const responseText = JSON.stringify(mockProviderResponse || {
      choices: [{
        message: {
          content: "Mock response"
        }
      }]
    });
    
    // Return mock response with both json() and text()
    return {
      ok: true,
      status: 200,
      json: async () => JSON.parse(responseText),
      text: async () => responseText
    };
  }
  
  // For other URLs (like /models health check)
  return {
    ok: true,
    status: 200,
    json: async () => ({ data: [] }),
    text: async () => JSON.stringify({ data: [] })
  };
};

async function testGeneralKnowledgeDateContext() {
  console.log("\n=== Testing general-knowledge mode date context ===");
  
  const mockEnv = {
    CORS_ORIGINS: "https://reflectivai.github.io",
    PROVIDER_URL: "https://api.groq.com/openai/v1/chat/completions",
    PROVIDER_MODEL: "llama-3.1-8b-instant",
    PROVIDER_KEY: "test-key-12345"
  };
  
  // Set mock response
  mockProviderResponse = {
    choices: [{
      message: {
        content: "The current President of the United States is Donald Trump, who began his second term on January 20, 2025."
      }
    }]
  };
  
  // Test general-knowledge mode includes date
  const req = new Request("http://test.com/chat", {
    method: "POST",
    headers: {
      "Origin": "https://reflectivai.github.io",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      mode: "general-knowledge",
      user: "Who is the president of the US?",
      history: [],
      session: "test-session-gk-date"
    })
  });
  
  capturedSystemPrompt = null;
  const res = await worker.fetch(req, mockEnv, {});
  const data = await res.json();
  
  assert(res.status === 200, "general-knowledge mode request succeeds");
  assert(capturedSystemPrompt !== null, "System prompt was captured");
  
  // Verify the system prompt includes current date information
  const hasCurrentDate = capturedSystemPrompt.includes("CURRENT DATE:") || 
                         capturedSystemPrompt.includes("2025");
  assert(hasCurrentDate, "System prompt includes current date context (2025)");
  
  const hasDateInstruction = capturedSystemPrompt.includes("November 2025") ||
                             capturedSystemPrompt.includes("current date");
  assert(hasDateInstruction, "System prompt includes instruction about current knowledge");
  
  // Verify it does NOT say 2023
  const has2023 = capturedSystemPrompt.includes("2023");
  assert(!has2023, "System prompt does NOT reference 2023");
  
  console.log("\nCaptured system prompt excerpt:");
  const lines = capturedSystemPrompt.split("\n");
  console.log(lines.slice(0, 10).join("\n"));
}

async function testOtherModesUnaffected() {
  console.log("\n=== Testing other modes are not affected ===");
  
  const mockEnv = {
    CORS_ORIGINS: "https://reflectivai.github.io",
    PROVIDER_URL: "https://api.groq.com/openai/v1/chat/completions",
    PROVIDER_MODEL: "llama-3.1-8b-instant",
    PROVIDER_KEY: "test-key-12345"
  };
  
  mockProviderResponse = {
    choices: [{
      message: {
        content: "Mock sales coach response"
      }
    }]
  };
  
  const req = new Request("http://test.com/chat", {
    method: "POST",
    headers: {
      "Origin": "https://reflectivai.github.io",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      mode: "sales-coach",
      user: "How do I handle objections?",
      history: [],
      session: "test-session-sc"
    })
  });
  
  capturedSystemPrompt = null;
  const res = await worker.fetch(req, mockEnv, {});
  const data = await res.json();
  
  assert(res.status === 200, "sales-coach mode request succeeds");
  assert(capturedSystemPrompt !== null, "Sales coach prompt was captured");
  
  // Sales coach should not have the CURRENT DATE context that we added to general-knowledge
  const hasCurrentDateHeader = capturedSystemPrompt.includes("CURRENT DATE: 2025");
  assert(!hasCurrentDateHeader, "sales-coach mode does NOT have the CURRENT DATE header (only general-knowledge has it)");
}

// Run all tests
async function runTests() {
  console.log("Testing general-knowledge date context fix...\n");
  
  try {
    await testGeneralKnowledgeDateContext();
    await testOtherModesUnaffected();
    
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
