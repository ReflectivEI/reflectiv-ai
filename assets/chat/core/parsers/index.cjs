// parsers/index.js - Central export for all parsing utilities
// Provides unified access to parsing functions for ReflectivAI

const { parseSalesCoachBullets } = require('./bullets.cjs');
const { escapeRegExp, extractLabeledSection } = require('./sections.cjs');
const { normalizeGuidanceLabels } = require('./normalize.cjs');
const { convertCitations, esc } = require('./citations.cjs');

module.exports = {
  // Bullets
  parseSalesCoachBullets,

  // Sections
  escapeRegExp,
  extractLabeledSection,

  // Normalization
  normalizeGuidanceLabels,

  // Citations
  convertCitations,
  esc
};
