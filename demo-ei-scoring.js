#!/usr/bin/env node

/**
 * EI Scoring Demo
 * Shows how different text inputs produce different EI scores
 */

import { scoreEi } from './src/ei/eiRules.ts';

console.log('═══════════════════════════════════════════════════════════');
console.log('  EI Scoring Demonstration - Sales Simulation Mode');
console.log('═══════════════════════════════════════════════════════════\n');

const samples = [
  {
    title: 'Sample 1: High Compliance (Label Anchors)',
    text: 'Per FDA label, Descovy is indicated for PrEP. According to CDC guidelines, assess renal function. Would confirming eGFR help you identify eligible patients?'
  },
  {
    title: 'Sample 2: High Discovery (Multiple Questions)',
    text: 'How do you currently screen patients? What barriers do you face? Would you consider a simplified workflow? Could we discuss next steps?'
  },
  {
    title: 'Sample 3: High Empathy (Patient-Centered)',
    text: 'I understand your concern about patient safety. We care deeply about supporting your clinical decisions. This approach helps patients access important treatment.'
  },
  {
    title: 'Sample 4: Balanced Professional',
    text: 'Per label, assess renal function before starting PrEP. Consider eGFR thresholds. How do you typically monitor kidney function in your practice?'
  },
  {
    title: 'Sample 5: Poor Compliance (Prohibited Claims)',
    text: 'This medication is the best choice and guarantees results. No side effects have been reported. It always works for every patient.'
  }
];

samples.forEach((sample, index) => {
  console.log(`\n${sample.title}`);
  console.log('─'.repeat(60));
  console.log(`Text: "${sample.text.substring(0, 80)}${sample.text.length > 80 ? '...' : ''}"`);
  console.log('');
  
  const result = scoreEi({ text: sample.text, mode: 'sales-simulation' });
  
  console.log('Scores:');
  console.log(`  Empathy:    ${result.scores.empathy}/5 ${'★'.repeat(result.scores.empathy)}${'☆'.repeat(5-result.scores.empathy)}`);
  console.log(`  Discovery:  ${result.scores.discovery}/5 ${'★'.repeat(result.scores.discovery)}${'☆'.repeat(5-result.scores.discovery)}`);
  console.log(`  Compliance: ${result.scores.compliance}/5 ${'★'.repeat(result.scores.compliance)}${'☆'.repeat(5-result.scores.compliance)}`);
  console.log(`  Clarity:    ${result.scores.clarity}/5 ${'★'.repeat(result.scores.clarity)}${'☆'.repeat(5-result.scores.clarity)}`);
  console.log(`  Accuracy:   ${result.scores.accuracy}/5 ${'★'.repeat(result.scores.accuracy)}${'☆'.repeat(5-result.scores.accuracy)}`);
  
  if (result.tips && result.tips.length > 0) {
    console.log(`\nTop Tips (${result.tips.length}):`);
    result.tips.forEach((tip, i) => console.log(`  ${i+1}. ${tip}`));
  }
  
  console.log(`\nRubric Version: ${result.rubric_version}`);
});

console.log('\n═══════════════════════════════════════════════════════════');
console.log('  Demo Complete - All Scores Clamped to 1-5 Range');
console.log('═══════════════════════════════════════════════════════════\n');
