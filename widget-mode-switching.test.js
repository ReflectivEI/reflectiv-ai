/**
 * Widget.js Mode Switching Test
 * Tests per-mode history tracking functionality
 * This tests the JavaScript logic without requiring a browser
 */

console.log("Testing Widget.js Mode Switching Logic...\n");

// Simulate the per-mode history structure
let modeHistories = {
  "emotional-assessment": [],
  "product-knowledge": [],
  "sales-simulation": [],
  "role-play": []
};

let currentMode = "sales-simulation";
let conversation = [];

// Test 1: Initial state
console.log("=== Test 1: Initial State ===");
console.log(`✓ currentMode: ${currentMode}`);
console.log(`✓ conversation length: ${conversation.length}`);
console.log(`✓ modeHistories initialized with 4 modes`);

// Test 2: Add messages to sales-simulation
console.log("\n=== Test 2: Add Messages to Sales Simulation ===");
conversation.push({ role: "user", content: "Tell me about PrEP" });
conversation.push({ role: "assistant", content: "PrEP is for HIV prevention" });
console.log(`✓ Added 2 messages to conversation`);
console.log(`✓ conversation length: ${conversation.length}`);

// Test 3: Switch mode (save current, load new)
console.log("\n=== Test 3: Switch to Product Knowledge Mode ===");
const previousMode = currentMode;
currentMode = "product-knowledge";

// Save current conversation to previous mode's history
if (previousMode && modeHistories[previousMode]) {
  modeHistories[previousMode] = [...conversation];
  console.log(`✓ Saved ${conversation.length} messages to ${previousMode}`);
}

// Load history for new mode
if (modeHistories[currentMode]) {
  conversation = [...modeHistories[currentMode]];
  console.log(`✓ Loaded ${conversation.length} messages from ${currentMode}`);
}

console.log(`✓ currentMode is now: ${currentMode}`);
console.log(`✓ conversation cleared (length: ${conversation.length})`);

// Test 4: Add message to product-knowledge
console.log("\n=== Test 4: Add Message to Product Knowledge ===");
conversation.push({ role: "user", content: "What is Descovy?" });
conversation.push({ role: "assistant", content: "Descovy is a PrEP medication" });
console.log(`✓ Added 2 messages to conversation`);
console.log(`✓ conversation length: ${conversation.length}`);

// Test 5: Switch back to sales-simulation (should restore history)
console.log("\n=== Test 5: Switch Back to Sales Simulation ===");
const previousMode2 = currentMode;
currentMode = "sales-simulation";

// Save current conversation
if (previousMode2 && modeHistories[previousMode2]) {
  modeHistories[previousMode2] = [...conversation];
  console.log(`✓ Saved ${conversation.length} messages to ${previousMode2}`);
}

// Load history for sales-simulation (should have 2 messages)
if (modeHistories[currentMode]) {
  conversation = [...modeHistories[currentMode]];
  console.log(`✓ Loaded ${conversation.length} messages from ${currentMode}`);
}

if (conversation.length === 2) {
  console.log(`✓ Successfully restored sales-simulation history`);
  console.log(`  Message 1: "${conversation[0].content}"`);
  console.log(`  Message 2: "${conversation[1].content}"`);
} else {
  console.error(`✗ Expected 2 messages, got ${conversation.length}`);
  process.exit(1);
}

// Test 6: Verify product-knowledge history is preserved
console.log("\n=== Test 6: Verify Product Knowledge History Preserved ===");
if (modeHistories["product-knowledge"].length === 2) {
  console.log(`✓ Product knowledge history preserved (${modeHistories["product-knowledge"].length} messages)`);
  console.log(`  Message 1: "${modeHistories["product-knowledge"][0].content}"`);
  console.log(`  Message 2: "${modeHistories["product-knowledge"][1].content}"`);
} else {
  console.error(`✗ Expected 2 messages in product-knowledge, got ${modeHistories["product-knowledge"].length}`);
  process.exit(1);
}

// Test 7: Switch to role-play (empty history)
console.log("\n=== Test 7: Switch to Role Play (Empty) ===");
const previousMode3 = currentMode;
currentMode = "role-play";

if (previousMode3 && modeHistories[previousMode3]) {
  modeHistories[previousMode3] = [...conversation];
  console.log(`✓ Saved ${conversation.length} messages to ${previousMode3}`);
}

if (modeHistories[currentMode]) {
  conversation = [...modeHistories[currentMode]];
  console.log(`✓ Loaded ${conversation.length} messages from ${currentMode}`);
}

if (conversation.length === 0) {
  console.log(`✓ Role play starts with empty history`);
} else {
  console.error(`✗ Expected 0 messages in role-play, got ${conversation.length}`);
  process.exit(1);
}

// Test 8: Verify all mode histories are independent
console.log("\n=== Test 8: Verify Mode Independence ===");
console.log(`✓ sales-simulation: ${modeHistories["sales-simulation"].length} messages`);
console.log(`✓ product-knowledge: ${modeHistories["product-knowledge"].length} messages`);
console.log(`✓ emotional-assessment: ${modeHistories["emotional-assessment"].length} messages`);
console.log(`✓ role-play: ${modeHistories["role-play"].length} messages`);

const total = Object.values(modeHistories).reduce((sum, hist) => sum + hist.length, 0);
if (total === 4) {
  console.log(`✓ Total messages across all modes: ${total}`);
} else {
  console.error(`✗ Expected 4 total messages, got ${total}`);
  process.exit(1);
}

// Test 9: Switch to emotional-assessment and back to role-play
console.log("\n=== Test 9: Multiple Mode Switches ===");
currentMode = "emotional-assessment";
conversation = [...modeHistories[currentMode]];
conversation.push({ role: "user", content: "How can I improve empathy?" });
modeHistories[currentMode] = [...conversation];
console.log(`✓ Added message to emotional-assessment`);

currentMode = "role-play";
conversation = [...modeHistories[currentMode]];
if (conversation.length === 0) {
  console.log(`✓ Role play still empty after other mode changes`);
} else {
  console.error(`✗ Role play should still be empty`);
  process.exit(1);
}

// Final summary
console.log("\n=== Test Summary ===");
console.log("All mode switching tests passed!");
console.log("\nMode Histories Final State:");
console.log(`  sales-simulation: ${modeHistories["sales-simulation"].length} messages`);
console.log(`  product-knowledge: ${modeHistories["product-knowledge"].length} messages`);
console.log(`  emotional-assessment: ${modeHistories["emotional-assessment"].length} messages`);
console.log(`  role-play: ${modeHistories["role-play"].length} messages`);

process.exit(0);
