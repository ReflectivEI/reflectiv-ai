#!/usr/bin/env node
/**
 * Simulate frontend parsing of Sales Coach reply to verify full sections present.
 * Reads latest JSON output from watch script (live_sales_coach_tests.json).
 */
import fs from 'fs';
const file = 'live_sales_coach_tests.json';
if (!fs.existsSync(file)) {
  console.error('[parser] Missing file live_sales_coach_tests.json');
  process.exit(1);
}
const data = JSON.parse(fs.readFileSync(file,'utf8'));
const raw = data.raw || '';
function extractSection(label) {
  // Capture section starting at label until next all-caps heading or <coach>
  const regex = new RegExp(label.replace(/[-/\\^$*+?.()|[\]{}]/g,'\\$&') + '[\s\S]*?(?=\n[A-Z][A-Z \-/]{3,}\n|<coach>|$)','i');
  const m = raw.match(regex);
  return m ? m[0].trim() : null;
}
const sections = {
  suggestedPhrasing: extractSection('Suggested Phrasing'),
  coachingGuidance: extractSection('Coaching Guidance'),
};
const coachTagPresent = /<coach>\s*\{[\s\S]*?\}\s*<\/coach>/i.test(raw);
const truncationSuspect = /\.\.\.$/.test(sections.suggestedPhrasing || '') || (sections.suggestedPhrasing && sections.suggestedPhrasing.length < 200);
const result = {
  timestamp: data.timestamp,
  status: data.status,
  lengths: {
    suggestedPhrasing: sections.suggestedPhrasing ? sections.suggestedPhrasing.length : 0,
    coachingGuidance: sections.coachingGuidance ? sections.coachingGuidance.length : 0,
    raw: raw.length,
  },
  coachTagPresent,
  truncationSuspect,
  missing: Object.entries(sections).filter(([k,v]) => !v).map(([k])=>k)
};
console.log(JSON.stringify(result,null,2));
if (result.missing.length || !coachTagPresent || truncationSuspect) {
  console.error('[parser] Issues detected:', result);
  process.exitCode = 2;
}
