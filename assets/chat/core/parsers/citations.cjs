// citations.js - Citation processing utilities for ReflectivAI
// Extracted from widget.js for reusability and testability

/**
 * convertCitations - Convert citation codes like [HIV-PREP-001] to clickable links
 * Uses global citationsDb for lookup
 * @param {string} text - Text containing citation codes
 * @returns {string} Text with citations converted to HTML links
 */
function convertCitations(text, citationsDb = global.citationsDb) {
  if (!text) return text;

  // Match citation codes like [HIV-PREP-001] or [HIV-TREAT-TAF-001]
  // Works on both escaped and unescaped text
  return text.replace(/\[([A-Z]{3,}-[A-Z]{2,}-[A-Z0-9-]{3,})\]/g, (match, code) => {
    const citation = citationsDb[code];
    if (!citation) {
      // Unknown code - show as-is but styled
      return `<span style="background:#fee;padding:2px 4px;border-radius:3px;font-size:11px;color:#c00" title="Citation not found">${match}</span>`;
    }

    // Create clickable footnote link
    const tooltip = citation.apa || `${citation.source}, ${citation.year}`;
    return `<a href="${citation.url}" target="_blank" rel="noopener" style="background:#e0f2fe;padding:2px 6px;border-radius:4px;font-size:11px;font-weight:600;color:#0369a1;text-decoration:none;border:1px solid #bae6fd" title="${esc(tooltip)}">[${code.split('-').pop()}]</a>`;
  });
}

/**
 * esc - Escape HTML entities for safe display
 * @param {string} str - String to escape
 * @returns {string} HTML-escaped string
 */
function esc(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

module.exports = {
  convertCitations,
  esc
};
