# Quick Verification Guide - Sales Coach & Role Play Fixes

## What Was Fixed

1. **Sales Coach Mode** - Now handles `"sales-simulation"` mode name correctly
2. **Role Play Mode** - Prevents drift to coaching language with aggressive validation

## How to Verify After Deployment

### Verification 1: Sales Coach Mode Works

**Test the problematic scenario from the issue**:

```bash
# Use the exact scenario that was failing
curl -X POST https://your-worker.workers.dev/chat \
  -H "Content-Type: application/json" \
  -H "Origin: https://reflectivei.github.io" \
  -d '{
    "mode": "sales-simulation",
    "messages": [
      {"role": "user", "content": "HOW DO I APPROACH AN HCP WITH THIS PROFILE?"}
    ],
    "disease": "hiv",
    "persona": "Busy Primary Care Physician"
  }'
```

**Expected Response Format** (should now work):
```
Challenge: [One sentence about HCP barrier]

Rep Approach:
• [Clinical point with [HIV-PREP-XXX] reference]
• [Supporting strategy with [HIV-PREP-XXX] reference]  
• [Safety consideration with [HIV-PREP-XXX] reference]

Impact: [Expected outcome connecting to Challenge]

Suggested Phrasing: "[Exact words rep should say]"
```

**Success Criteria**: ✅
- All 4 sections present
- No format error
- Contains `<coach>` JSON with scores

**Failure Indicators**: ❌
- Error: "Missing Challenge section"
- Error: "Missing Rep Approach section"
- Error: "Response violated contract"

---

### Verification 2: Role Play Stays in HCP Voice

**Test that role play doesn't drift to coaching**:

```bash
curl -X POST https://your-worker.workers.dev/chat \
  -H "Content-Type: application/json" \
  -H "Origin: https://reflectivei.github.io" \
  -d '{
    "mode": "role-play",
    "messages": [
      {"role": "user", "content": "Do you prescribe PrEP to your patients?"}
    ],
    "disease": "hiv",
    "persona": "Internal Medicine MD"
  }'
```

**Expected Response** (HCP voice only):
```
Yes, I prescribe PrEP when appropriate. I assess patients for substantial risk 
factors including sexual behaviors, partner HIV status, and recent STI diagnoses. 
For eligible patients, I discuss both daily oral options and long-acting injectables.
```

**Success Criteria**: ✅
- First-person HCP voice ("I assess", "We evaluate", "My practice")
- NO coaching language ("Challenge:", "Rep Approach:", etc.)
- NO meta-analysis ("The rep should", "Your approach")
- NO scoring/JSON blocks
- Natural clinical dialogue

**Failure Indicators**: ❌
- Contains "Challenge:" or "Rep Approach:"
- Contains "Sales Coach" anywhere
- Contains "The rep should" or "Your approach"
- Contains `<coach>` blocks
- Switches from HCP voice to coaching

---

### Verification 3: Check Logs for Violations

**Monitor validation logs**:

```bash
# If using Cloudflare wrangler
wrangler tail

# Look for these log events:
```

**Good Logs** (expected after fixes):
```json
{
  "event": "validation_check",
  "mode": "role-play",
  "warnings": ["hcp_first_person_detected_ok"],
  "violations": []
}
```

**Bad Logs** (should not see these):
```json
{
  "event": "validation_check", 
  "mode": "role-play",
  "violations": [
    "coaching_leak_detected: /Challenge:/i",
    "coaching_leak_detected: /Rep Approach:/i"
  ]
}
```

---

## Quick Troubleshooting

### If Sales Coach Still Shows Format Error:

1. **Check mode normalization deployed**:
   ```bash
   # In deployed worker.js, should see:
   grep "if (mode === \"sales-simulation\")" worker.js
   grep "mode = \"sales-coach\"" worker.js
   ```

2. **Verify FSM has both entries**:
   ```bash
   grep -A2 "\"sales-simulation\":" worker.js
   ```

3. **Check request payload**:
   - Ensure `mode: "sales-simulation"` is being sent
   - Verify disease and persona are included

### If Role Play Still Drifts to Coaching:

1. **Check aggressive validation deployed**:
   ```bash
   grep -A5 "coachingPatterns" worker.js
   grep -A5 "metaPatterns" worker.js
   ```

2. **Verify enhanced prompt deployed**:
   ```bash
   grep "CRITICAL ROLE: YOU ARE THE HCP" worker.js
   grep "FINAL CHECKPOINT" worker.js
   ```

3. **Check validation logs**:
   - Should show violations if drift occurs
   - Violations should be cleaned from response

---

## Success Metrics

After deployment, these metrics should improve:

| Metric | Before | After (Target) |
|--------|--------|----------------|
| Sales Coach format errors | High | ~0% |
| Role Play coaching leaks | Medium | ~0% |
| Validation violations (logged) | High | Low (cleaned) |
| Mode normalization hits | 0 | 100% of sales-simulation requests |

---

## Rollback Instructions

If issues occur:

```bash
# Revert to previous version
git revert 845392d 8ad461f
git push origin copilot/debug-sales-coach-mode

# Or just disable mode normalization
# Comment out in worker.js:
# if (mode === "sales-simulation") {
#   mode = "sales-coach";
# }
```

---

## Contact

For issues or questions about these fixes, reference:
- PR: `copilot/debug-sales-coach-mode`
- Documentation: `SALES_COACH_ROLEPLAY_FIX_DOCS.md`
- Commits: `845392d`, `8ad461f`
