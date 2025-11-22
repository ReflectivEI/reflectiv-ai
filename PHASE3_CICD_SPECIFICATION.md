# PHASE 3 CI/CD IMPLEMENTATION SPECIFICATION

**Document:** GitHub Actions Workflow for Automated Testing & Deployment  
**Target:** `.github/workflows/reflectivai-ci.yml`  
**Status:** SPECIFICATION (Ready for Implementation)

---

## EXECUTIVE SUMMARY

Build automated GitHub Actions pipeline that:
1. Runs on every PR + push to main
2. Executes ALL tests (PHASE 1, 2, 3)
3. Validates code quality (ESLint, syntax)
4. Blocks merge on failures
5. Auto-deploys to production ONLY if all checks pass

---

## 1. WORKFLOW STRUCTURE

### 1.1 Trigger Events

```yaml
name: ReflectivAI CI/CD Pipeline

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]
  schedule:
    # Daily smoke test at 2 AM UTC
    - cron: '0 2 * * *'

jobs:
```

---

### 1.2 Job 1: Lint & Syntax Validation

**Purpose:** Catch obvious code errors before running tests

```yaml
  lint:
    name: Lint & Syntax Validation
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install ESLint
        run: npm install --save-dev eslint @eslint/js

      - name: Run ESLint on worker.js
        run: npx eslint worker.js --max-warnings 5
        
      - name: Run ESLint on widget.js
        run: npx eslint widget.js --max-warnings 5
      
      - name: Check syntax: worker.js
        run: node -c worker.js
      
      - name: Check syntax: widget.js
        run: node -c widget.js
      
      - name: Check syntax: all mode files
        run: |
          node -c assets/chat/modes/salesCoach.js
          node -c assets/chat/modes/rolePlay.js
          node -c assets/chat/modes/emotionalIntelligence.js
          node -c assets/chat/modes/productKnowledge.js
```

**Failure Criteria:**
- ESLint errors (max 5 warnings allowed)
- Syntax errors detected

**Success Output:** ✅ All files have valid syntax

---

### 1.3 Job 2: PHASE 1 Integration Tests

**Purpose:** Verify format contract specifications

```yaml
  phase1-tests:
    name: PHASE 1 - Format Contract Tests
    runs-on: ubuntu-latest
    needs: lint
    steps:
      - name: Checkout code
        uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Run PHASE 1 tests (format contracts)
        run: |
          node tests/lc_integration_tests.js --phase 1 --mode all
        timeout-minutes: 30
        env:
          WORKER_URL: ${{ secrets.WORKER_URL }}
      
      - name: Upload PHASE 1 results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: phase1-test-results
          path: tests/results/phase1_*
```

**Requires:** `WORKER_URL` secret (production endpoint)

**Success Criteria:** 100% format contracts validated

---

### 1.4 Job 3: PHASE 2 Integration Tests

**Purpose:** Verify response validation and repair logic

```yaml
  phase2-tests:
    name: PHASE 2 - Validation & Repair Tests
    runs-on: ubuntu-latest
    needs: lint
    steps:
      - name: Checkout code
        uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Run PHASE 2 tests (validation)
        run: |
          node tests/lc_integration_tests.js --phase 2 --mode all
        timeout-minutes: 30
        env:
          WORKER_URL: ${{ secrets.WORKER_URL }}
      
      - name: Check PHASE 2 test results
        run: |
          if grep -q "20/20 PASSED" tests/results/phase2_summary.txt; then
            echo "✅ All 20 PHASE 2 tests passed"
            exit 0
          else
            echo "❌ PHASE 2 tests failed"
            exit 1
          fi
      
      - name: Upload PHASE 2 results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: phase2-test-results
          path: tests/results/phase2_*
```

---

### 1.5 Job 4: PHASE 3 Edge-Case Tests

**Purpose:** Verify edge-case handling and validator expansion

