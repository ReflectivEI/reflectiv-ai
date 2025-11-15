# PHASE 3 ROLLBACK RUNBOOK

**Purpose:** Fast, safe rollback of PHASE 3 format enforcement deployment if critical issues detected.  
**Estimated Time:** 10–15 minutes (commit + push + deploy + verify)  
**Scope:** Rollback worker.js, widget.js, tests/phase3_edge_cases.js, .github/workflows/reflectivai-ci.yml only.  
**Protection:** Config files (config.json, persona.json) remain untouched.

---

## Hard NO-GO Conditions (ROLLBACK IMMEDIATELY)

| Condition | Signal | Action |
|-----------|--------|--------|
| **Repeated Contract Failure** | >50 SC_NO_SECTION_SEPARATION in 1 hour | ROLLBACK |
| **Mode Structure Collapse** | RP mode returns Challenge/Rep Approach headers | ROLLBACK |
| **Citation System Broken** | 100% of PK requests missing citations | ROLLBACK |
| **HCP Voice Lost** | >30% RP requests use third-person or "you" | ROLLBACK |
| **Worker Unstable** | >20% request rate = 500+ errors post-deploy | ROLLBACK |
| **Rate-Limit Cascade** | >50 429s/hour sustained (throttle misconfigured) | ROLLBACK or adjust throttle |
| **Socratic Questions Gone** | >50% EI requests end with period | ROLLBACK |

---

## Rollback Checklist (10–15 Minutes)

### STEP 1: Confirm Rollback Decision

```bash
# Verify you have observed at least 2 NO-GO conditions above.
# Consult with team lead or on-call engineer.
# Confirm you have access to git and Cloudflare dashboard.

□ At least 2 NO-GO conditions present
□ Team approval received
□ Ready to revert PHASE 3 changes only
```

---

### STEP 2: Identify Last Known-Good Commit

```bash
cd /Users/anthonyabdelmalak/Desktop/reflectiv-ai

# Show current branch and status
git status

# Show last 10 commits to find LAST_KNOWN_GOOD_COMMIT
# Look for the commit BEFORE the "Phase 3 format enforcement" commit
git log --oneline -10

# Example output:
#   ff26860 Phase 3 format enforcement + CI hardening  ← THIS IS THE PHASE 3 COMMIT
#   5ee72b4 Fix: Complete EI Mode Wiring (previous commit)
#   ...
# LAST_KNOWN_GOOD_COMMIT = 5ee72b4

echo "LAST_KNOWN_GOOD_COMMIT: <identify and note the hash above>"
```

**Pause here.** Visually confirm the commit before the PHASE 3 deployment.

---

### STEP 3: Create Rollback Commit

```bash
# Option A: Use git revert (creates a new commit that undoes PHASE 3)
# SAFER: creates a clear history, easy to audit

git revert ff26860 --no-edit
# This will revert the PHASE 3 commit and create a new commit

# OR Option B: Use git reset (moves HEAD back to LAST_KNOWN_GOOD_COMMIT)
# FASTER: but requires careful handling and force push
# ONLY IF APPROVED BY TEAM LEAD

# git reset --hard LAST_KNOWN_GOOD_COMMIT
# git commit -m "ROLLBACK: Revert PHASE 3 deployment due to <reason>"

# Verify the revert worked
git diff HEAD~1 worker.js | head -50
# Should show removal of PHASE 3 detection/repair code (lines starting with "^-")

echo "Rollback commit created. Verify above diff shows removal of PHASE 3 rules."
```

**Pause here.** Confirm the diff shows PHASE 3 code being removed.

---

### STEP 4: Push Rollback to Main

```bash
# Show what will be pushed
git log --oneline -3

# Push to main
git push origin main

# Monitor the push
echo "Rollback commit pushed. Watch GitHub Actions pipeline next."
```

**Pause here.** Do NOT proceed until push completes successfully.

---

### STEP 5: Verify Worker Stability Post-Rollback

```bash
# Open GitHub Actions
echo "→ Monitor at: https://github.com/ReflectivEI/reflectiv-ai/actions"
echo ""
echo "Wait for CI pipeline to complete (5-10 min):"
echo "  ✓ lint: should be GREEN"
echo "  ✓ deploy: should be GREEN (phase3 job skipped, expected)"
echo ""
echo "Confirm in logs:"
echo "  ✓ No 'Phase 3' tests running (they were reverted)"
echo "  ✓ Health check: PASS"
echo ""

# Check Cloudflare logs for stability post-rollback
echo "→ Monitor Cloudflare at: https://dash.cloudflare.com → Workers → reflectiv-chat → Logs"
echo ""
echo "Check metrics (should normalize within 5–10 min):"
echo "  • 429 rate: drop back to <5/hour (from >50/hour if that was the issue)"
echo "  • 5xx errors: drop back to <1% (if that was the issue)"
echo "  • Latency: normalize to 2–5s median"
echo ""
```

