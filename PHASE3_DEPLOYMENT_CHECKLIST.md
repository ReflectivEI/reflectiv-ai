# PHASE 3 HOTFIX DEPLOYMENT CHECKLIST
**Date:** November 14, 2025  
**Commit:** 7c1cbcf  
**Message:** "phase3: hotfix EI metadata, EI final ?, PK fact-code alignment"  
**Status:** Pushed to origin/main | CI Pipeline Running

---

## STEP 1: GIT PRE-CHECK ✅ COMPLETE

```bash
git status --short          # Confirmed: only worker.js modified
git add worker.js           # Staged
git commit -m "..."         # Committed
git push origin main        # Pushed
```

**Result:**
- ✅ Commit 7c1cbcf on main branch
- ✅ origin/main updated
- ✅ Protected files untouched (config.json, tests, CI)

---

## STEP 2: CI EXPECTATIONS

### REQUIRED Jobs (must be green):
- [ ] **lint** — JavaScript syntax/formatting
- [ ] **phase3-edge-cases** — 30 integration tests
- [ ] **deploy** — Cloudflare Worker deployment

**Monitor at:** https://github.com/ReflectivEI/reflectiv-ai/actions

### OPTIONAL Jobs (warnings acceptable):
- phase1
- phase2
- contract-scan

---

## STEP 3: POST-DEPLOY SMOKE CHECKS (Manual, in live widget)

### Test A: Sales-Coach Structure
**Mode:** Sales-Coach  
**Scenario:** Open ReflectivAI widget → Sales-Coach mode

**Prompt:**
```
"We're seeing 30% dropout after the first prescription. 
What HCP barrier exists? What should the rep focus on?"
```

**Expected Output:**
- [ ] 4 sections visible: Challenge, Rep Approach, Impact, Suggested Phrasing
- [ ] Rep Approach contains 3+ bullets (• bullet points)
- [ ] NO `<coach>{...}</coach>` tags visible in reply text
- [ ] Clean, human-readable coaching content
- [ ] Response ends with closing quote or period (not mandatory for SC)

**Pass?** ☐ YES ☐ NO

---

### Test B: Emotional Intelligence — EI-01 (FIX B Verification)
**Mode:** Emotional Intelligence  
**Scenario:** Open ReflectivAI widget → Emotional Intelligence mode

**Prompt:**
```
"I struggled with a difficult patient conversation this week. 
What felt most challenging about it?"
```

**Expected Output:**
- [ ] Response ends with `?` (CRITICAL: EI-01 hotfix verification)
- [ ] 2+ reflective/Socratic questions throughout text
- [ ] 3-4 paragraphs of coaching guidance
- [ ] NO numbered citations (this is EI mode, not PK)
- [ ] NO `<coach>` metadata visible
- [ ] Tone is warm, empathetic, reflective

**Pass?** ☐ YES ☐ NO

**Critical:** If response does NOT end with `?`, FIX B failed → escalate.

---

### Test C: Product Knowledge Citations — PK-01 (FIX C Verification)
**Mode:** Product Knowledge  
**Scenario:** Open ReflectivAI widget → Product Knowledge mode  
**Disease Context:** Cardiovascular / Heart Failure (if selector available)

**Prompt:**
```
"What is the clinical benefit of GDMT in heart failure 
and how does it affect outcomes?"
```

**Expected Output:**
- [ ] Inline numbered citations: `[1]`, `[2]`, `[3]`, etc.
- [ ] At bottom: `**References:**` section header
- [ ] Numbered reference list with titles and URLs
- [ ] Citations correspond to fact IDs from backend (e.g., [CV-GDMT-HFREF-001])
- [ ] Each reference is clickable (has URL) or copy-paste-able
- [ ] NO fact codes like `[CV-GDMT-HFREF-001]` visible in text (should be converted to `[1]`)

**Pass?** ☐ YES ☐ NO

**Critical:** If NO numbered citations or References section, FIX C failed → escalate.

---

## STEP 4: RESULTS SUMMARY

| Test | Status | Notes |
|------|--------|-------|
| Sales-Coach (SC-01/02) | ☐ PASS ☐ FAIL | Check 4 sections + 3 bullets + no metadata |
| EI Final `?` (EI-01) | ☐ PASS ☐ FAIL | **CRITICAL** — must end with ? |
| PK Citations (PK-01) | ☐ PASS ☐ FAIL | Check [1], [2] + References section |

---

## DECISION MATRIX

| Scenario | Action |
|----------|--------|
| All 3 tests PASS | ✅ **HOTFIX LIVE AND VERIFIED** — No further action |
| 1-2 tests FAIL (not EI-01) | 🟡 **INVESTIGATE** — Check logs, may be LLM variability |
| EI-01 FAILS | 🔴 **ESCALATE** — Roll back immediately |
| Deploy job RED | 🔴 **HALT** — Do not proceed to smoke checks |

---

## ROLLBACK PROCEDURE (if needed)

If any REQUIRED job fails or smoke check indicates regression:

```bash
# Revert to previous commit
git revert -n 7c1cbcf
git commit -m "Revert: phase3 hotfix EI metadata, EI final ?, PK fact-code alignment"
git push origin main

# Consult PHASE3_ROLLBACK_RUNBOOK.md for full procedure
```

---

## MONITORING AFTER DEPLOYMENT

Post-deployment, monitor:
- **Logs:** Check Cloudflare Worker logs for errors
- **Response Times:** Ensure post-processing doesn't add latency
- **User Feedback:** EI mode should now show reflective questions ending with `?`

---

**Ready for deployment validation.**
