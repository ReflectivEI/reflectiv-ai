/**
 * Test script for formatSalesSimulationReply() function
 * Tests regex parsing and HTML output structure
 */

// Mock esc function (simple HTML escape)
function esc(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Mock md function (basic markdown)
function md(text) {
  if (!text) return "";
  return text.split(/\n{2,}/)
    .map(p => `<p>${p.replace(/\n/g, "<br>")}</p>`)
    .join("\n");
}

// Copy of formatSalesSimulationReply from widget.js
function formatSalesSimulationReply(text) {
  if (!text) return "";
  
  let html = "";
  const sections = [];
  
  // Split by major sections
  const challengeMatch = text.match(/Challenge:\s*(.+?)(?=\n\s*Rep Approach:|$)/is);
  const repApproachMatch = text.match(/Rep Approach:\s*(.+?)(?=\n\s*Impact:|$)/is);
  const impactMatch = text.match(/Impact:\s*(.+?)(?=\n\s*Suggested Phrasing:|$)/is);
  const phrasingMatch = text.match(/Suggested Phrasing:\s*(.+?)(?=\n\s*<coach>|$)/is);
  
  // Challenge section
  if (challengeMatch) {
    const challengeText = challengeMatch[1].trim();
    html += `<div class="sales-sim-section">`;
    html += `<div class="section-header"><strong>Challenge:</strong></div>`;
    html += `<div class="section-content">${esc(challengeText)}</div>`;
    html += `</div>\n\n`;
  }
  
  // Rep Approach section
  if (repApproachMatch) {
    const repText = repApproachMatch[1].trim();
    html += `<div class="sales-sim-section">`;
    html += `<div class="section-header"><strong>Rep Approach:</strong></div>`;
    html += `<ul class="section-bullets">`;
    
    // Extract bullets
    const bullets = repText.split(/\n/).map(line => {
      // Remove bullet markers (•, *, -, etc.)
      return line.trim().replace(/^[•\*\-\+]\s*/, '');
    }).filter(line => line.length > 0);
    
    bullets.forEach(bullet => {
      html += `<li>${esc(bullet)}</li>`;
    });
    
    html += `</ul>`;
    html += `</div>\n\n`;
  }
  
  // Impact section
  if (impactMatch) {
    const impactText = impactMatch[1].trim();
    html += `<div class="sales-sim-section">`;
    html += `<div class="section-header"><strong>Impact:</strong></div>`;
    html += `<div class="section-content">${esc(impactText)}</div>`;
    html += `</div>\n\n`;
  }
  
  // Suggested Phrasing section
  if (phrasingMatch) {
    const phrasingText = phrasingMatch[1].trim().replace(/^["']|["']$/g, ''); // Remove quotes
    html += `<div class="sales-sim-section">`;
    html += `<div class="section-header"><strong>Suggested Phrasing:</strong></div>`;
    html += `<div class="section-quote">"${esc(phrasingText)}"</div>`;
    html += `</div>`;
  }
  
  return html || md(text); // Fallback to regular markdown if parsing fails
}

// Test cases
const testCases = [
  {
    name: "Standard Sales-Simulation Format",
    input: `Challenge: A busy NP expresses concern about starting HIV PrEP due to patient adherence issues.

Rep Approach:
• Acknowledge the concern and validate their experience
• Ask about current adherence support systems in place
• Share data on PrEP adherence rates with proper monitoring
• Discuss practical adherence support tools

Impact: Addressing adherence proactively builds trust and demonstrates understanding of real-world clinical challenges.

Suggested Phrasing: "I appreciate your focus on adherence—it's critical for PrEP success. What adherence support systems have worked well in your practice?"

<coach>{"overall":85,"accuracy":90,"compliance":95,"discovery":80,"clarity":85,"objection_handling":80,"empathy":85}</coach>`
  },
  {
    name: "Alternative Bullet Markers",
    input: `Challenge: HCP asks about TAF vs TDF differences.

Rep Approach:
* Start with renal safety profile
* Discuss bone density considerations
* Mention dosing convenience
- Reference clinical trials

Impact: Clear comparison helps informed decision-making.

Suggested Phrasing: "According to the FDA label, TAF shows improved renal and bone safety markers compared to TDF."

<coach>{"overall":88}</coach>`
  },
  {
    name: "Minimal Format (Missing Sections)",
    input: `Challenge: Budget concerns about newer medications.

Rep Approach:
• Discuss long-term cost-effectiveness
• Mention patient assistance programs

<coach>{"overall":70}</coach>`
  }
];

// Run tests
console.log("=".repeat(80));
console.log("FORMATTING FUNCTION TEST SUITE");
console.log("=".repeat(80));

testCases.forEach((test, idx) => {
  console.log(`\n[TEST ${idx + 1}] ${test.name}`);
  console.log("-".repeat(80));
  
  const result = formatSalesSimulationReply(test.input);
  
  // Check for expected HTML elements
  const checks = {
    "Has sales-sim-section divs": result.includes('class="sales-sim-section"'),
    "Has section-header divs": result.includes('class="section-header"'),
    "Has bold Challenge header": result.includes('<strong>Challenge:</strong>'),
    "Has section-content divs": result.includes('class="section-content"') || result.includes('class="section-bullets"'),
    "Has Rep Approach header": result.includes('<strong>Rep Approach:</strong>'),
    "Has bullet list (ul)": result.includes('<ul class="section-bullets">'),
    "Has list items (li)": result.includes('<li>'),
    "No raw bullet markers": !result.includes('&bull;') && !result.match(/>\s*[•\*\-\+]\s/),
    "Impact section present": result.includes('<strong>Impact:</strong>') || !test.input.includes('Impact:'),
    "Phrasing section present": result.includes('<strong>Suggested Phrasing:</strong>') || !test.input.includes('Suggested Phrasing:'),
    "Has quote styling": result.includes('class="section-quote"') || !test.input.includes('Suggested Phrasing:'),
    "No <coach> tag in output": !result.includes('<coach>')
  };
  
  let passed = 0;
  let failed = 0;
  
  Object.entries(checks).forEach(([check, result]) => {
    const status = result ? "✅ PASS" : "❌ FAIL";
    console.log(`  ${status} - ${check}`);
    if (result) passed++;
    else failed++;
  });
  
  console.log(`\n  Summary: ${passed} passed, ${failed} failed`);
  
  if (failed === 0) {
    console.log("  ✅ TEST PASSED");
  } else {
    console.log("  ❌ TEST FAILED");
    console.log("\n  Output preview:");
    console.log(result.substring(0, 500) + "...");
  }
});

console.log("\n" + "=".repeat(80));
console.log("TEST SUITE COMPLETE");
console.log("=".repeat(80));
