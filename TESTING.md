# Manual Testing Guide

## Test Environment Setup

### 1. Start Dev Server
```bash
node tools/scripts/dev-server.mjs 3000
```

### 2. Open in Browser
Navigate to: http://localhost:3000/

## Test Scenarios

### Test 1: Basic Widget Loading
**Objective**: Verify new modular widget loads correctly

**Steps**:
1. Open the page
2. Click "Try a Simulation" button
3. Observe coach modal opens
4. Verify mode selector shows 4 modes

**Expected**:
- Modal opens smoothly
- Mode selector displays: Sales Simulation, Product Knowledge, Role Play, Emotional Assessment
- No console errors
- CSS variables applied correctly (navy, teal colors)

**Pass Criteria**: ✓ Modal opens, modes visible, no errors

---

### Test 2: Sales Simulation - 4 Sections
**Objective**: Validate 4-section format enforcement

**Steps**:
1. Open coach modal
2. Select "Sales Simulation" mode
3. Type message: "How do I handle a skeptical HCP?"
4. Click Send
5. Observe response structure

**Expected**:
- Response contains exactly 4 sections in order:
  1. **Challenge** - Describes the objection/situation
  2. **Rep Approach** - Evaluates strategy
  3. **Impact** - Assesses effectiveness
  4. **Suggested Phrasing** - Specific phrases to use
- Each section has clear header
- "Suggested Phrasing" is NEVER missing

**Pass Criteria**: ✓ All 4 sections present, properly formatted

---

### Test 3: Latency - Fast Fail
**Objective**: Test 8-second timeout with retry

**Steps**:
1. Open browser DevTools → Network tab
2. Enable "Offline" mode
3. Send a message in chat
4. Wait and observe

**Expected**:
- Typing indicator appears within 100ms
- After 8 seconds, error message shows: "No response received within 8 seconds"
- Retry button appears
- Request ID displayed
- No hanging/frozen UI

**Pass Criteria**: ✓ Timeout triggers, retry button works

---

### Test 4: Input Debouncing
**Objective**: Verify input debounce prevents layout thrash

**Steps**:
1. Open DevTools → Performance tab
2. Start recording
3. Type rapidly in chat textarea
4. Stop recording after 5 seconds
5. Check for layout recalculations

**Expected**:
- Input events debounced (300ms delay)
- Minimal layout recalculations
- Smooth typing experience
- No jank or stutter

**Pass Criteria**: ✓ Smooth input, <10 layout recalcs per second

---

### Test 5: Mode Switching
**Objective**: Test mode isolation and guards reset

**Steps**:
1. Select "Sales Simulation" mode
2. Send message, get 4-section response
3. Switch to "Product Knowledge" mode
4. Send message
5. Observe response format

**Expected**:
- Mode switch successful
- Product Knowledge response NOT validated for 4 sections
- No "Suggested Phrasing" error for Product Knowledge
- Guards properly isolated per mode

**Pass Criteria**: ✓ Modes switch cleanly, proper isolation

---

### Test 6: Preloading
**Objective**: Verify resources preloaded on page load

**Steps**:
1. Open DevTools → Network tab
2. Reload page (Ctrl+R)
3. Observe network requests
4. Look for preload requests

**Expected**:
- `assets/chat/config.json` preloaded
- `assets/chat/data/scenarios.merged.json` preloaded
- Both loaded before user interaction
- Cache hit on subsequent requests

**Pass Criteria**: ✓ Resources preloaded, cached

---

### Test 7: Feature Flag - Legacy Fallback
**Objective**: Test fallback to widget.js

**Steps**:
1. Edit index.html
2. Set `window.REFLECTIV_USE_NEW_WIDGET = false;`
3. Reload page
4. Open coach modal
5. Test basic chat

**Expected**:
- Widget.js loads instead of new modules
- Chat still functional
- Old widget behavior maintained
- Console shows "Using fallback widget.js"

**Pass Criteria**: ✓ Fallback works, chat functional

---

### Test 8: CSS Theming
**Objective**: Verify CSS variables applied correctly

**Steps**:
1. Open DevTools → Elements tab
2. Inspect widget container
3. Check computed styles
4. Verify CSS variables

