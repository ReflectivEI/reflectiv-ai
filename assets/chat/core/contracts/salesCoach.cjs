// contracts/salesCoach.cjs - Contract definition for Sales Coach mode
// Defines expected structure, validation rules, and error messages

module.exports = {
  mode: 'sales-coach',
  requiredSections: [
    { key: 'challenge', header: 'Challenge:', next: ['Rep Approach:', 'Impact:', 'Suggested Phrasing:'] },
    { key: 'repApproach', header: 'Rep Approach:', next: ['Impact:', 'Suggested Phrasing:'] },
    { key: 'impact', header: 'Impact:', next: ['Suggested Phrasing:'] },
    { key: 'suggestedPhrasing', header: 'Suggested Phrasing:', next: [] }
  ],
  optionalSections: [],
  bulletRules: {
    repApproach: {
      required: true,
      minCount: 3,
      maxCount: 3,
      patterns: ['•', '-', '*', /\d+\./]
    }
  },
  citationRules: {
    required: false,
    patterns: [/\[([A-Z]{3,}-[A-Z0-9-]{3,})\]/]
  },
  errorMessages: {
    missingChallenge: { message: "Missing Challenge section.", sectionKey: "challenge" },
    missingRepApproach: { message: "Missing Rep Approach section.", sectionKey: "repApproach" },
    missingImpact: { message: "Missing Impact section.", sectionKey: "impact" },
    missingSuggestedPhrasing: { message: "Missing Suggested Phrasing section.", sectionKey: "suggestedPhrasing" },
    bulletCount: (count) => ({ message: `Rep Approach should have 3 bullets (found ${count}).`, sectionKey: "repApproach" })
  },
  headerPatterns: {
    relaxed: true, // Allow case-insensitive, optional punctuation
    allowedPunctuation: [':', '-']
  }
};
