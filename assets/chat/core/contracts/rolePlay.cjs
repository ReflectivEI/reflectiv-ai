// contracts/rolePlay.cjs - Contract definition for Role Play mode
// Defines leak detection patterns and sanitization rules

module.exports = {
  mode: 'role-play',
  leakPatterns: [
    { pattern: /<coach>[\s\S]*?<\/coach>/i, message: 'Leaked <coach> JSON block' },
    { pattern: /\bSuggested Phrasing:/i, message: 'Contains "Suggested Phrasing:" heading' },
    { pattern: /\bRep Approach:/i, message: 'Contains "Rep Approach:" heading' },
    { pattern: /\bImpact:/i, message: 'Contains "Impact:" heading' },
    { pattern: /\bChallenge:/i, message: 'Contains "Challenge:" heading' },
    { pattern: /Sales Coach/i, message: 'Mentions Sales Coach' },
    { pattern: /"scores"\s*:\s*\{[\s\S]*?\}/i, message: 'Embedded scoring JSON' },
    { pattern: /rubric_version/i, message: 'Rubric metadata leaked' },
    { pattern: /\byou should say\b/i, message: 'Meta-coaching: "you should say"' },
    { pattern: /\bas the rep\b/i, message: 'Meta-coaching: "as the rep"' }
  ],
  allowedBehavior: {
    clinicalReasoning: '1-4 sentences',
    bulletLists: 'brief, for steps/criteria/monitoring (•, -, *)',
    tone: 'professional, no evaluating/scoring rep'
  },
  sanitization: {
    removePatterns: [
      /<coach>[\s\S]*?<\/coach>/gi,
      /\bSuggested Phrasing:/gi,
      /\bRep Approach:/gi,
      /\bImpact:/gi,
      /\bChallenge:/gi,
      /Sales Coach/gi,
      /"scores"\s*:\s*\{[\s\S]*?\}/gi,
      /rubric_version/gi,
      /\byou should say\b/gi,
      /\bas the rep\b/gi
    ]
  }
};