**Expected Variables**:
- `--accent: #20bfa9` (teal)
- `--radius: 12px`
- `--ink: #1e2a3a` (dark text)
- `--line: #d9e3ef` (borders)
- `--soft: #ecf3fb` (backgrounds)

**Pass Criteria**: ✓ All CSS vars defined and applied

---

### Test 9: Error Handling
**Objective**: Test graceful error handling

**Steps**:
1. Open DevTools → Console
2. Send message
3. Check for any errors
4. Test with invalid input (empty message)
5. Test with very long message (5000 chars)

**Expected**:
- No unhandled errors
- Empty message: no action (disabled send)
- Long message: handled gracefully
- Errors logged to console
- User-friendly error messages

**Pass Criteria**: ✓ No crashes, graceful handling

---

### Test 10: RAF Batching
**Objective**: Verify smooth DOM updates

**Steps**:
1. Open DevTools → Performance
2. Start recording
3. Send 5 messages rapidly
4. Stop recording
5. Check frame rate

**Expected**:
- Consistent 60 FPS rendering
- DOM updates batched via RAF
- Smooth scroll animations
- No forced reflows
- Clean flame graph

**Pass Criteria**: ✓ 60 FPS, batched updates

---

### Test 11: Security - XSS Protection
**Objective**: Verify XSS protection

**Steps**:
1. In chat, type: `<script>alert('XSS')</script>`
2. Send message
3. Observe response

**Expected**:
- Script tags escaped: `&lt;script&gt;`
- No alert popup
- Text rendered safely
- HTML entities visible in response

**Pass Criteria**: ✓ No XSS, content escaped

---

### Test 12: CSP Compliance
**Objective**: Verify CSP policy enforced

**Steps**:
1. Open DevTools → Console
2. Check for CSP violations
3. Verify allowed origins

**Expected**:
- No CSP violations
- Worker origin allowed: `https://my-chat-agent-v2.tonyabdelmalak.workers.dev`
- Tailwind CDN allowed: `https://cdn.tailwindcss.com`
- Google Fonts allowed
- No inline script errors

**Pass Criteria**: ✓ No CSP violations

---

## Performance Benchmarks

### Expected Metrics
- **First Paint**: <1.5s (with preloading)
- **Input Debounce**: 300ms
- **Fast Fail Timeout**: 8s
- **Frame Rate**: 60 FPS
- **Network Retries**: 3 max (600ms, 1.2s, 2.4s delays)

### Test with Chrome DevTools

1. **Lighthouse Audit**:
   ```
   Performance: >90
   Accessibility: >90
   Best Practices: >90
   ```

2. **Network Throttling**:
   - Test with "Slow 3G"
   - Verify timeout handles correctly
   - Check retry logic

3. **CPU Throttling**:
   - Test with "6x slowdown"
   - Verify RAF batching helps
   - Check for jank

---

## Browser Compatibility

Test in:
- ✓ Chrome 90+
- ✓ Firefox 88+
- ✓ Safari 14+
- ✓ Edge 90+

### ES6 Modules Support Required
Browsers without ES6 modules will use fallback widget.js

---

## Automated Test Suite

Run before manual testing:
```bash
node tools/tests/leakage.spec.mjs
```

**Expected**: 10/10 tests passing ✓

---

## Checklist

- [ ] Test 1: Widget loading
- [ ] Test 2: 4-section format
- [ ] Test 3: Fast-fail timeout
- [ ] Test 4: Input debouncing
- [ ] Test 5: Mode switching
- [ ] Test 6: Preloading
- [ ] Test 7: Legacy fallback
- [ ] Test 8: CSS theming
- [ ] Test 9: Error handling
- [ ] Test 10: RAF batching
- [ ] Test 11: XSS protection
- [ ] Test 12: CSP compliance
- [ ] Automated tests pass
- [ ] No console errors
- [ ] Performance acceptable

---

## Issue Reporting

If any test fails, report with:
1. Test number and name
2. Browser and version
3. Console error (if any)
4. Screenshot
5. Steps to reproduce
6. Expected vs actual behavior

---

## Sign-off

- Tester: _______________
- Date: _______________
- Environment: _______________
- All tests passed: Yes / No
- Notes: _______________
