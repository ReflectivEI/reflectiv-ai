# Sales Coach Truncation Fix - Deployment Analysis

**Date:** 2025-11-13  
**Worker Version (deployed):** r10.1  
**Repository Branch:** DEPLOYMENT_PROMPT.md  
**Commit (latest widget.js fix):** de9a79d

---

## Summary of Findings

### 1. Worker Version Alignment ✅
- **Deployed Cloudflare Worker:** r10.1 (correct, matches repo worker.js header)
- **Model:** `env.PROVIDER_MODEL || "llama-3.1-8b-instant"` (correct)
- **Backend fixes applied:**
  - capSentences fallback corrected (`?? 5` instead of `|| 5`)
  - `<coach>` JSON re-embedded in reply
  - Extraction & normalization working correctly
- **Tail logs confirm:** Worker generates full sections (1285+ chars before capping)

### 2. CORS Configuration ✅
- **CORS_ORIGINS whitelist includes:** `https://reflectivei.github.io`
- **Preflight test result:**
  ```
  access-control-allow-origin: https://reflectivei.github.io
  access-control-allow-credentials: true
  ```
- **Status:** CORS properly configured; no blocking issues.

### 3. MAX_OUTPUT_TOKENS & Rate Limits ✅
- **Worker logic (line 406):**
  ```js
  const cap = Number(env.MAX_OUTPUT_TOKENS || 0);
  const finalMax = cap > 0 ? Math.min(maxTokens, cap) : maxTokens;
  ```
- **Default maxTokens:** 900 (line 405)
- **Impact:** If `MAX_OUTPUT_TOKENS` env var is set in Cloudflare, it constrains provider response length.
- **Recommendation:** Verify `MAX_OUTPUT_TOKENS` is either unset or ≥ 2048 for sales-coach long responses.

### 4. Frontend Discrepancy (Root Cause) ❌ → ✅
- **widget.js local version (repo):**
  - Clamp removal applied at line 3196 (commit de9a79d):
    ```js
    if (currentMode !== "sales-coach") {
      replyText = clampLen(replyText, 1400);
    } else {
      console.log("[Sales Coach] Skip clamp; length=", replyText.length);
    }
    ```
- **GitHub Pages deployed version:**
  - **NOT yet updated** (commit de9a79d not pushed to origin)
  - Live site still serves older widget.js with clamp applied
  - Result: Suggested Phrasing truncated at ~1400–2500 chars with ellipsis appended

### 5. Deployment Status
- **Git status:** Modified widget.js (M flag) + 18 other modified files
- **Latest commit on branch:** de9a79d (HEAD → DEPLOYMENT_PROMPT.md, origin/DEPLOYMENT_PROMPT.md)
- **GitHub Pages source:** main branch (or specified branch in repo settings)
- **Issue:** Changes committed locally but not merged/pushed to deployment branch triggering Pages rebuild

---

## Action Items

### A. Immediate Fix (Deploy Frontend)
1. **Commit current widget.js changes:**
   ```bash
   git add widget.js
   git commit -m "fix(sales-coach): remove clamp for Suggested Phrasing to prevent UI truncation"
   ```
2. **Push to origin:**
   ```bash
   git push origin DEPLOYMENT_PROMPT.md
   ```
3. **Merge to main (if Pages deploys from main):**
   ```bash
   git checkout main
   git merge DEPLOYMENT_PROMPT.md
   git push origin main
   ```
4. **Verify GitHub Pages rebuild:** Check Actions tab for deployment workflow completion.

### B. Verify Backend Environment
1. **Check Cloudflare Worker env vars:**
   ```bash
   npx wrangler secret list --name my-chat-agent-v2
   ```
2. **Confirm MAX_OUTPUT_TOKENS:**
   - If set, ensure ≥ 2048
   - If unset, default 900 may be insufficient for long phrasing
   - Recommended: Set to 4096 for sales-coach

