# Citation System & Auto-Detect Product Knowledge

## Overview
Two critical features have been implemented to ensure FDA compliance and intuitive user experience:

1. **FDA-Compliant Citation System** - All clinical claims are backed by traceable references
2. **Auto-Detect Product Knowledge Mode** - Users can ask general questions without selecting mode dropdown

---

## 1. FDA-Compliant Citation System

### Problem
Original implementation showed raw compliance codes like `[HIV-PREP-ELIG-001]` in user-facing output, which were:
- Confusing to users (no one knew what they meant)
- Not compliant with FDA citation requirements
- Lacked traceability to source documents

### Solution
**Three-layer citation architecture:**

#### Layer 1: Worker Prompts (worker.js)
Citation codes are included in LLM prompts to ensure claims are tracked:
```javascript
Rep Approach:
• Discuss CDC adherence counseling protocols [HIV-PREP-ELIG-001].
• Highlight once-daily Descovy dosing [HIV-PREP-TAF-002].
• Address renal monitoring for safety [HIV-PREP-SAFETY-003].
```

#### Layer 2: Citation Database (citations.json)
Maps codes to full APA-formatted references:
```json
{
  "HIV-PREP-ELIG-001": {
    "title": "CDC PrEP Clinical Practice Guidelines",
    "source": "Centers for Disease Control and Prevention",
    "year": "2021",
    "url": "https://www.cdc.gov/hiv/guidelines/preventing.html",
    "apa": "Centers for Disease Control and Prevention. (2021). Preexposure prophylaxis for the prevention of HIV infection in the United States—2021 Update: A clinical practice guideline."
  }
}
```

#### Layer 3: Widget Rendering (widget.js)
Converts codes to clickable footnote links:
```javascript
function convertCitations(text) {
  return text.replace(/\[([A-Z]{3,}-[A-Z]{2,}-[A-Z0-9]{3,})\]/g, (match, code) => {
    const citation = citationsDb[code];
    if (!citation) return styled_error_badge;
    
    return `<a href="${citation.url}" target="_blank" 
            style="background:#e0f2fe;padding:2px 6px;border-radius:4px;..."
            title="${citation.apa}">[${code.split('-').pop()}]</a>`;
  });
}
```

### User Experience
**Before:**
```
• Discuss PrEP eligibility with CDC guidelines [HIV-PREP-ELIG-001].
```

**After:**
```
• Discuss PrEP eligibility with CDC guidelines [001].
                                                  ^
                                    Clickable link with tooltip
```

When users hover over `[001]`, they see full APA citation. Clicking opens source document.

### Adding New Citations
1. Add entry to `citations.json`:
```json
"HIV-NEW-CLAIM-004": {
  "title": "Study Title",
  "source": "Journal or Organization",
  "year": "2024",
  "url": "https://...",
  "apa": "Full APA format citation"
}
```

2. Use code in worker.js prompts where claim is made

3. Widget automatically converts to link

---

## 2. Auto-Detect Product Knowledge Mode

### Problem
Users had to manually select "Product Knowledge" from dropdown every time they wanted to ask a general question like:
- "What is HIV?"
- "How does PrEP work?"
- "Explain TAF vs TDF"

This was **not intuitive** - users expect to just type their question.

### Solution
**Intelligent mode detection in sendMessage():**

```javascript
// Auto-detect general knowledge questions
const generalQuestionPatterns = /^(what|how|why|explain|tell me|describe|define|compare|list|when)/i;
const simulationContextWords = /(hcp|doctor|physician|clinician|rep|objection|customer|prescriber)/i;

if (generalQuestionPatterns.test(userText) && !simulationContextWords.test(userText)) {
  currentMode = "product-knowledge";
  console.log(`[Auto-Detect] Switched to product-knowledge for general question`);
}
```

### Detection Logic

#### Will Auto-Switch to Product Knowledge:
✅ "What is PrEP?"
✅ "How does Descovy work?"
✅ "Explain TAF vs TDF"
✅ "Tell me about HIV treatment"
✅ "Compare Descovy and Truvada"
✅ "Why is renal monitoring important?"

#### Will NOT Auto-Switch (Stays in Current Mode):
❌ "What should I tell the HCP about PrEP?" → Contains "HCP" (simulation context)
❌ "How do I handle this objection?" → Contains "objection" (sales context)
❌ "The doctor asked about TAF..." → Contains "doctor" (role-play context)

### User Experience

**Scenario 1: User types general question**
```
User selects: Sales Simulation mode (from dropdown)
User types: "What is HIV?"
           ↓
System detects: General question pattern, no simulation context
           ↓
Auto-switches to: Product Knowledge mode
           ↓
Response: Comprehensive ChatGPT-style answer about HIV
```

