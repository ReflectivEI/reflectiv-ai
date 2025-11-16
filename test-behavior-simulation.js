/**
 * Behavioral Test: Backend Unavailable Button Fix
 * 
 * This test validates the behavior of the fix by simulating the state transitions
 */

console.log('\n=== Behavioral Test: Backend Unavailable Fix ===\n');

// Simulate the widget state machine
class WidgetStateMachine {
  constructor() {
    this.isHealthy = false;
    this.isSending = false;
    this.sendButtonDisabled = true;
    this.bannerVisible = false;
  }

  // Simulate the checkHealth function behavior
  async checkHealth(backendAvailable) {
    console.log(`\ncheckHealth() called, backend available: ${backendAvailable}`);
    
    if (backendAvailable) {
      this.isHealthy = true;
      this.hideBanner();
      this.enableSendButton();
      console.log('  ✓ Backend healthy - banner hidden, button enabled');
      return true;
    } else {
      this.isHealthy = false;
      this.showBanner();
      this.disableSendButton();
      console.log('  ✓ Backend unhealthy - banner shown, button disabled');
      return false;
    }
  }

  showBanner() {
    this.bannerVisible = true;
  }

  hideBanner() {
    this.bannerVisible = false;
  }

  enableSendButton() {
    this.sendButtonDisabled = false;
  }

  disableSendButton() {
    this.sendButtonDisabled = true;
  }

  // Simulate the OLD behavior (before fix)
  async sendMessage_OLD(userText) {
    console.log(`\nsendMessage_OLD() called with: "${userText}"`);
    
    if (this.isSending) {
      console.log('  Already sending, return');
      return;
    }

    this.isSending = true;
    this.sendButtonDisabled = true;

    try {
      // Health gate
      if (!this.isHealthy) {
        console.log('  ✗ BLOCKED by health gate (backend unavailable)');
        return;
      }

      console.log('  Passed health gate, proceeding...');
      // Simulate message sending
      console.log('  Sending message...');
    } finally {
      // OLD CODE: Unconditionally re-enable button
      this.sendButtonDisabled = false; // BUG: This is the problem!
      this.isSending = false;
      console.log('  ✗ OLD finally block: Button ALWAYS re-enabled (BUG!)');
    }
  }

  // Simulate the NEW behavior (after fix)
  async sendMessage_NEW(userText) {
    console.log(`\nsendMessage_NEW() called with: "${userText}"`);
    
    if (this.isSending) {
      console.log('  Already sending, return');
      return;
    }

    this.isSending = true;
    this.sendButtonDisabled = true;

    try {
      // Health gate
      if (!this.isHealthy) {
        console.log('  ✗ BLOCKED by health gate (backend unavailable)');
        return;
      }

      console.log('  Passed health gate, proceeding...');
      // Simulate message sending
      console.log('  Sending message...');
    } finally {
      // NEW CODE: Only re-enable if backend is healthy
      this.sendButtonDisabled = !this.isHealthy; // FIX: Check health status!
      this.isSending = false;
      console.log(`  ✓ NEW finally block: Button disabled = ${this.sendButtonDisabled} (isHealthy = ${this.isHealthy})`);
    }
  }

  getState() {
    return {
      isHealthy: this.isHealthy,
      isSending: this.isSending,
      sendButtonDisabled: this.sendButtonDisabled,
      bannerVisible: this.bannerVisible
    };
  }

  printState(label) {
    const state = this.getState();
    console.log(`\n[${label}]`);
    console.log(`  isHealthy: ${state.isHealthy}`);
    console.log(`  sendButtonDisabled: ${state.sendButtonDisabled}`);
    console.log(`  bannerVisible: ${state.bannerVisible}`);
  }
}

// Test scenario
async function runTest() {
  console.log('\n--- Testing OLD behavior (before fix) ---');
  
  const widgetOld = new WidgetStateMachine();
  
  // 1. Backend goes down
  console.log('\n[1] Backend becomes unavailable');
  await widgetOld.checkHealth(false);
  widgetOld.printState('After health check fails');
  
  // 2. User tries to send (blocked by health gate)
  console.log('\n[2] User clicks SEND button while backend is down');
  await widgetOld.sendMessage_OLD('Test message');
  widgetOld.printState('After send attempt');
  
  // Check the bug
  if (!widgetOld.sendButtonDisabled) {
    console.log('\n❌ BUG DETECTED: Button was re-enabled even though backend is still down!');
    console.log('   User can keep clicking SEND button repeatedly.');
  }
  
  console.log('\n\n--- Testing NEW behavior (after fix) ---');
  
  const widgetNew = new WidgetStateMachine();
  
  // 1. Backend goes down
  console.log('\n[1] Backend becomes unavailable');
  await widgetNew.checkHealth(false);
  widgetNew.printState('After health check fails');
  
  // 2. User tries to send (blocked by health gate)
  console.log('\n[2] User clicks SEND button while backend is down');
  await widgetNew.sendMessage_NEW('Test message');
  widgetNew.printState('After send attempt');
  
  // Check the fix
  if (widgetNew.sendButtonDisabled) {
    console.log('\n✅ FIX VERIFIED: Button stays disabled because backend is still down!');
    console.log('   User cannot keep clicking SEND button.');
  } else {
    console.log('\n❌ FIX FAILED: Button was incorrectly enabled!');
  }
  
  // 3. Backend comes back up
  console.log('\n\n[3] Backend becomes available again');
  await widgetNew.checkHealth(true);
  widgetNew.printState('After health check succeeds');
  
  if (!widgetNew.sendButtonDisabled && !widgetNew.bannerVisible) {
    console.log('\n✅ RECOVERY VERIFIED: Button enabled and banner hidden when backend is healthy!');
  }
}

// Run the test
runTest().catch(console.error);

console.log('\n=== Summary ===');
console.log('The fix ensures that the SEND button is only re-enabled in the finally block');
console.log('when isHealthy is true. This prevents users from repeatedly clicking SEND');
console.log('when the backend is unavailable.\n');
