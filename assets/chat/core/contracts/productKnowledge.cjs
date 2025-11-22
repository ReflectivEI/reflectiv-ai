// contracts/productKnowledge.cjs - Contract definition for Product Knowledge mode
// Defines citation and reference requirements

module.exports = {
  mode: 'product-knowledge',
  citationRules: {
    required: false, // Encouraged but not required
    patterns: [
      /\[(\d+)\]/, // Numeric [1]
      /\[([A-Z]{2,}-[A-Z0-9-]{2,})\]/ // Code-based [HIV-TREAT-001]
    ],
    warningThreshold: 0 // Warn if no citations
  },
  referenceRules: {
    sectionPattern: /References:\s*([\s\S]*)$/i,
    linePatterns: [
      /^\d+\s*[\.\-\)]\s+/, // 1. Reference
      /^\d+\.\s*/, // 1. Reference
      /^\d+\-\s*/, // 1- Reference
      /^\d+\)\s*/ // 1) Reference
    ],
    required: false // Section existence is enough
  },
  formatting: {
    markdown: true,
    citations: true
  }
};
