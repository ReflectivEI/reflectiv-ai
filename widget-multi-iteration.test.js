/**
 * Comprehensive Multi-Iteration Mode Switching Test
 * Tests multiple mode switches to ensure no leakage, formatting errors, or role confusion
 */

console.log("=== Multi-Iteration Mode Switching Test ===\n");

// Simulate the widget's mode tracking system
let modeHistories = {
  "emotional-assessment": [],
  "product-knowledge": [],
  "sales-simulation": [],
  "role-play": []
};

let currentMode = "sales-simulation";
let conversation = [];

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

function switchMode(newMode, testName) {
  console.log(`\n--- ${testName}: Switching ${currentMode} → ${newMode} ---`);
  
  const previousMode = currentMode;
  
  // Save current conversation to previous mode's history
  if (previousMode && modeHistories[previousMode]) {
    modeHistories[previousMode] = [...conversation];
    console.log(`  Saved ${conversation.length} messages to ${previousMode}`);
  }
  
  // Switch mode
  currentMode = newMode;
  
  // Load history for new mode
  if (modeHistories[currentMode]) {
    conversation = [...modeHistories[currentMode]];
    console.log(`  Loaded ${conversation.length} messages from ${currentMode}`);
  } else {
    conversation = [];
  }
  
  return { previousMode, currentMode, conversationLength: conversation.length };
}

function addMessage(role, content, speaker = null) {
  const msg = { role, content };
  if (speaker) msg._speaker = speaker;
  conversation.push(msg);
  return msg;
}

function verifyModeIndependence() {
  console.log("\n--- Verifying Mode Independence ---");
  
  // Check that each mode's history is distinct
  const salesSim = modeHistories["sales-simulation"];
  const productKnow = modeHistories["product-knowledge"];
  const eiAssess = modeHistories["emotional-assessment"];
  const rolePlay = modeHistories["role-play"];
  
  // Sales simulation should have coach messages
  const salesHasCoach = salesSim.some(m => 
    m.role === "assistant" && m._speaker === "assistant"
  );
  
  // Role play should have HCP messages
  const rolePlayHasHcp = rolePlay.some(m => 
    m.role === "assistant" && m._speaker === "hcp"
  );
  
  // Check no cross-contamination
  const salesHasHcp = salesSim.some(m => m._speaker === "hcp");
  const rolePlayHasCoach = rolePlay.some(m => m._speaker === "assistant" && m.content.includes("coach"));
  
  assert(!salesHasHcp, "Sales Simulation has NO HCP messages");
  assert(!rolePlayHasCoach, "Role Play has NO coach-style messages");
  
  console.log(`  Sales Simulation: ${salesSim.length} messages`);
  console.log(`  Product Knowledge: ${productKnow.length} messages`);
  console.log(`  Emotional Assessment: ${eiAssess.length} messages`);
  console.log(`  Role Play: ${rolePlay.length} messages`);
}

function verifyRoleConsistency(mode) {
  console.log(`\n--- Verifying Role Consistency for ${mode} ---`);
  
  for (let i = 0; i < conversation.length; i++) {
    const msg = conversation[i];
    
    if (mode === "sales-simulation") {
      // Should NOT have HCP speaker
      assert(msg._speaker !== "hcp", `Message ${i}: Sales Simulation has no HCP speaker`);
      
      // Assistant messages should be coach or undefined
      if (msg.role === "assistant") {
        assert(
          !msg._speaker || msg._speaker === "assistant",
          `Message ${i}: Assistant in Sales Simulation is coach`
        );
      }
    } else if (mode === "role-play") {
      // Should have HCP speaker for assistant messages
      if (msg.role === "assistant") {
        assert(
          msg._speaker === "hcp",
          `Message ${i}: Assistant in Role Play is HCP`
        );
      }
      
      // User messages should be rep
      if (msg.role === "user") {
        assert(
          msg._speaker === "rep",
          `Message ${i}: User in Role Play is Rep`
        );
      }
    } else {
      // Product Knowledge and Emotional Assessment should have generic roles
      assert(
        msg._speaker !== "hcp",
        `Message ${i}: ${mode} has no HCP speaker`
      );
    }
  }
}

// ====== TEST SEQUENCE ======

console.log("\n=== ITERATION 1: Initial Setup ===");

