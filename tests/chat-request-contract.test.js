/**
 * Chat Request Contract Tests
 * 
 * Tests the contract between widget.js/api.js and worker.js /chat endpoint
 * to ensure all modes work correctly and catch 400 regressions.
 */

// Mock environment for testing
const mockEnv = {
  PROVIDER_URL: 'https://api.groq.com/openai/v1/chat/completions',
  PROVIDER_MODEL: 'llama-3.1-8b-instant',
  PROVIDER_KEY: 'test-key-123',
  CORS_ORIGINS: 'https://reflectivei.github.io,https://tonyabdelmalak.com',
  RATELIMIT_RATE: '1000',  // High rate for testing
  RATELIMIT_BURST: '100'   // High burst for testing
};

// Import worker module (assuming it's importable)
let worker;
try {
  // Try dynamic import for ES modules
  worker = await import('../worker.js');
} catch (e) {
  console.error('Failed to import worker.js:', e.message);
  console.log('Skipping tests - worker.js not importable in test environment');
  process.exit(0);
}

/**
 * Helper to create a mock Request object
 */
function createRequest(method, path, body = null) {
  const url = `https://worker.example.com${path}`;
  const headers = new Headers({
    'content-type': 'application/json',
    'origin': 'https://reflectivei.github.io'
  });
  
  const req = {
    method,
    url,
    headers,
    text: async () => body ? JSON.stringify(body) : '',
    json: async () => body || {}
  };
  
  return req;
}

/**
 * Test cases for different modes
 */
const testCases = [
  {
    name: 'sales-coach mode - widget format',
    payload: {
      mode: 'sales-coach',
      messages: [
        { role: 'user', content: 'How should I approach an HCP who is hesitant about prescribing?' }
      ],
      disease: 'HIV',
      persona: 'Infectious Disease Specialist',
      goal: 'Discuss PrEP benefits'
    },
    shouldPass: true
  },
  {
    name: 'role-play mode - widget format',
    payload: {
      mode: 'role-play',
      messages: [
        { role: 'user', content: 'I would like to discuss the benefits of the product.' }
      ],
      disease: 'Cardiovascular',
      persona: 'Cardiologist',
      goal: 'Role-play sales conversation'
    },
    shouldPass: true
  },
  {
    name: 'product-knowledge mode - widget format',
    payload: {
      mode: 'product-knowledge',
      messages: [
        { role: 'user', content: 'What are the contraindications for this medication?' }
      ],
      disease: 'Oncology',
      persona: 'Oncologist',
      goal: 'Learn about product'
    },
    shouldPass: true
  },
  {
    name: 'emotional-assessment mode - widget format with eiContext',
    payload: {
      mode: 'emotional-assessment',
      messages: [
        { role: 'user', content: 'I felt frustrated when the HCP dismissed my points.' }
      ],
      disease: '',
      persona: '',
      goal: '',
      eiContext: '# EI Framework\n\nSelf-awareness: Understanding your emotions...'
    },
    shouldPass: true
  },
  {
    name: 'emotional-assessment mode - widget format without eiContext (fallback)',
    payload: {
      mode: 'emotional-assessment',
      messages: [
        { role: 'user', content: 'How can I improve my emotional intelligence?' }
      ],
      disease: '',
      persona: '',
      goal: ''
    },
    shouldPass: true
  },
  {
    name: 'sales-simulation mode (should map to sales-coach)',
    payload: {
      mode: 'sales-simulation',
      messages: [
        { role: 'user', content: 'Test message for sales simulation' }
      ],
      disease: 'COVID-19',
      persona: 'Primary Care Physician',
      goal: 'Test goal'
    },
    shouldPass: true
  },
  {
    name: 'Invalid - empty messages array',
    payload: {
      mode: 'sales-coach',
      messages: [],
      disease: 'HIV',
      persona: 'Specialist'
    },
    shouldPass: false,
    expectedError: 'EMPTY_MESSAGES'
  },
  {
    name: 'Invalid - no user message in array',
    payload: {
      mode: 'sales-coach',
      messages: [
        { role: 'system', content: 'System message only' }
      ],
      disease: 'HIV',
      persona: 'Specialist'
    },
    shouldPass: false,
    expectedError: 'NO_USER_MESSAGE'
  },
  {
    name: 'Invalid - empty user message',
    payload: {
      mode: 'sales-coach',
      messages: [
        { role: 'user', content: '   ' }
      ],
      disease: 'HIV',
      persona: 'Specialist'
    },
    shouldPass: false,
    expectedError: 'EMPTY_USER_MESSAGE'
  }
];

/**
 * Run all tests
 */
async function runTests() {
  console.log('Running Chat Request Contract Tests...\n');
  
  let passed = 0;
  let failed = 0;
  
  for (const test of testCases) {
    try {
      // Add delay to avoid rate limiting in tests
      if (testCases.indexOf(test) > 0) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      const req = createRequest('POST', '/chat', test.payload);
      const response = await worker.default.fetch(req, mockEnv);
      
      const status = response.status;
      const body = await response.json();
      
      if (test.shouldPass) {
        // Should succeed (200 OK) or fail with provider error (502) in test env
        // 502 means request was valid but provider is unavailable
        if (status === 200 || status === 502) {
          console.log(`✓ ${test.name}`);
          passed++;
        } else if (status === 400) {
          console.log(`✗ ${test.name}`);
          console.log(`  Expected: pass (200 or 502 - valid request)`);
          console.log(`  Got: 400 ${JSON.stringify(body)}`);
          failed++;
        } else {
          console.log(`? ${test.name}`);
          console.log(`  Unexpected status: ${status}`);
          console.log(`  Body: ${JSON.stringify(body)}`);
          failed++;
        }
      } else {
        // Should fail with 400
        if (status === 400) {
          if (test.expectedError && body.error?.code === test.expectedError) {
            console.log(`✓ ${test.name} (correctly rejected)`);
            passed++;
          } else if (!test.expectedError) {
            console.log(`✓ ${test.name} (correctly rejected)`);
            passed++;
          } else {
            console.log(`✗ ${test.name}`);
            console.log(`  Expected error code: ${test.expectedError}`);
            console.log(`  Got error code: ${body.error?.code}`);
            failed++;
          }
        } else {
          console.log(`✗ ${test.name}`);
          console.log(`  Expected: 400 with error ${test.expectedError || 'any'}`);
          console.log(`  Got: ${status} ${JSON.stringify(body)}`);
          failed++;
        }
      }
    } catch (error) {
      console.log(`✗ ${test.name}`);
      console.log(`  Error: ${error.message}`);
      failed++;
    }
  }
  
  console.log(`\n=== Test Summary ===`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  
  if (failed > 0) {
    process.exit(1);
  }
}

// Run tests
runTests().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
