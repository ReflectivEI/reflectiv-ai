// contracts/emotionalAssessment.cjs - Contract definition for Emotional Assessment mode
// Minimal contract - focuses on EI feedback panel

module.exports = {
  mode: 'emotional-assessment',
  formatting: {
    markdown: true,
    citations: false
  },
  specialFeatures: {
    feedbackPanel: true,
    dimensionMapping: true
  }
};
