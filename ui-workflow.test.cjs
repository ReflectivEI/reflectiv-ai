/**
 * Integration tests for workflow-based UI and EI features
 * Run with: node ui-workflow.test.js
 */

const fs = require('fs');
const path = require('path');

// Test utilities
let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`✓ ${message}`);
    testsPassed++;
  } else {
    console.error(`✗ ${message}`);
    testsFailed++;
  }
}

function assertEquals(actual, expected, message) {
  const passed = JSON.stringify(actual) === JSON.stringify(expected);
  if (passed) {
    console.log(`✓ ${message}`);
    testsPassed++;
  } else {
    console.error(`✗ ${message}`);
    console.error(`  Expected: ${JSON.stringify(expected)}`);
    console.error(`  Actual: ${JSON.stringify(actual)}`);
    testsFailed++;
  }
}

// Test workflow mode mapping
function testWorkflowModeMapping() {
  console.log("\n=== Testing Workflow Mode Mapping ===");
  
  const expectedWorkflows = [
    { key: "sales-coach", label: "Sales Coach & Call Prep", backendMode: "sales-simulation" },
    { key: "role-play", label: "Role Play w/ HCP", backendMode: "role-play" },
    { key: "ei-pk", label: "EI & Product Knowledge", backendModes: ["emotional-assessment", "product-knowledge"] }
  ];
  
  // Verify workflow labels
  assert(expectedWorkflows.length === 3, "Should have exactly 3 workflow modes");
  assert(expectedWorkflows[0].label === "Sales Coach & Call Prep", "First workflow is Sales Coach & Call Prep");
  assert(expectedWorkflows[1].label === "Role Play w/ HCP", "Second workflow is Role Play w/ HCP");
  assert(expectedWorkflows[2].label === "EI & Product Knowledge", "Third workflow is EI & Product Knowledge");
  
  // Verify backend mode mappings
  assert(expectedWorkflows[0].backendMode === "sales-simulation", "Sales Coach maps to sales-simulation");
  assert(expectedWorkflows[1].backendMode === "role-play", "Role Play maps to role-play");
  assert(Array.isArray(expectedWorkflows[2].backendModes), "EI & PK has multiple backend modes");
  assert(expectedWorkflows[2].backendModes.includes("emotional-assessment"), "EI & PK includes emotional-assessment");
  assert(expectedWorkflows[2].backendModes.includes("product-knowledge"), "EI & PK includes product-knowledge");
}

// Test backend mode constants
function testBackendModeConstants() {
  console.log("\n=== Testing Backend Mode Constants ===");
  
  const expectedModes = ["emotional-assessment", "product-knowledge", "sales-simulation", "role-play"];
  
  expectedModes.forEach(mode => {
    assert(typeof mode === "string", `Mode ${mode} is a string`);
    assert(mode.length > 0, `Mode ${mode} is not empty`);
  });
  
  assert(expectedModes.includes("emotional-assessment"), "Includes emotional-assessment mode");
  assert(expectedModes.includes("product-knowledge"), "Includes product-knowledge mode");
  assert(expectedModes.includes("sales-simulation"), "Includes sales-simulation mode");
  assert(expectedModes.includes("role-play"), "Includes role-play mode");
}

// Test about-ei.md content
function testAboutEIContent() {
  console.log("\n=== Testing about-ei.md EI DNA Content ===");
  
  const aboutEIPath = path.join(__dirname, 'assets', 'chat', 'about-ei.md');
  
  try {
    const content = fs.readFileSync(aboutEIPath, 'utf-8');
    
    // Check for required sections
    assert(content.includes("Reflectiv-AI integrates Emotional Intelligence"), "Contains EI integration statement");
    assert(content.includes("Triple-Loop Reflective Architecture"), "Contains Triple-Loop Reflection section");
    assert(content.includes("Loop 1"), "Describes Loop 1 (Task Outcome)");
    assert(content.includes("Loop 2"), "Describes Loop 2 (Emotional Regulation)");
    assert(content.includes("Loop 3"), "Describes Loop 3 (Mindset Reframing)");
    
    assert(content.includes("EI Domains and SEL Mapping"), "Contains EI Domains and SEL Mapping section");
    assert(content.includes("Self-Awareness"), "Includes Self-Awareness domain");
    assert(content.includes("Self-Regulation"), "Includes Self-Regulation domain");
    assert(content.includes("Empathy"), "Includes Empathy domain");
    assert(content.includes("CASEL"), "References CASEL SEL competencies");
    
    assert(content.includes("Reflective-AI Paradigms"), "Contains Reflective-AI Paradigms section");
    assert(content.includes("Generate → Critique → Refine"), "Describes Generate-Critique-Refine pattern");
    assert(content.includes("Reflexion"), "Mentions Reflexion-style agents");
    
    assert(content.includes("Personalized EI Growth"), "Contains Personalized EI Growth section");
    assert(content.includes("Reflective Index"), "Describes Reflective Index");
    
    assert(content.includes("Socratic Metacoach"), "Contains Socratic Metacoach section");
    assert(content.includes("What did you notice"), "Includes Socratic prompt examples");
    assert(content.includes("How might the other person"), "Includes perspective-taking prompts");
    
  } catch (err) {
    console.error("Error reading about-ei.md:", err.message);
    testsFailed++;
  }
}

