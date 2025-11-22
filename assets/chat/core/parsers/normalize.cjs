// normalize.js - Text normalization utilities for ReflectivAI
// Extracted from widget.js for reusability and testability

/**
 * normalizeGuidanceLabels - Convert "My Approach" to "Rep Approach" for consistency
 * @param {string} text - Text to normalize
 * @returns {string} Normalized text
 */
function normalizeGuidanceLabels(text) {
  if (!text) return "";
  return String(text).replace(/\bMy\s*Approach\b/gi, "Rep Approach");
}

module.exports = {
  normalizeGuidanceLabels
};