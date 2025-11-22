// integration.test.cjs - End-to-end integration tests for formatting pipeline
const assert = require('assert');
const { parseSalesCoachBullets, extractLabeledSection, convertCitations, esc } = require('../assets/chat/core/parsers/index.cjs');

// Mock currentMode
let currentMode = 'sales-coach';

// Simplified formatSalesCoachReply for testing
function formatSalesCoachReply(text) {
  if (!text) return "No response";

  const challengeSection = extractLabeledSection(text, "Challenge:", ["Rep Approach:", "Impact:", "Suggested Phrasing:"]);
  const repApproachSection = extractLabeledSection(text, "Rep Approach:", ["Impact:", "Suggested Phrasing:"]);
  const impactSection = extractLabeledSection(text, "Impact:", ["Suggested Phrasing:"]);
  const phrasingSection = extractLabeledSection(text, "Suggested Phrasing:", []);

  let contractValid = true;
  let issues = [];
  if (!challengeSection) { contractValid = false; issues.push({message: "Missing Challenge section.", sectionKey: "challenge"}); }
  if (!repApproachSection) { contractValid = false; issues.push({message: "Missing Rep Approach section.", sectionKey: "repApproach"}); }
  if (!impactSection) { contractValid = false; issues.push({message: "Missing Impact section.", sectionKey: "impact"}); }
  if (!phrasingSection) { contractValid = false; issues.push({message: "Missing Suggested Phrasing section.", sectionKey: "suggestedPhrasing"}); }

  const repText = repApproachSection || "";
  const bulletItems = parseSalesCoachBullets(repText);
  if (repApproachSection && bulletItems.length !== 3) {
    contractValid = false;
    issues.push({message: `Rep Approach should have 3 bullets (found ${bulletItems.length}).`, sectionKey: "repApproach"});
  }

  if (!contractValid) {
    return `Contract Warning: ${issues.map(i => i.message).join(' ')}`;
  }

  // Render sections
  let html = "";
  html += `<div>Challenge: ${convertCitations(esc(challengeSection))}</div>`;
  html += `<ul>${bulletItems.map(b => `<li>${convertCitations(esc(b))}</li>`).join('')}</ul>`;
  html += `<div>Impact: ${convertCitations(esc(impactSection))}</div>`;
  html += `<div>Phrasing: "${convertCitations(esc(phrasingSection))}"</div>`;
  return html;
}

console.log('Running Integration-Style Tests...');

// Valid Sales Coach response
const validResponse = `Challenge: Patient needs education
Rep Approach: • Point 1 • Point 2 • Point 3
Impact: Better outcomes
Suggested Phrasing: "Question?"`;

const result = formatSalesCoachReply(validResponse);
assert(result.includes('Challenge:'), 'Valid response formatted');
assert(result.includes('<ul>'), 'Bullets rendered');
assert(!result.includes('Contract Warning'), 'No warnings for valid');

// Invalid response - missing section
const invalidResponse = `Rep Approach: • Point 1 • Point 2 • Point 3
Impact: Better outcomes
Suggested Phrasing: "Question?"`;

const invalidResult = formatSalesCoachReply(invalidResponse);
assert(invalidResult.includes('Contract Warning'), 'Warning for invalid');
assert(invalidResult.includes('Missing Challenge'), 'Correct issue detected');

// Invalid response - wrong bullet count
const wrongBullets = `Challenge: Test
Rep Approach: • Only one
Impact: Test
Suggested Phrasing: "Test"`;

const wrongResult = formatSalesCoachReply(wrongBullets);
assert(wrongResult.includes('should have 3 bullets'), 'Bullet count validated');

console.log('All integration tests passed!');