// Start with Sales Simulation
addMessage("user", "Tell me about PrEP eligibility", "user");
addMessage("assistant", "PrEP is recommended for individuals at substantial risk. Here's the approach: 1) Assess risk factors 2) Discuss with patient. Suggested Phrasing: Would you like to discuss PrEP eligibility criteria?", "assistant");

assert(conversation.length === 2, "Sales Simulation has 2 messages");
verifyRoleConsistency("sales-simulation");

// ====== ITERATION 2: Switch to Role Play ======
console.log("\n=== ITERATION 2: Switch to Role Play ===");

switchMode("role-play", "Iteration 2");
assert(conversation.length === 0, "Role Play starts empty");

addMessage("user", "Hello doctor, I'd like to discuss PrEP", "rep");
addMessage("assistant", "In my clinic, we review patient history and risk factors before starting PrEP. What brings you here today?", "hcp");

assert(conversation.length === 2, "Role Play has 2 messages");
verifyRoleConsistency("role-play");

// ====== ITERATION 3: Switch to Product Knowledge ======
console.log("\n=== ITERATION 3: Switch to Product Knowledge ===");

switchMode("product-knowledge", "Iteration 3");
assert(conversation.length === 0, "Product Knowledge starts empty");

addMessage("user", "What is Descovy?", "user");
addMessage("assistant", "Descovy (emtricitabine/tenofovir alafenamide) is indicated for PrEP [1]. References: [1] FDA Label Descovy PrEP", "assistant");

assert(conversation.length === 2, "Product Knowledge has 2 messages");
verifyRoleConsistency("product-knowledge");

// ====== ITERATION 4: Back to Sales Simulation ======
console.log("\n=== ITERATION 4: Back to Sales Simulation ===");

switchMode("sales-simulation", "Iteration 4");
assert(conversation.length === 2, "Sales Simulation history restored (2 messages)");
assert(conversation[0].content.includes("PrEP eligibility"), "First message preserved");
assert(conversation[1].content.includes("Suggested Phrasing"), "Second message has Suggested Phrasing");

// Add another message
addMessage("user", "How do I handle objections?", "user");
addMessage("assistant", "Address concerns directly with label-aligned facts. Suggested Phrasing: What specific concerns do you have about PrEP?", "assistant");

assert(conversation.length === 4, "Sales Simulation now has 4 messages");
verifyRoleConsistency("sales-simulation");

// ====== ITERATION 5: Switch to Emotional Assessment ======
console.log("\n=== ITERATION 5: Switch to Emotional Assessment ===");

switchMode("emotional-assessment", "Iteration 5");
assert(conversation.length === 0, "Emotional Assessment starts empty");

addMessage("user", "How can I improve my empathy with difficult HCPs?", "user");
addMessage("assistant", "Affirmation: You're asking the right question. Diagnosis: Focus on active listening. Guidance: Practice reflective statements. Reflection: What emotions do you notice when facing resistance?", "assistant");

assert(conversation.length === 2, "Emotional Assessment has 2 messages");
verifyRoleConsistency("emotional-assessment");

// ====== ITERATION 6: Back to Role Play ======
console.log("\n=== ITERATION 6: Back to Role Play ===");

switchMode("role-play", "Iteration 6");
assert(conversation.length === 2, "Role Play history restored (2 messages)");
assert(conversation[0]._speaker === "rep", "First message is from rep");
assert(conversation[1]._speaker === "hcp", "Second message is from hcp");

// Add another HCP response
addMessage("user", "I have several high-risk patients", "rep");
addMessage("assistant", "That's good to hear. Let's discuss your patient selection criteria and any concerns about adherence monitoring.", "hcp");

assert(conversation.length === 4, "Role Play now has 4 messages");
verifyRoleConsistency("role-play");

// ====== ITERATION 7: Back to Product Knowledge ======
console.log("\n=== ITERATION 7: Back to Product Knowledge ===");

switchMode("product-knowledge", "Iteration 7");
assert(conversation.length === 2, "Product Knowledge history restored");

addMessage("user", "What are the side effects?", "user");
addMessage("assistant", "Common side effects include nausea and headache [1]. Renal monitoring is recommended [2]. References: [1] FDA Label, [2] CDC Guidelines", "assistant");

assert(conversation.length === 4, "Product Knowledge now has 4 messages");
verifyRoleConsistency("product-knowledge");

// ====== ITERATION 8: Back to Sales Simulation ======
console.log("\n=== ITERATION 8: Back to Sales Simulation ===");