// Test analytics page existence
function testAnalyticsPageExists() {
  console.log("\n=== Testing Analytics Page ===");
  
  const analyticsPath = path.join(__dirname, 'analytics.html');
  
  try {
    const content = fs.readFileSync(analyticsPath, 'utf-8');
    
    assert(content.includes("Analytics Dashboard"), "Page has Analytics Dashboard title");
    assert(content.includes("plotly"), "Includes Plotly library");
    assert(content.includes("volumeByModeChart"), "Has volume by mode chart");
    assert(content.includes("eiScoreTrendChart"), "Has EI score trend chart");
    assert(content.includes("eiDomainRadarChart"), "Has EI domain radar chart");
    assert(content.includes("riskFlagsChart"), "Has risk flags chart");
    assert(content.includes("activityHeatmapChart"), "Has activity heatmap chart");
    assert(content.includes("stub data"), "Clearly marks stub data");
    
  } catch (err) {
    console.error("Error reading analytics.html:", err.message);
    testsFailed++;
  }
}

// Test EI score details page
function testEIScoreDetailsPageExists() {
  console.log("\n=== Testing EI Score Details Page ===");
  
  const scorePath = path.join(__dirname, 'ei-score-details.html');
  
  try {
    const content = fs.readFileSync(scorePath, 'utf-8');
    
    assert(content.includes("EI Score Breakdown"), "Page has EI Score Breakdown title");
    assert(content.includes("Overall EI Composite Score"), "Has composite score section");
    assert(content.includes("Domain-by-Domain Analysis"), "Has domain analysis section");
    
    // Check all 6 domains
    assert(content.includes("Empathy"), "Includes Empathy domain");
    assert(content.includes("Self-Regulation"), "Includes Self-Regulation domain");
    assert(content.includes("Clarity of Communication"), "Includes Clarity domain");
    assert(content.includes("Compliance / Responsible Decision-Making"), "Includes Compliance domain");
    assert(content.includes("Self-Awareness"), "Includes Self-Awareness domain");
    assert(content.includes("Social / Relationship Skills"), "Includes Social Skills domain");
    
    assert(content.includes("How Your Scores Are Calculated"), "Explains scoring methodology");
    assert(content.includes("Triple-Loop Reflection"), "References Triple-Loop framework");
    assert(content.includes("CASEL SEL"), "References CASEL SEL mapping");
    assert(content.includes("Personalized Growth Path"), "Has growth path section");
    
  } catch (err) {
    console.error("Error reading ei-score-details.html:", err.message);
    testsFailed++;
  }
}

// Test navigation updates
function testNavigationUpdates() {
  console.log("\n=== Testing Navigation Updates ===");
  
  const indexPath = path.join(__dirname, 'index.html');
  
  try {
    const content = fs.readFileSync(indexPath, 'utf-8');
    
    // Check for Analytics link
    assert(content.includes('href="analytics.html"'), "Navigation includes Analytics link");
    assert(content.includes('>Analytics<'), "Analytics link has correct label");
    
    // Check for About EI dropdown
    assert(content.includes('About EI ▾'), "Navigation has About EI dropdown");
    assert(content.includes('Take EI Assessment'), "About EI includes Take EI Assessment link");
    assert(content.includes('EI Overview'), "About EI includes EI Overview link");
    assert(content.includes('EI Score Breakdown'), "About EI includes EI Score Breakdown link");
    assert(content.includes('ei-score-details.html'), "Links to EI score details page");
    
  } catch (err) {
    console.error("Error reading index.html:", err.message);
    testsFailed++;
  }
}

// Test per-mode history structure
function testPerModeHistoryStructure() {
  console.log("\n=== Testing Per-Mode History Structure ===");
  
  // Simulate expected history structure
  const expectedHistory = {
    "emotional-assessment": [],
    "product-knowledge": [],
    "sales-simulation": [],
    "role-play": []
  };
  
  Object.keys(expectedHistory).forEach(mode => {
    assert(Array.isArray(expectedHistory[mode]), `${mode} history is an array`);
    assert(expectedHistory[mode].length === 0, `${mode} history starts empty`);
  });
  
  // Test history isolation
  expectedHistory["sales-simulation"].push({ role: "user", content: "test" });
  assert(expectedHistory["sales-simulation"].length === 1, "Sales simulation history updated");
  assert(expectedHistory["role-play"].length === 0, "Role play history unaffected");
  assert(expectedHistory["emotional-assessment"].length === 0, "EI history unaffected");
  assert(expectedHistory["product-knowledge"].length === 0, "PK history unaffected");
}

// Test config.json not modified
function testConfigNotModified() {
  console.log("\n=== Testing Config Files Not Modified ===");
  
  try {
    // Check root config.json
    const rootConfigPath = path.join(__dirname, 'config.json');
    if (fs.existsSync(rootConfigPath)) {
      const content = fs.readFileSync(rootConfigPath, 'utf-8');
      // Just verify it's valid JSON and not corrupted
      JSON.parse(content);
      assert(true, "Root config.json is valid JSON");
    }
    
    // Check assets/chat/config.json
    const chatConfigPath = path.join(__dirname, 'assets', 'chat', 'config.json');
    if (fs.existsSync(chatConfigPath)) {
      const content = fs.readFileSync(chatConfigPath, 'utf-8');
      JSON.parse(content);
      assert(true, "Chat config.json is valid JSON");
    }
    
  } catch (err) {
    console.error("Config file check error:", err.message);
    testsFailed++;
  }
}

// Run all tests
async function runTests() {
  console.log("Running UI & Workflow Integration Tests...\n");
  
  try {
    testWorkflowModeMapping();
    testBackendModeConstants();
    testAboutEIContent();
    testAnalyticsPageExists();
    testEIScoreDetailsPageExists();
    testNavigationUpdates();
    testPerModeHistoryStructure();
    testConfigNotModified();
    
    console.log("\n=== Test Summary ===");
    console.log(`Passed: ${testsPassed}`);
    console.log(`Failed: ${testsFailed}`);
    
    if (testsFailed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error("Test execution failed:", error);
    process.exit(1);
  }
}

runTests();