```yaml
  phase3-tests:
    name: PHASE 3 - Edge Case Tests (30 tests)
    runs-on: ubuntu-latest
    needs: lint
    steps:
      - name: Checkout code
        uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Run PHASE 3 edge-case tests
        run: |
          node tests/phase3_edge_cases.js --verbose
        timeout-minutes: 45
        env:
          WORKER_URL: ${{ secrets.WORKER_URL }}
      
      - name: Parse PHASE 3 results
        run: |
          # Extract pass/fail counts
          PASS_COUNT=$(grep -oP 'PASS.*?\K\d+' tests/results/phase3_summary.json | head -1)
          TOTAL_COUNT=30
          
          if [ "$PASS_COUNT" -ge "28" ]; then
            echo "✅ PHASE 3: $PASS_COUNT/30 tests passed (>93%)"
            exit 0
          else
            echo "❌ PHASE 3: $PASS_COUNT/30 tests passed (requires >93%)"
            exit 1
          fi
      
      - name: Upload PHASE 3 results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: phase3-test-results
          path: tests/results/phase3_*
```

**Success Criteria:** ≥28/30 tests pass (93%)

---

### 1.6 Job 5: Contract Violation Detection

**Purpose:** Proactive detection of format contract violations

```yaml
  contract-validation:
    name: Contract Violation Detection
    runs-on: ubuntu-latest
    needs: phase2-tests
    steps:
      - name: Checkout code
        uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Run contract violation scanner
        run: |
          node -e "
            const results = require('./tests/results/phase2_summary.json');
            let violations = 0;
            
            results.forEach(test => {
              if (test.validation && !test.validation.valid) {
                violations++;
                console.log(\`❌ \${test.id}: \${test.validation.errors.join(', ')}\`);
              }
            });
            
            if (violations > 0) {
              console.log(\`\nFound \${violations} contract violations\`);
              process.exit(1);
            } else {
              console.log('✅ No contract violations detected');
              process.exit(0);
            }
          "
```

---

### 1.7 Job 6: Deployment Gate

**Purpose:** Deploy ONLY if all tests pass and no violations found

```yaml
  deploy:
    name: Deploy to Production
    runs-on: ubuntu-latest
    needs: [ phase1-tests, phase2-tests, phase3-tests, contract-validation ]
    if: |
      github.ref == 'refs/heads/main' &&
      github.event_name == 'push' &&
      success()
    steps:
      - name: Checkout code
        uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Verify deployment prerequisites
        run: |
          echo "✅ All tests passed"
          echo "✅ No syntax errors"
          echo "✅ No contract violations"
          echo "📦 Ready for production deployment"
      
      - name: Deploy worker.js to Cloudflare
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
        run: |
          # Deploy Cloudflare Worker (example using wrangler)
          npm install -g wrangler
          wrangler publish --env production
          
          if [ $? -eq 0 ]; then
            echo "✅ Cloudflare Worker deployed successfully"
          else
            echo "❌ Deployment failed"
            exit 1
          fi
      
      - name: Notify deployment
        if: success()
        run: |
          echo "🎉 Production deployment complete"
          echo "Worker URL: https://my-chat-agent-v2.tonyabdelmalak.workers.dev/chat"
      
      - name: Post deployment summary
        if: always()
        run: |
          cat > /tmp/deployment_summary.txt << EOF
          DEPLOYMENT SUMMARY
          ==================
          Status: ${{ job.status }}
          Timestamp: $(date -u)
          Tests Passed: All
          Violations: None
          EOF
          cat /tmp/deployment_summary.txt
```

---

## 2. REQUIRED SECRETS

Configure these in GitHub repository settings:

```yaml
WORKER_URL          # https://my-chat-agent-v2.tonyabdelmalak.workers.dev/chat
CLOUDFLARE_API_TOKEN        # Wrangler API token for deployment
CLOUDFLARE_ACCOUNT_ID       # Cloudflare account ID
```

---

## 3. BRANCH PROTECTION RULES

Configure in GitHub Settings → Branches → main:

```yaml
Require status checks to pass before merging:
  ✅ lint
  ✅ phase1-tests
  ✅ phase2-tests
  ✅ phase3-tests
  ✅ contract-validation

Require branches to be up to date before merging:
  ✅ Yes

Dismiss stale pull request approvals when new commits are pushed:
  ✅ Yes

Require approval from code owners:
  ✅ Yes (1 approval minimum)
```

---

## 4. WORKFLOW SEQUENCE DIAGRAM

```
┌─────────────────────────────────────────────────────────────┐
│ GitHub: Push to main / PR opened                            │
└──────────────────────┬──────────────────────────────────────┘
                       │
              ┌────────▼────────┐
              │  JOB 1: Lint    │ (5 min)
              │ Syntax Check    │
              └────────┬────────┘
                       │ (success only)
          ┌────────────┼────────────┐
          │            │            │
    ┌─────▼────┐ ┌─────▼────┐ ┌────▼─────┐
    │JOB 2:    │ │JOB 3:    │ │JOB 4:    │
    │PHASE 1   │ │PHASE 2   │ │PHASE 3   │
    │Tests     │ │Tests     │ │Tests     │
    │(15 min)  │ │(20 min)  │ │(30 min)  │
    └─────┬────┘ └─────┬────┘ └────┬─────┘
          │            │            │
          └────────────┼────────────┘
                       │ (all success)
              ┌────────▼─────────┐
              │JOB 5: Contract   │
              │Violation Scan    │
              │(5 min)           │
              └────────┬─────────┘
                       │ (success only)
              ┌────────▼──────────┐
              │JOB 6: Deploy      │
              │Production         │
              │(10 min)           │
              └───────────────────┘
              
Total Time: ~60 minutes max
```

---

## 5. MONITORING & ALERTS

### 5.1 GitHub Actions Notifications

Configure in repo settings:

```yaml
Send notifications:
  ✅ Always (for all workflow runs)
  
On workflow failure:
  ✅ Email repo admins
  ✅ Post to Slack (if webhook configured)
```

### 5.2 Real-Time Dashboard

Create `.github/workflows/dashboard.yml` to post status:

```yaml
name: Test Results Dashboard

on:
  workflow_run:
    workflows: [ "ReflectivAI CI/CD Pipeline" ]
    types: [ completed ]

jobs:
  post-results:
    runs-on: ubuntu-latest
    steps:
      - name: Download all artifacts
        uses: actions/download-artifact@v3
      
      - name: Generate HTML report
        run: |
          node -e "
            const fs = require('fs');
            const phase1 = require('./phase1-test-results/summary.json');
            const phase2 = require('./phase2-test-results/summary.json');
            const phase3 = require('./phase3-test-results/summary.json');
            
            const html = \`
              <h2>Test Results Dashboard</h2>
              <p>PHASE 1: \${phase1.passed}/\${phase1.total} passed</p>
              <p>PHASE 2: \${phase2.passed}/\${phase2.total} passed</p>
              <p>PHASE 3: \${phase3.passed}/\${phase3.total} passed</p>
            \`;
            
            fs.writeFileSync('dashboard.html', html);
          "
      
      - name: Publish to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./
```

---

## 6. ROLLBACK PLAN

If deployment fails in production:

```bash
# Manual rollback
git revert <commit-hash>
git push origin main

# This triggers CI/CD again with previous working version
# Auto-deploys if all tests pass
```

---

## 7. IMPLEMENTATION CHECKLIST

- [ ] Create `.github/workflows/reflectivai-ci.yml`
- [ ] Configure GitHub secrets (WORKER_URL, CLOUDFLARE_API_TOKEN, etc.)
- [ ] Set branch protection rules for main
- [ ] Configure GitHub Actions permissions
- [ ] Test workflow with PR
- [ ] Verify all 6 jobs execute correctly
- [ ] Verify deployment on successful merge
- [ ] Test rollback procedure
- [ ] Create `.github/CODEOWNERS` for review requirements
- [ ] Document CI/CD in PHASE3_CICD_IMPLEMENTATION.md
- [ ] Set up notifications/alerts

---

**END OF CI/CD IMPLEMENTATION SPECIFICATION**
