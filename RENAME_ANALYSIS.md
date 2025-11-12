# RENAME ANALYSIS: "Sales Simulation" → "Sales Coach"

**Task**: Change all instances of "Sales Simulation" to "Sales Coach"
**Difficulty**: EASY - Simple find/replace operation
**Estimated Time**: 5 minutes
**Risk**: LOW - Only affects labels/UI text, not logic

---

## OCCURRENCES FOUND

### Total Count
- **87 occurrences** across HTML, JS, MD files
- Includes both `"Sales Simulation"` (display label) and `"sales-simulation"` (internal mode ID)

### Key Files Affected

#### 1. widget.js (Primary UI file)
```
Line 14: Comment about HCP-voice leakage in Sales Simulation
Line 53: LC_OPTIONS array: "Sales Simulation"
Line 57: LC_TO_INTERNAL mapping: "Sales Simulation": "sales-simulation"
Line 74: currentMode default: "sales-simulation"
Line 465: Mode check: if (mode === "sales-simulation")
Line 695: Function comment: formatSalesSimulationReply
Line 1297: Mode check: if (mode === "sales-simulation")
Line 1475-1476: Default mode label: "Sales Simulation"
Line 1721: Mode check: currentMode === "sales-simulation"
Line 1740: Comment: "Sales Simulation = Sales Coach/Rep"
Line 1747: Mode check: currentMode === "sales-simulation"
Line 1756-1757: Mode check and comment
Line 1807-1808: Yellow panel spec comment
Line 1959: Mode check: currentMode === "sales-simulation"
Line 2037: Mode check: currentMode === "sales-simulation"
Line 2805: Mode check: currentMode === "sales-simulation"
```

#### 2. worker.js (Backend API)
- Comments referencing sales-simulation mode
- Mode validation checks
- FSM state machine definitions

#### 3. Documentation Files
- COMPREHENSIVE_TEST_RESULTS.md
- BROWSER_TEST_OBSERVATIONS.md
- Various audit/architecture docs

#### 4. HTML Files
- index.html (likely in mode selector dropdown)
- Test files

---

## RENAME STRATEGY

### DECISION: Keep internal ID, change display labels

**Internal ID**: Keep `"sales-simulation"` (no change)
- Used in mode routing logic
- Used in API calls
- Used in FSM state machines
- Changing would require worker.js redeployment

**Display Labels**: Change to `"Sales Coach"`
- User-facing text in UI
- Dropdown options
- Comments
- Documentation

### Why This Approach?
1. **Minimal risk**: Only UI text changes
2. **No backend changes**: worker.js stays same
3. **No API changes**: mode parameter stays "sales-simulation"
4. **Clean separation**: Internal vs external naming

---

## FILES TO MODIFY

### Critical UI Files (MUST CHANGE)
1. **widget.js**:
   - Line 53: `"Sales Simulation"` → `"Sales Coach"`
   - Line 57: `"Sales Simulation": "sales-simulation"` → `"Sales Coach": "sales-simulation"`
   - Line 1476: `"Sales Simulation"` → `"Sales Coach"`

2. **index.html** (if mode selector is there):
   - Any dropdown option text

### Optional Comment/Doc Updates (NICE TO HAVE)
1. **widget.js comments**:
   - Line 14: "HCP-voice leakage in Sales Simulation" → "Sales Coach"
   - Line 695: "formatSalesSimulationReply" comment → "formatSalesCoachReply" (optional)
   - Line 1740: "Sales Simulation = Sales Coach/Rep" → "Sales Coach = Coach/Rep"

2. **Documentation**:
   - Update all MD files for consistency
   - Not critical for functionality

### Optional Function Rename (LOW PRIORITY)
- `formatSalesSimulationReply()` → `formatSalesCoachReply()`
- Would require updating all calls
- Not necessary unless refactoring

---

## IMPLEMENTATION STEPS

### Minimal Change (5 minutes)
```bash
# 1. Update display labels in widget.js
sed -i '' 's/"Sales Simulation"/"Sales Coach"/g' widget.js

# 2. Verify changes
grep -n "Sales Coach" widget.js

# 3. Test in browser
# - Open mode dropdown
# - Verify "Sales Coach" appears
# - Test mode still works (internal ID unchanged)

# 4. Deploy
git add widget.js
git commit -m "UI: Rename 'Sales Simulation' to 'Sales Coach'"
git push origin main
```

### Full Update (15 minutes - includes docs)
```bash
# 1. Update all display labels
find . -type f \( -name "*.js" -o -name "*.html" -o -name "*.md" \) \
  -exec sed -i '' 's/Sales Simulation/Sales Coach/g' {} +

# 2. Update comments about the mode
find . -type f -name "*.js" \
  -exec sed -i '' 's/sales-simulation mode/sales-coach mode/g' {} +

# 3. Keep internal IDs unchanged (verify grep)
grep -r '"sales-simulation"' . --include="*.js" --include="*.toml"

# 4. Deploy
git add -A
git commit -m "UI: Rebrand 'Sales Simulation' mode to 'Sales Coach'"
git push origin main
```

---

## TESTING CHECKLIST

After rename, verify:
- [ ] Mode dropdown shows "Sales Coach" (not "Sales Simulation")
- [ ] Selecting "Sales Coach" activates sales-simulation mode
- [ ] Sales Coach responses still use 4-section format
- [ ] Speaker label shows "Sales Coach" (not "Sales Coach")
- [ ] Pills/metrics still work
- [ ] No console errors
- [ ] Backend API accepts mode="sales-simulation" (unchanged)

---

## RISKS & MITIGATION

### Risk 1: Cached Labels
- **Issue**: Users may see old "Sales Simulation" text
- **Mitigation**: Hard refresh (Cmd+Shift+R)

### Risk 2: Function Name Confusion
- **Issue**: `formatSalesSimulationReply()` name doesn't match
- **Mitigation**: Add comment explaining historical name

### Risk 3: Documentation Out of Sync
- **Issue**: Docs still reference "Sales Simulation"
- **Mitigation**: Update all MD files in same commit

---

## RECOMMENDATION

**Approach**: Minimal Change (UI labels only)
**Rationale**:
- Lowest risk
- Fastest implementation
- No backend changes needed
- Can be done right now

**Code Changes Required**:
```javascript
// widget.js line 53
const LC_OPTIONS = [
  "Emotional Intelligence",
  "Product Knowledge",
  "Sales Coach",  // WAS: "Sales Simulation"
  "Role Play",
  "General Assistant"
];

// widget.js line 57
const LC_TO_INTERNAL = {
  "Emotional Intelligence": "emotional-assessment",
  "Product Knowledge": "product-knowledge",
  "Sales Coach": "sales-simulation",  // WAS: "Sales Simulation"
  "Role Play": "role-play",
  "General Assistant": "general-knowledge"
};

// widget.js line 1476
Object.keys(LC_TO_INTERNAL).find((k) => LC_TO_INTERNAL[k] === (cfg?.defaultMode || "sales-simulation")) ||
"Sales Coach";  // WAS: "Sales Simulation"
```

**Total Changes**: 3 lines in widget.js
**Deployment Time**: Immediate (GitHub Pages rebuild)
**Testing Required**: 5 minutes (verify dropdown + mode functionality)

---

## CONCLUSION

**Difficulty Rating**: ⭐ (1/5 - Very Easy)
**Time Estimate**: 5 minutes for minimal change, 15 minutes for full update
**Recommendation**: DO IT - Simple, low-risk, high-impact UX improvement

The name "Sales Coach" is more accurate since the mode provides coaching (Challenge/Rep Approach/Impact/Suggested Phrasing), not simulation.
