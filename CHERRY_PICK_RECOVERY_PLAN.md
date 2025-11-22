# Cherry-Pick Recovery Plan
**Date:** November 12, 2025
**Goal:** Restore all Nov 10-11 widget.js enhancements lost to corruption

---

## 📋 COMMITS TO CHERRY-PICK (In Order)

Based on git history and documentation analysis:

### Batch 1: Foundation Fixes (Nov 10, 2:39 PM - 3:32 PM)
```bash
dce5c1e  # Fix: Remove compliance codes from output and improve bullet rendering
92807dc  # Add: FDA-compliant citations system + auto-detect Product Knowledge mode
3f600bd  # FIX: Chat reset on mode switch + General Assistant mode + Enhanced comprehensive prompts
```

**What these restore:**
- ✅ Citations system with [HIV-PREP-001] format
- ✅ Auto-detect Product Knowledge mode
- ✅ **General Assistant mode** (5th dropdown option)
- ✅ Chat history clears on ALL mode switches
- ✅ Enhanced system prompts for all modes

---

### Batch 2: UI/Formatting Improvements (Nov 10, 4:55 PM - 5:33 PM)
```bash
3640a6e  # Fix md() function - process bold/italic/code INSIDE list items
3ef986f  # Fix score pills: all pink, clickable with metric definitions and improvement tips
cbaeb14  # CRITICAL FIXES: Unicode bullets, clickable pills everywhere, 5-metric consistency, Evaluate commands fixed
```

**What these restore:**
- ✅ Markdown rendering inside bullets
- ✅ Clickable EI metric pills with tooltips
- ✅ Unicode bullet standardization (•)
- ✅ 5-metric display consistency
- ✅ "Evaluate" command fixes

---

### Batch 3: LLM Output Quality (Nov 10, 5:22 PM - 7:37 PM)
```bash
e0101ad  # FORMATTING FIX: Handle inline lists, force line breaks, add explicit formatting rules to prompts
b34084d  # FIX: LLM repetition bug - added deduplication, increased FSM caps, anti-repetition prompt
3465632  # UI: Rename 'Sales Simulation' to 'Sales Coach' in mode selector
3d1fc0d  # FIX: Make citations clickable in Sales Coach mode - apply convertCitations() to all sections
3157868  # DEBUG: Add console logging to formatSalesSimulationReply to diagnose why formatting fails
4c2f3dc  # FIX: Make citations clickable + enrich bullet content with contextual phrases (as recommended, as indicated, per label)
0ad7222  # Expand EI metrics from 5 to 10 with advanced scoring
```

**What these restore:**
- ✅ Force line breaks in Sales Coach output
- ✅ LLM deduplication (prevents repetition)
- ✅ "Sales Coach" label (instead of "Sales Simulation")
- ✅ Clickable citations in all sections
- ✅ Citation enrichment with context phrases
- ✅ **10-metric EI system** (Empathy, Discovery, Compliance, Clarity, Accuracy, Engagement, Adaptability, Clinical Depth, Listening, Reframing)
- ✅ Debug logging for formatting issues

---

### Batch 4: Advanced UI Polish (Nov 10, 7:47 PM - 8:32 PM)
```bash
07ef272  # Fix formatting reversion bug and enhance metric pills
f76f8f4  # Implement gradient-coded EI metric pills
c62ed1d  # Add extensive debugging for format reversion bug
2eb8d41  # Fix Role Play HCP formatting + 5x2 pill grid layout
4b00524  # Fix z-index overlay bug: Rep-only Evaluation text leaking into Coach panel
37e0b8c  # Add speaker labels to ALL modes + improve readability
```

**What these restore:**
- ✅ Gradient-coded pills (green 4-5, yellow 3, red 1-2)
- ✅ Format reversion bug fixes
- ✅ Role Play HCP realistic dialogue
- ✅ 5x2 grid layout for metrics
- ✅ Z-index fix (prevents panel overlap)
- ✅ Speaker labels ("You:", "AI Coach:", "HCP:")

---

### Batch 5: Final Enhancements (Nov 11, 1:14 AM)
```bash
cf37c4d  # Add Role Play module card, UI/UX fixes for metrics and feedback panels
```

**What this restores:**
- ✅ Role Play info card/module
- ✅ Final UI/UX polish
- ✅ Metrics panel layout improvements

---

## 🎯 RECOVERY STRATEGY

### Step 1: Create Recovery Branch
```bash
git checkout -b widget-nov10-recovery
```

### Step 2: Cherry-pick in Batches
**Why batches?** Test incrementally to catch any conflicts early.

