// test_hardcoded_ai.js - Test the hardcoded AI logic
import { chat } from './assets/chat/core/api.js';

const testCases = [
  { mode: 'sales-coach', messages: [{ role: 'user', content: 'How to approach a doctor about PrEP?' }], expectedFormat: 'Challenge/Rep Approach/Impact/Suggested Phrasing' },
  { mode: 'sales-coach', messages: [{ role: 'user', content: 'What about HIV risk?' }], expectedFormat: 'Challenge/Rep Approach/Impact/Suggested Phrasing' },
  { mode: 'sales-coach', messages: [{ role: 'user', content: 'Is PrEP covered by insurance?' }], expectedFormat: 'Challenge/Rep Approach/Impact/Suggested Phrasing' },
  { mode: 'sales-coach', messages: [{ role: 'user', content: 'What are the side effects?' }], expectedFormat: 'Challenge/Rep Approach/Impact/Suggested Phrasing' },
  { mode: 'role-play', messages: [{ role: 'user', content: 'Do you prescribe PrEP?' }], expectedFormat: 'HCP response' },
  { mode: 'role-play', messages: [{ role: 'user', content: 'What do you think about PrEP?' }], expectedFormat: 'HCP response' },
  { mode: 'emotional-assessment', messages: [{ role: 'user', content: 'I feel anxious about PrEP discussions.' }], expectedFormat: 'Ends with question' },
  { mode: 'emotional-assessment', messages: [{ role: 'user', content: 'I am worried about patient reactions.' }], expectedFormat: 'Ends with question' },
  { mode: 'product-knowledge', messages: [{ role: 'user', content: 'What is Descovy?' }], expectedFormat: 'Cites facts' },
  { mode: 'product-knowledge', messages: [{ role: 'user', content: 'How to monitor safety?' }], expectedFormat: 'Cites facts' },
  { mode: 'general-knowledge', messages: [{ role: 'user', content: 'How does HIV spread?' }], expectedFormat: 'Informative response' },
  { mode: 'general-knowledge', messages: [{ role: 'user', content: 'What is PrEP?' }], expectedFormat: 'Informative response' },
  { mode: 'unknown', messages: [{ role: 'user', content: 'Hello' }], expectedFormat: 'Fallback' },
];

async function runTests() {
  console.log('Testing Hardcoded AI Logic Across 5 Modes\n');

  for (const test of testCases) {
    try {
      console.log(`Testing ${test.mode}: "${test.messages[0].content}"`);
      const result = await chat(test);
      console.log(`Reply: ${result.reply.substring(0, 100)}...`);
      if (result.coach) {
        console.log(`Coach Score: ${result.coach.overall}`);
      }
      console.log(`Format Check: ${test.expectedFormat} - ${validateFormat(test.mode, result.reply) ? 'PASS' : 'FAIL'}`);
      console.log('---\n');
    } catch (e) {
      console.log(`ERROR: ${e.message}\n---\n`);
    }
  }
}

function validateFormat(mode, reply) {
  if (mode === 'sales-coach') {
    return reply.includes('Challenge:') && reply.includes('Rep Approach:') && reply.includes('Impact:') && reply.includes('Suggested Phrasing:');
  }
  if (mode === 'emotional-assessment') {
    return reply.includes('?');
  }
  if (mode === 'product-knowledge') {
    return reply.includes('[') && reply.includes(']');
  }
  return reply.length > 10; // Basic check
}

runTests();