### C. Post-Deploy Validation
1. **Hard refresh:** `https://reflectivei.github.io/reflectiv-ai/` (Cmd+Shift+R)
2. **Multi-turn test:** Enter 3+ sales-coach turns; verify Suggested Phrasing:
   - No ellipsis
   - Full section (500+ chars typical)
   - Console log: `[Sales Coach] Skip clamp; length= ...`
3. **Cross-browser:** Test Safari, Chrome, Firefox

### D. Monitoring
1. **Live test watcher:** Already running locally (`watch_sales_coach_tests.sh`)
2. **Parser simulation:** Run `node parser_simulation.js` after deploy
3. **Expected metrics:**
   - SuggestedLen > 500
   - CoachTag: yes
   - TruncationSuspect: no

---

## Technical Details

### clampLen Function (widget.js:413)
```js
function clampLen(s, max) {
  if (!s || s.length <= max) return s;
  let cut = s.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  if (lastSpace > max * 0.8) cut = cut.slice(0, lastSpace);
  return cut.trim() + "...";
}
```
**Issue:** Appends ellipsis at word boundary near max length.

### formatSalesCoachReply Parser (widget.js:722)
```js
function formatSalesCoachReply(text) {
  // Regex-based section extraction
  // Suggested Phrasing: /Suggested Phrasing[\s\S]*?(?=\n[A-Z][A-Z \-/]{3,}\n|$)/i
  // ...
}
```
**Status:** Parser correct; truncation occurred **before** parsing due to clamp.

### Worker Extraction (worker.js:1200–1320)
- `extractCoach()` separates `<coach>{...}</coach>` from reply
- `deterministicScore()` calculates EI metrics
- Final response re-embeds coach JSON: `reply + "\n\n" + coachTag`

---

## Evidence

### Backend Logs (tail_logs.txt excerpt)
```json
{
  "message": ["[SALES-COACH DEBUG] Before capSentences - length:", 1285, "cap:", 5],
  "level": "log",
  "timestamp": 1763025695539
}
```
**Interpretation:** Worker generates full 1285-char reply; clamp not applied backend.

### Frontend Logs (expected after deploy)
```
[Sales Coach] Skip clamp; length= 1285
```
**Interpretation:** Clamp bypassed; full section rendered.

### Live Test Summary (LIVE_SALES_COACH_TEST_SUMMARY.md)
| Timestamp | Status | SuggestedLen | CoachTag | TruncationSuspect |
|-----------|--------|--------------|----------|-------------------|
| 2025-11-13T09:58:53Z | error | 28 | no | yes |

**Interpretation:** Test script hitting old deployed version; after push, expect SuggestedLen > 500.

---

## Recommendations

1. **Immediate:** Push widget.js to trigger GitHub Pages rebuild.
2. **Short-term:** Add frontend unit test asserting sales-coach replies not clamped.
3. **Long-term:** Implement CI/CD check preventing clamp reintroduction (linter rule or test assertion).
4. **Environment:** Review MAX_OUTPUT_TOKENS in Cloudflare dashboard; increase if constrained.

---

## Deployment Checklist

- [ ] Commit widget.js changes
- [ ] Push to origin DEPLOYMENT_PROMPT.md
- [ ] Merge to main (if Pages source is main)
- [ ] Monitor GitHub Actions for Pages deployment
- [ ] Hard refresh https://reflectivei.github.io/reflectiv-ai/
- [ ] Multi-turn sales-coach validation (3+ turns)
- [ ] Verify console log shows skip clamp message
- [ ] Confirm Suggested Phrasing > 500 chars, no ellipsis
- [ ] Update live test summary (expect CoachTag=yes, TruncationSuspect=no)
- [ ] Document final verification screenshots

---

**Next Steps:** Execute deployment checklist A–D above. User will observe full Suggested Phrasing after GitHub Pages rebuild completes (~2–5 min post-push).