**Manual Verification Needed:**
- [ ] GitHub Actions: lint GREEN, deploy GREEN
- [ ] Cloudflare logs: 429 rate normalized
- [ ] Cloudflare logs: 5xx error rate normalized
- [ ] Cloudflare logs: latency back to normal

---

### STEP 6: Incident Post-Mortem + Root Cause

```bash
# Document the rollback for the team

echo "ROLLBACK COMPLETE. Document findings:"
echo ""
echo "1. WHICH NO-GO CONDITIONS TRIGGERED?"
echo "   - Condition: ___________"
echo "   - Signal observed: ___________"
echo ""
echo "2. WHAT PHASE 3 RULE FAILED?"
echo "   - Rule: SC-01, SC-02, RP-01, EI-01, PK-01, GK-01, or other?"
echo ""
echo "3. ROOT CAUSE HYPOTHESIS:"
echo "   - LLM prompt issue?"
echo "   - Detection rule too strict?"
echo "   - Rate-limit misconfiguration?"
echo "   - Traffic pattern unexpected?"
echo ""
echo "4. NEXT STEPS:"
echo "   - Open GitHub issue with findings"
echo "   - DO NOT re-deploy PHASE 3 until root cause fixed"
echo "   - Schedule post-mortem with team"
echo ""

# Example command to capture logs for analysis
echo "To capture error logs for analysis:"
echo "  curl 'https://api.cloudflare.com/client/v4/accounts/<ACCOUNT_ID>/logpush/jobs/<JOB_ID>/logs' \\"
echo "    -H 'Authorization: Bearer <TOKEN>' > /tmp/cf_logs_<TIMESTAMP>.json"
```

**Do NOT re-deploy PHASE 3** until root cause is identified and fixed.

---

## GO / NO-GO Sign-Off Template

**Fill in after post-deploy validation or before emergency rollback:**

```
╔════════════════════════════════════════════════════════════════╗
║           PHASE 3 DEPLOYMENT GO / NO-GO SIGN-OFF               ║
║              ReflectivAI Worker (Nov 14, 2025)                 ║
╚════════════════════════════════════════════════════════════════╝

CI STATUS:
  □ All 6 GitHub Actions jobs: GREEN ✓
  □ phase3-edge-cases: 30/30 tests passed
  □ Deploy job: Published + Health check PASS

SMOKE TESTS (6/6):
  □ Sales-Coach Normal:          PASS / FAIL / SKIP
  □ Sales-Coach Repair:          PASS / FAIL / SKIP
  □ Role-Play:                   PASS / FAIL / SKIP
  □ Emotional Intelligence:      PASS / FAIL / SKIP
  □ Product Knowledge:           PASS / FAIL / SKIP
  □ General Knowledge:           PASS / FAIL / SKIP
  
  Overall: __/6 PASS

ERROR CLUSTERS DETECTED?
  □ SC_NO_SECTION_SEPARATION:    0 / <5 / ≥50 per 1000 requests
  □ RP_THIRD_PERSON_NARRATOR:    0 / <5 / ≥30% of requests
  □ EI_NO_SOCRATIC_QUESTIONS:    0 / <5 / ≥50% of requests
  □ PK_MISSING_CITATIONS:        0 / <5 / ≥100% of requests
  □ GK_STRUCTURE_LEAKAGE:        0 / <5 / detected

5XX ERROR RATE (first 2 hours):
  Current: __%
  Threshold: <1%
  Status: PASS / FAIL

429 RATE (first 2 hours):
  Current: __/hour
  Threshold: <10/hour
  Status: PASS / FAIL

DECISION: ✅ GO / ❌ NO-GO / ⚠️ CONDITIONAL GO

IF NO-GO, ROLLBACK TRIGGERED:
  Reason: ___________________________________________________________________
  Rollback committed by: ___________________    Time: ___________________

IF CONDITIONAL GO, CONDITIONS:
  ___________________________________________________________________

SIGNED OFF BY:
  Name: _________________________________    Date: _________________
  Role: (SRE / DevOps / QA Lead)            Timestamp: ______________

═══════════════════════════════════════════════════════════════════
```

---

## Quick Reference: Rollback Decision Tree

```
Is any NO-GO condition present?
├─ YES → Escalate to on-call lead
│       └─ Proceed with STEP 1 (Confirm Rollback Decision)
│
└─ NO  → Continue monitoring
         └─ All GO criteria met? → SIGN-OFF (GO)
```

---

## Contact & Escalation

- **On-Call SRE:** [INSERT CONTACT]
- **DevOps Lead:** [INSERT CONTACT]
- **Incident Channel:** [INSERT SLACK/EMAIL]

For questions during rollback, contact the on-call SRE immediately.

---

**Last Updated:** Nov 14, 2025  
**Next Review:** Nov 21, 2025 (post-7-day stability window)