```bash
# Batch 1: Foundation
git cherry-pick dce5c1e
git cherry-pick 92807dc
git cherry-pick 3f600bd

# Test: Verify General Assistant appears in dropdown

# Batch 2: UI/Formatting
git cherry-pick 3640a6e
git cherry-pick 3ef986f
git cherry-pick cbaeb14

# Test: Check clickable pills and bullets

# Batch 3: LLM Quality
git cherry-pick e0101ad
git cherry-pick b34084d
git cherry-pick 3465632
git cherry-pick 3d1fc0d
git cherry-pick 3157868
git cherry-pick 4c2f3dc
git cherry-pick 0ad7222

# Test: Verify 10 metrics and citations

# Batch 4: Advanced UI
git cherry-pick 07ef272
git cherry-pick f76f8f4
git cherry-pick c62ed1d
git cherry-pick 2eb8d41
git cherry-pick 4b00524
git cherry-pick 37e0b8c

# Test: Check speaker labels and z-index

# Batch 5: Final Polish
git cherry-pick cf37c4d

# Test: Full regression test
```

### Step 3: Resolve Any Conflicts
If conflicts occur:
```bash
# See what's conflicting
git status

# Edit conflicted files manually
# Look for <<<<<<< HEAD markers

# After fixing:
git add <fixed-file>
git cherry-pick --continue
```

### Step 4: Deploy & Test
```bash
# Deploy to GitHub Pages
git checkout main
git merge widget-nov10-recovery
git push origin main

# Wait 2-5 min for GitHub Actions
# Hard refresh browser (Cmd+Shift+R)
# Test all 5 modes
```

---

## 🚨 POTENTIAL CONFLICTS TO WATCH

### widget.js Lines to Monitor
1. **Line ~50** - `LC_OPTIONS` array (General Assistant addition)
2. **Line ~56** - `LC_TO_INTERNAL` mapping (general-knowledge)
3. **Lines ~1815-1891** - `applyModeVisibility()` function (chat reset)
4. **Lines ~1950-2200** - `callModel()` function (system prompts)
5. **Lines ~2500+** - Formatting functions (citations, pills, markdown)

### Common Conflict Scenarios
**Scenario 1:** LC_OPTIONS already modified
- **Resolution:** Keep both changes, ensure General Assistant is included

**Scenario 2:** applyModeVisibility() has different logic
- **Resolution:** Ensure conversation clears for ALL mode switches

**Scenario 3:** Formatting functions conflict
- **Resolution:** Prefer cherry-picked version (has all Nov 10 fixes)

---

## ✅ VALIDATION CHECKLIST

After each batch, verify:

### Batch 1 Validation
- [ ] Dropdown shows "General Assistant" (5th option)
- [ ] Switching modes clears chat history
- [ ] Citations appear in [HIV-PREP-001] format

### Batch 2 Validation
- [ ] Bullets render correctly with markdown inside
- [ ] Clicking pills opens modal with definitions
- [ ] Bullets use consistent • character

### Batch 3 Validation
- [ ] EI panel shows 10 metrics (not 5)
- [ ] Citations are clickable hyperlinks
- [ ] Mode selector says "Sales Coach" (not "Sales Simulation")
- [ ] No LLM repetition in responses

### Batch 4 Validation
- [ ] Pills color-coded (green/yellow/red)
- [ ] Speaker labels appear ("You:", "AI Coach:")
- [ ] No z-index overlay bugs

### Batch 5 Validation
- [ ] Role Play module card visible
- [ ] All panels properly aligned

---

## 🎓 EXPECTED OUTCOME

### Before Recovery (Current State)
```javascript
LC_OPTIONS = [
  "Emotional Intelligence",
  "Product Knowledge",
  "Sales Simulation",
  "Role Play"
];  // 4 modes

// 5 EI metrics
// Basic formatting
// No speaker labels
// No clickable citations
```

### After Recovery (Target State)
```javascript
LC_OPTIONS = [
  "Emotional Intelligence",
  "Product Knowledge",
  "Sales Simulation",  // Shows as "Sales Coach"
  "Role Play",
  "General Assistant"  // ← RESTORED
];  // 5 modes

// 10 EI metrics with gradient pills
// Advanced formatting with line breaks
// Speaker labels ("You:", "AI Coach:", "HCP:")
// Clickable citations
// Citation enrichment
// Z-index fixes
// Module cards
```

---

## 📊 TIME ESTIMATES

| Batch | Commits | Est. Time | Conflict Risk |
|-------|---------|-----------|---------------|
| Batch 1 | 3 | 15 min | LOW |
| Batch 2 | 3 | 15 min | LOW |
| Batch 3 | 7 | 30 min | MEDIUM |
| Batch 4 | 6 | 25 min | MEDIUM |
| Batch 5 | 1 | 10 min | LOW |
| **Testing** | - | 30 min | - |
| **TOTAL** | 20 | **~2 hours** | - |

---

## 🚀 READY TO START?

I'll guide you through each step. Let me know when you want to begin, and I'll:

1. Run the first batch of cherry-picks
2. Check for conflicts
3. Validate the changes
4. Move to the next batch
5. Repeat until complete

**Your call - shall we start with Batch 1?**
