/**
 * Test wildcard pattern matching for CORS
 */
import worker from "./worker.js";

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

// Mock environment with wildcard CORS pattern
const mockEnvWithWildcard = {
  CORS_ORIGINS: "https://reflectivei.github.io,https://*.vercel.app",
  PROVIDER_URL: "https://api.groq.com/openai/v1/chat/completions",
  PROVIDER_MODEL: "llama-3.1-70b-versatile",
  PROVIDER_KEY: "test-key",
  MAX_OUTPUT_TOKENS: "1400"
};

async function testWildcardPatterns() {
  console.log("\n=== Testing Wildcard Pattern Matching ===");

  // Test 1: Exact match still works
  const req1 = new Request("http://test.com/health", {
    method: "GET",
    headers: { "Origin": "https://reflectivei.github.io" }
  });
  const res1 = await worker.fetch(req1, mockEnvWithWildcard, {});
  
  assert(
    res1.headers.get("Access-Control-Allow-Origin") === "https://reflectivei.github.io",
    "Exact match works with wildcard patterns in list"
  );

  // Test 2: Vercel preview URL matches wildcard
  const req2 = new Request("http://test.com/health", {
    method: "GET",
    headers: { "Origin": "https://reflectiv-ai-git-copilot-audit-repo-3e2e00-tony-abdels-projects.vercel.app" }
  });
  const res2 = await worker.fetch(req2, mockEnvWithWildcard, {});
  
  assert(
    res2.headers.get("Access-Control-Allow-Origin") === "https://reflectiv-ai-git-copilot-audit-repo-3e2e00-tony-abdels-projects.vercel.app",
    "Vercel preview URL matches *.vercel.app pattern"
  );

  // Test 3: Different Vercel URL also matches
  const req3 = new Request("http://test.com/health", {
    method: "GET",
    headers: { "Origin": "https://my-app.vercel.app" }
  });
  const res3 = await worker.fetch(req3, mockEnvWithWildcard, {});
  
  assert(
    res3.headers.get("Access-Control-Allow-Origin") === "https://my-app.vercel.app",
    "Different Vercel URL matches *.vercel.app pattern"
  );

  // Test 4: Non-matching domain is rejected
  const req4 = new Request("http://test.com/health", {
    method: "GET",
    headers: { "Origin": "https://evil.com" }
  });
  const res4 = await worker.fetch(req4, mockEnvWithWildcard, {});
  
  assert(
    res4.headers.get("Access-Control-Allow-Origin") === "null",
    "Non-matching domain returns null"
  );

  // Test 5: Subdomain that doesn't match is rejected
  const req5 = new Request("http://test.com/health", {
    method: "GET",
    headers: { "Origin": "https://vercel.app.evil.com" }
  });
  const res5 = await worker.fetch(req5, mockEnvWithWildcard, {});
  
  assert(
    res5.headers.get("Access-Control-Allow-Origin") === "null",
    "Domain that only contains pattern as substring is rejected"
  );

  // Test 6: OPTIONS preflight with wildcard pattern
  const req6 = new Request("http://test.com/chat", {
    method: "OPTIONS",
    headers: { 
      "Origin": "https://test-preview.vercel.app",
      "Access-Control-Request-Method": "POST"
    }
  });
  const res6 = await worker.fetch(req6, mockEnvWithWildcard, {});
  
  assert(res6.status === 204, "Preflight succeeds for wildcard match");
  assert(
    res6.headers.get("Access-Control-Allow-Origin") === "https://test-preview.vercel.app",
    "Preflight returns exact origin for wildcard match"
  );
  assert(
    res6.headers.get("Access-Control-Allow-Credentials") === "true",
    "Preflight sets credentials for wildcard match"
  );
}

async function runTests() {
  console.log("Testing CORS wildcard pattern matching...\n");

  try {
    await testWildcardPatterns();

    console.log("\n=== Test Summary ===");
    console.log(`Passed: ${testsPassed}`);
    console.log(`Failed: ${testsFailed}`);
    
    if (testsFailed > 0) {
      process.exit(1);
    } else {
      console.log("\n✅ All wildcard CORS tests passed!");
    }
  } catch (error) {
    console.error("\n❌ Test execution failed:", error);
    console.error(error.stack);
    process.exit(1);
  }
}

runTests();