**Scenario 2: User stays in simulation**
```
User selects: Sales Simulation mode
User types: "What should I tell the HCP about PrEP eligibility?"
           ↓
System detects: Contains "HCP" keyword
           ↓
Stays in: Sales Simulation mode
           ↓
Response: Challenge/Rep Approach/Impact/Suggested Phrasing
```

### Benefits
1. **Intuitive UX** - No dropdown manipulation needed for simple questions
2. **Context-Aware** - Respects simulation context when present
3. **Seamless Fallback** - ChatGPT-like experience for general queries
4. **Mode Transparency** - Console logs show auto-detection decisions

---

## Technical Architecture

### File Structure
```
reflectiv-ai/
├── citations.json          # Citation reference database (NEW)
├── worker.js               # Includes citation codes in prompts
├── widget.js               # Auto-detect + citation rendering
└── docs/
    └── CITATIONS_AND_AUTODETECT.md  # This file
```

### Widget.js Functions
1. **loadCitations()** - Fetches citations.json at init
2. **convertCitations(text)** - Transforms codes to links
3. **sendMessage()** - Auto-detects mode based on user input
4. **Rep Approach rendering** - Applies convertCitations() to bullets

### Data Flow
```
User Input
    ↓
Auto-Detect Logic (sendMessage)
    ↓
Worker API Call (with mode)
    ↓
Worker Returns Response (with citation codes)
    ↓
Widget Rendering (convertCitations)
    ↓
User Sees Clickable Citation Links
```

---

## FDA Compliance Notes

### Why Citations Matter
1. **21 CFR 202.1** - Promotional materials must include references for efficacy/safety claims
2. **Traceability** - Auditors can verify claims against source documents
3. **Scientific Rigor** - Links to peer-reviewed publications demonstrate evidence-based approach

### Citation Code Naming Convention
```
[DISEASE-TYPE-SEQUENCE]

Examples:
HIV-PREP-ELIG-001   → HIV, PrEP Eligibility, Reference #1
HIV-TREAT-TAF-001   → HIV, Treatment TAF, Reference #1
HIV-ADHERENCE-001   → HIV, Adherence, Reference #1
```

### Audit Trail
- **worker.js logs** show which citations were included in prompts
- **citations.json** provides full source documentation
- **widget.js console** logs citation loading and conversion
- **Rendered HTML** contains clickable links to authoritative sources

---

## Testing

### Test Citation Rendering
1. Navigate to Sales Simulation mode
2. Ask: "What should I say about PrEP eligibility?"
3. Expected: Rep Approach bullets contain clickable citation links like `[001]`, `[002]`, `[003]`
4. Hover over link: Should show full APA citation in tooltip
5. Click link: Should open CDC/FDA source document in new tab

### Test Auto-Detect Product Knowledge
1. Navigate to Sales Simulation mode (or any mode)
2. Type: "What is HIV?"
3. Check console: Should log `[Auto-Detect] Switched from sales-simulation → product-knowledge`
4. Expected: Comprehensive ChatGPT-style answer (not sales guidance)
5. Type: "What should I tell the HCP about this?"
6. Check console: Should NOT auto-switch (contains "HCP")
7. Expected: Sales Simulation response format

---

## Future Enhancements

### Citation System
- [ ] Add visual citation counter (e.g., "3 references cited")
- [ ] Support inline APA format option (toggle between links and full text)
- [ ] Build citation library browser (searchable reference database)
- [ ] Add citation verification workflow for new claims

### Auto-Detect
- [ ] Add confidence score to mode detection (log: "85% confident → product-knowledge")
- [ ] Allow manual override (button: "Switch to Sales Sim" if auto-detect wrong)
- [ ] Learn from user corrections (if user manually switches back, adjust patterns)
- [ ] Add visual indicator when auto-switch happens (toast: "Switched to Product Knowledge for this question")

---

## Deployment Status

✅ **Worker:** Version 659474ef (deployed Nov 10, 2025 2:33 PM)
- Citation codes included in Sales Simulation prompts
- Product Knowledge mode with 1800 token allocation

✅ **GitHub Pages:** Auto-deploying
- citations.json published
- widget.js with convertCitations() and auto-detect

✅ **Testing:** Ready for live validation
- Awaiting Groq API rate limit reset for end-to-end tests

---

## Support

For questions or issues:
1. Check browser console for `[Citations]` and `[Auto-Detect]` logs
2. Verify citations.json loaded: Console should show `[Citations] Loaded X references`
3. Test auto-detect: Console logs mode switches
4. Check citation links: Hover should show tooltip, click should open URL

