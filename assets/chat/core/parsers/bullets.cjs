// bullets.js - Bullet parsing utilities for ReflectivAI
// Extracted from widget.js for reusability and testability

/**
 * parseSalesCoachBullets - Parse bullet lists from Sales Coach responses
 * Handles various formats: multi-line bullets, inline markers, semicolons
 * @param {string} text - The text to parse for bullets
 * @returns {string[]} Array of bullet text items
 */
function parseSalesCoachBullets(text) {
  if (!text) return [];
  const bulletPattern = "(?:[•●○\\-\\*]|\\d+[\\.\\)])";
  const bulletRegex = new RegExp(`^${bulletPattern}\\s*(.+)$`);
  const sameLineRegex = new RegExp(`^Rep Approach:\\s*${bulletPattern}\\s*(.+)$`, "i");
  const inlineMarkerPattern = "(?:[•●○*])";

  let base = String(text)
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return null;
      const liMatch = trimmed.match(/<li[^>]*>([\s\S]*?)<\/li>/i);
      if (liMatch) {
        return liMatch[1].replace(/<[^>]+>/g, "").trim();
      }
      const bulletMatch = trimmed.match(bulletRegex);
      if (bulletMatch) {
        return bulletMatch[1].trim();
      }
      const sameLineMatch = trimmed.match(sameLineRegex);
      if (sameLineMatch) {
        return sameLineMatch[1].trim();
      }
      const entityMatch = trimmed.match(/^&bull;\s*(.+)$/i);
      if (entityMatch) {
        return entityMatch[1].trim();
      }
      // Accept semicolon-separated bullets on a single line
      if (/;/.test(trimmed) && trimmed.startsWith('Rep Approach:')) {
        return trimmed.replace(/^Rep Approach:\s*/i, '').split(';').map(b => b.trim()).filter(Boolean);
      }
      return null;
    })
    .flat()
    .filter(Boolean);
  if (base.length >= 3) return base;
  // Accept bullets separated by semicolons anywhere
  if (typeof text === 'string' && text.includes(';')) {
    const semis = text.split(';').map(b => b.replace(/^Rep Approach:\s*/i, '').trim()).filter(Boolean);
    if (semis.length >= 3) return semis;
  }
  const inline = [];
  const inlineRegex = new RegExp(`${inlineMarkerPattern}\\s*(.*?)(?=(?:\\s${inlineMarkerPattern})|$)`, "g");
  let match;
  while ((match = inlineRegex.exec(String(text))) !== null) {
    const candidate = match[1].trim();
    if (candidate) inline.push(candidate);
  }
  if (inline.length) return inline;
  return base;
}

module.exports = {
  parseSalesCoachBullets
};