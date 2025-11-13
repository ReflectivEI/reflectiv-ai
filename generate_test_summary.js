#!/usr/bin/env node
/**
 * Aggregate recent runs from live_sales_coach_tests.txt into a markdown report.
 */
import fs from 'fs';
const source = 'live_sales_coach_tests.txt';
const out = 'LIVE_SALES_COACH_TEST_SUMMARY.md';
if(!fs.existsSync(source)){
  console.error('[summary] Source file missing');
  process.exit(1);
}
const content = fs.readFileSync(source,'utf8').trim();
const runs = content.split(/\n={3,} Run at /).filter(Boolean).map(chunk=>('Run at '+chunk).trim());
const parsed = runs.slice(-10).map(r=>{
  const headerMatch = r.match(/Run at (.*?) \(status=(.*?)\)/);
  const suggested = /Suggested Phrasing[\s\S]*?(?=\n[A-Z][A-Z \-/]{3,}\n|<coach>|$)/.exec(r);
  const coachTag = /<coach>[\s\S]*?<\/coach>/i.test(r);
  return {
    header: headerMatch?headerMatch[0]:'(unknown)',
    timestamp: headerMatch?headerMatch[1]:'',
    status: headerMatch?headerMatch[2]:'',
    suggestedLen: suggested? suggested[0].length:0,
    coachTag,
    truncationSuspect: suggested ? (/\.\.\.$/.test(suggested[0]) || suggested[0].length < 200) : true
  };
});
let md = '# Live Sales Coach Test Summary (Recent 10 Runs)\n\n';
md += '| Timestamp | Status | SuggestedLen | CoachTag | TruncationSuspect |\n';
md += '|-----------|--------|--------------|----------|-------------------|\n';
for(const p of parsed){
  md += `| ${p.timestamp} | ${p.status} | ${p.suggestedLen} | ${p.coachTag?'yes':'no'} | ${p.truncationSuspect?'yes':'no'} |\n`;
}
md += '\nNotes: truncationSuspect flags runs with ellipsis or very short phrasing (<200 chars).\n';
fs.writeFileSync(out, md);
console.log('[summary] Wrote', out);