switchMode("sales-simulation", "Iteration 8");
assert(conversation.length === 4, "Sales Simulation history preserved (4 messages)");

// Verify no HCP language leaked in
const hasHcpLanguage = conversation.some(m => 
  m.content.toLowerCase().includes("in my clinic") ||
  m.content.toLowerCase().includes("my patients")
);
assert(!hasHcpLanguage, "Sales Simulation has NO HCP-style language");

// ====== ITERATION 9: Rapid Switching Test ======
console.log("\n=== ITERATION 9: Rapid Mode Switching ===");

// Switch rapidly between modes
switchMode("role-play", "Rapid 1");
assert(conversation.length === 4, "Role Play history intact after rapid switch");

switchMode("product-knowledge", "Rapid 2");
assert(conversation.length === 4, "Product Knowledge history intact");

switchMode("emotional-assessment", "Rapid 3");
assert(conversation.length === 2, "Emotional Assessment history intact");

switchMode("sales-simulation", "Rapid 4");
assert(conversation.length === 4, "Sales Simulation history intact");

switchMode("role-play", "Rapid 5");
assert(conversation.length === 4, "Role Play still intact after multiple switches");

// ====== FINAL VERIFICATION ======
console.log("\n=== FINAL VERIFICATION ===");

verifyModeIndependence();

// Check total message counts
const totalMessages = Object.values(modeHistories).reduce((sum, hist) => sum + hist.length, 0);
console.log(`\nTotal messages across all modes: ${totalMessages}`);
assert(totalMessages === 14, "Total message count is correct (14 messages)");

// Verify each mode has correct message count
assert(modeHistories["sales-simulation"].length === 4, "Sales Simulation: 4 messages");
assert(modeHistories["product-knowledge"].length === 4, "Product Knowledge: 4 messages");
assert(modeHistories["emotional-assessment"].length === 2, "Emotional Assessment: 2 messages");
assert(modeHistories["role-play"].length === 4, "Role Play: 4 messages");

// Verify no cross-contamination of content
console.log("\n--- Content Isolation Check ---");

// Sales Simulation should have "Suggested Phrasing"
const salesHasPhrasing = modeHistories["sales-simulation"].some(m => 
  m.content.includes("Suggested Phrasing")
);
assert(salesHasPhrasing, "Sales Simulation has 'Suggested Phrasing'");

// Role Play should have "my clinic" language
const rolePlayHasClinic = modeHistories["role-play"].some(m => 
  m.content.toLowerCase().includes("my clinic") || m.content.toLowerCase().includes("in my")
);
assert(rolePlayHasClinic, "Role Play has HCP first-person language");

// Product Knowledge should have citations
const productHasCitations = modeHistories["product-knowledge"].some(m => 
  m.content.includes("[1]") || m.content.includes("References:")
);
assert(productHasCitations, "Product Knowledge has citations");

// Emotional Assessment should have reflection prompts
const eiHasReflection = modeHistories["emotional-assessment"].some(m => 
  m.content.includes("Reflection:") || m.content.includes("What emotions")
);
assert(eiHasReflection, "Emotional Assessment has reflection prompts");

// Verify NO cross-contamination
const salesHasClinic = modeHistories["sales-simulation"].some(m => 
  m.content.toLowerCase().includes("my clinic")
);
assert(!salesHasClinic, "Sales Simulation does NOT have 'my clinic' language");

const rolePlayHasPhrasing = modeHistories["role-play"].some(m => 
  m.content.includes("Suggested Phrasing")
);
assert(!rolePlayHasPhrasing, "Role Play does NOT have 'Suggested Phrasing'");

const productHasPhrasing = modeHistories["product-knowledge"].some(m => 
  m.content.includes("Suggested Phrasing")
);
assert(!productHasPhrasing, "Product Knowledge does NOT have 'Suggested Phrasing'");

// ====== SUMMARY ======
console.log("\n=== TEST SUMMARY ===");
console.log(`Tests Passed: ${testsPassed}`);
console.log(`Tests Failed: ${testsFailed}`);

if (testsFailed === 0) {
  console.log("\n✓ ALL MULTI-ITERATION MODE SWITCHING TESTS PASSED!");
  console.log("✓ No leakage detected");
  console.log("✓ No formatting errors");
  console.log("✓ No role confusion");
  process.exit(0);
} else {
  console.error("\n✗ SOME TESTS FAILED!");
  process.exit(1);
}
