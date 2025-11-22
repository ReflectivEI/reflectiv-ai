// sections.js - Section parsing utilities for ReflectivAI
// Extracted from widget.js for reusability and testability

/**
 * escapeRegExp - Escape special regex characters in a string
 * @param {string} str - String to escape
 * @returns {string} Escaped string safe for regex
 */
function escapeRegExp(str) {
  return String(str || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * extractLabeledSection - Extract a labeled section from text with relaxed header matching
 * Supports case-insensitive, optional whitespace, and flexible punctuation
 * @param {string} text - Full text to search
 * @param {string} header - Section header to find (e.g., "Challenge:")
 * @param {string[]} nextHeaders - Next section headers to stop at
 * @returns {string|null} Extracted section content or null if not found
 */
function extractLabeledSection(text, header, nextHeaders = []) {
  if (!text) return null;
  // Relaxed: allow case-insensitive, optional whitespace, and minor punctuation (colon, dash, etc.)
  const relaxedHeader = header.replace(/[:\-]+$/, '').replace(/\s+/g, '\\s*');
  const headerRegex = new RegExp(relaxedHeader + '\\s*[:\-]?\\s*', 'i');
  const headerMatch = headerRegex.exec(text);
  if (!headerMatch) return null;
  const start = headerMatch.index + headerMatch[0].length;
  const after = text.slice(start);
  let end = after.length;
  for (const next of nextHeaders) {
    const relaxedNext = next.replace(/[:\-]+$/, '').replace(/\s+/g, '\\s*');
    const nextRegex = new RegExp(relaxedNext + '\\s*[:\-]?\\s*', 'i');
    const nextMatch = nextRegex.exec(after);
    if (nextMatch && nextMatch.index >= 0 && nextMatch.index < end) {
      end = nextMatch.index;
    }
  }
  return after.slice(0, end).trim();
}

module.exports = {
  escapeRegExp,
  extractLabeledSection
};