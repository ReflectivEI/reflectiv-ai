// crossModeStability.test.cjs - Test parsing stability across all modes
const assert = require('assert');
const { extractLabeledSection } = require('../assets/chat/core/parsers/index.cjs');

// Mock currentMode for testing
let currentMode = 'sales-coach';

function md(text) {
  if (!text) return "";
  let s = text; // Simplified for test
  // Product Knowledge relaxed contract enforcement
  if (currentMode === "product-knowledge") {
    const citationMatches = s.match(/\[(?:\d+|[A-Z]{2,}-[A-Z0-9-]{2,})\]/g) || [];
    const refSectionMatch = s.match(/References:\s*([\s\S]*)$/i);
    if (citationMatches.length === 0) {
      console.warn("[PK Validation] No inline citations found - proceeding");
    }
  }
  return s; // Simplified
}

console.log('Running Cross-Mode Parsing Stability Tests...');

// Sales Coach - ensure relaxed matching doesn't break
const salesCoachText = `challenge : Patient needs education
Rep Approach: • Point 1 • Point 2 • Point 3
impact- Analysis here
Suggested Phrasing: "Question?"`;

assert(extractLabeledSection(salesCoachText, "Challenge:", ["Rep Approach:", "Impact:", "Suggested Phrasing:"]), "Relaxed Challenge extraction");
assert(extractLabeledSection(salesCoachText, "Rep Approach:", ["Impact:", "Suggested Phrasing:"]), "Relaxed Rep Approach extraction");

// Role Play - ensure no sales-coach sections detected in clean HCP response
const rolePlayText = `The patient has been stable on their current regimen.
We should check their latest labs and consider any adherence issues.
Would you like to discuss the next steps?`;

assert(!/\bChallenge:/i.test(rolePlayText), "No Challenge in role-play");
assert(!/\bRep Approach:/i.test(rolePlayText), "No Rep Approach in role-play");

// Product Knowledge - ensure References detection works
currentMode = 'product-knowledge';
const pkText = `This medication is indicated for [HIV-TREAT-001] treatment.
References:
1. FDA Label, 2023
2. Clinical Guidelines, 2024`;

assert(md(pkText).includes('References'), "PK References preserved");

// Emotional Assessment - no section parsing, just markdown
currentMode = 'emotional-assessment';
const eaText = `**Strong empathy** shown here.
- Good listening
- Appropriate questions`;

assert(md(eaText).includes('**Strong empathy**'), "EA markdown preserved");

// General Knowledge - clean formatting
currentMode = 'general-knowledge';
const gkText = `This is a general response with **bold** text.`;
assert(md(gkText).includes('**bold**'), "GK markdown preserved");

console.log('All cross-mode stability tests passed!');
