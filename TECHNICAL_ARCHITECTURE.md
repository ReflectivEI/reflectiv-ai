# ReflectivAI Technical Architecture & EI Metrics System
**Version:** 1.0  
**Date:** November 10, 2025  
**For:** Enterprise Pharma Sales Enablement Platform

---

## EXECUTIVE SUMMARY

ReflectivAI is an AI-powered sales enablement platform that quantifies Emotional Intelligence (EI) in pharmaceutical sales conversations. The system measures 5 core behavioral metrics tied to sales performance and regulatory compliance, providing real-time coaching and longitudinal analytics.

**Key Differentiators:**
- ✅ Deterministic EI scoring (not subjective human review)
- ✅ MLR-compliant guardrails (flags off-label language)
- ✅ Real-time coaching (instant feedback per exchange)
- ✅ Longitudinal tracking (progress over weeks/months)
- ✅ Multi-therapeutic area support (HIV, Cardiology, Oncology, etc.)

---

## 1. WHAT GETS MEASURED

ReflectivAI quantifies **5 core Emotional Intelligence metrics** tied to sales performance and compliance:

### Metric Definitions:

| Metric | Definition | Business Impact |
|--------|------------|-----------------|
| **Empathy** | How well the rep acknowledges and validates HCP context, tone, or constraints | ↑ Trust, ↑ Engagement, ↑ Prescribing Intent |
| **Discovery** | Ability to ask purposeful, open-ended questions that uncover needs or barriers | ↑ Needs Identification, ↑ Solution Fit |
| **Compliance** | Alignment with approved, on-label, MLR-vetted content | ↓ Regulatory Risk, ↑ Brand Safety |
| **Clarity** | Conciseness, organization, and logical flow of communication | ↑ Message Retention, ↓ Confusion |
| **Accuracy** | Scientific correctness and factual precision relative to product labeling | ↑ Credibility, ↓ Misinformation |

**Each response** from the Rep (user) or AI Coach (assistant) is evaluated across these 5 dimensions per exchange.

---

## 2. HOW IT'S CALCULATED

### Scoring Engine Architecture:

```
┌─────────────┐
│ Rep Input   │
│ (User Msg)  │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────┐
│ CLOUDFLARE WORKER                   │
│ ┌─────────────────────────────────┐ │
│ │ Step 1: Parse                   │ │
│ │ • Extract intent, tone, claims  │ │
│ │ • Tokenize into semantic units  │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ Step 2: Score (Deterministic)   │ │
│ │                                 │ │
│ │ EMPATHY SCORING:                │ │
│ │ • Acknowledgment verbs found?   │ │
│ │ • Validation language present?  │ │
│ │ • Tone classifier: positive     │ │
│ │ Score: 1-5                      │ │
│ │                                 │ │
│ │ DISCOVERY SCORING:              │ │
│ │ • Interrogative ratio > 10%?    │ │
│ │ • Open-ended structure?         │ │
│ │ • Needs-focused questions?      │ │
│ │ Score: 1-5                      │ │
│ │                                 │ │
│ │ COMPLIANCE SCORING:             │ │
│ │ • Term-to-label alignment check │ │
│ │ • Off-label flag detection      │ │
│ │ • MLR-vetted phrase match       │ │
│ │ Score: 1-5                      │ │
│ │                                 │ │
│ │ CLARITY SCORING:                │ │
│ │ • Avg sentence length < 20 words│ │
│ │ • Coherence index > 0.7         │ │
│ │ • Logical flow detected         │ │
│ │ Score: 1-5                      │ │
│ │                                 │ │
│ │ ACCURACY SCORING:               │ │
│ │ • Factual claim → label match   │ │
│ │ • Citation presence             │ │
│ │ • Data point verification       │ │
│ │ Score: 1-5                      │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ Step 3: Aggregate               │ │
│ │ • Weighted average per turn     │ │
│ │ • Rolling mean per session      │ │
│ │ • Pharma-specific weighting:    │ │
│ │   - Compliance ×1.2             │ │
│ │   - Accuracy ×1.1               │ │
│ │   - Others ×1.0                 │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
       │
       ▼
┌─────────────────────┐
│ GROQ LLM (llama-3.3)│
│ • Generates coach   │
│ • Returns XML block │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│ EI ENRICHMENT                       │
│ • Inject scores into <coach> block  │
│ • Generate rationales + tips        │
│ • Format for widget display         │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────┐
│ Widget Display      │
│ • 5 colored pills   │
│ • Tooltips          │
│ • Coach feedback    │
└─────────────────────┘
```

### Scoring Rules (Deterministic Logic):

```javascript
// EMPATHY SCORING (1-5 scale)
function scoreEmpathy(text) {
  let score = 1;
  if (/\b(understand|appreciate|hear|given your|I know)\b/i.test(text)) score += 2;
  if (/\b(time|busy|schedule|constraints|workload)\b/i.test(text)) score += 1;
  if (/\b(thank|thanks|grateful)\b/i.test(text)) score += 1;
  return Math.min(5, score);
}

// DISCOVERY SCORING (1-5 scale)
function scoreDiscovery(text) {
  const questions = (text.match(/\?/g) || []).length;
  const openEnded = /\b(how|what|why|could you|can you|tell me|walk me|clarify)\b/i.test(text);
  let score = 1;
  if (questions > 0) score += 2;
  if (openEnded) score += 2;
  return Math.min(5, score);
}

// COMPLIANCE SCORING (1-5 scale)
function scoreCompliance(text, labelTerms) {
  let score = 5;
  // Deduct for off-label language
  if (/\b(cure|prevent|eliminate|treat)\b/i.test(text) && !labelTerms.includes('treatment')) score -= 2;
  if (/\b(better than|superior to|best)\b/i.test(text)) score -= 1;
  if (!/\[.*\]/.test(text)) score -= 1; // No citation
  return Math.max(1, score);
}

// CLARITY SCORING (1-5 scale)
function scoreClarity(text) {
  const sentences = text.split(/[.!?]/).filter(s => s.trim().length > 0);
  const avgLength = sentences.reduce((sum, s) => sum + s.split(/\s+/).length, 0) / sentences.length;
  let score = 3;
  if (avgLength < 15) score += 2;
  else if (avgLength > 25) score -= 1;
  return Math.min(5, Math.max(1, score));
}

// ACCURACY SCORING (1-5 scale)
function scoreAccuracy(text, factsDB) {
  let score = 3;
  const citations = (text.match(/\[[\w-]+\]/g) || []).length;
  if (citations > 0) score += 2;
  // Check if claims match facts
  const claims = extractClaims(text);
  if (claims.every(c => factsDB.verify(c))) score = 5;
  return Math.min(5, score);
}
```

---

## 3. HOW IT'S DISPLAYED

### Display Layers:

#### A. **Inline Feedback (Coach Card)**

Appears after each Rep message in chat:

```
┌───────────────────────────────────────────┐
│ 🟡 Sales Coach                            │
├───────────────────────────────────────────┤
│                                           │
│ Challenge:                                │
│ You mentioned "reduce readmissions"       │
│ without referencing the approved label.   │
│                                           │
│ Rep Approach:                             │
│ • Acknowledged HCP's busy schedule ✓      │
│ • Blended efficacy claim with off-label  │
│                                           │
│ Impact:                                   │
│ Risk of compliance flag despite good      │
│ intent.                                   │
│                                           │
│ Suggested Phrasing:                       │
│ "Dr. Patel, Cardionex has shown strong   │
│  outcomes in maintaining patient          │
│  stability, within its indicated          │
│  population."                             │
│                                           │
└───────────────────────────────────────────┘
```

#### B. **EI Summary Panel (Widget Bottom)**

Shows 5 metric pills:

```
┌───────────────────────────────────────────┐
│ Emotional Intelligence Summary            │
│ ────────────────────────────────────────  │
│                                           │
│ 🟩 Empathy 5/5    🟧 Discovery 2/5        │
│ 🟧 Compliance 3/5  🟩 Clarity 4/5         │
│ 🟩 Accuracy 4/5                           │
│                                           │
│ Scored via EI rubric v1.2                 │
│ → how scoring works                       │
└───────────────────────────────────────────┘
```

Color coding:
- 🟩 Green (4-5): Strong
- 🟨 Yellow (3): Acceptable
- 🟧 Orange (2): Needs Work
- 🟥 Red (1): Critical Gap

#### C. **Tooltips (Hover for Rationale)**

```
┌─────────────────────────────────────┐
│ Compliance: 3/5                     │
│                                     │
│ Rationale:                          │
│ Used language implying off-label    │
│ outcome ("reduce readmissions").    │
│                                     │
│ Tip:                                │
│ Anchor statements in label language.│
└─────────────────────────────────────┘
```

---

## 4. HOW IT'S STORED FOR ANALYTICS

### Storage Format (JSON):

```json
{
  "session_id": "rep101_cardiology_20251110",
  "turn_id": 3,
  "mode": "sales-simulation",
  "persona": "Busy Internal Medicine MD",
  "disease": "Heart Failure",
  "therapeutic_area": "Cardiology",
  "scores": {
    "empathy": 5,
    "discovery": 2,
    "compliance": 3,
    "clarity": 4,
    "accuracy": 4
  },
  "rationales": {
    "empathy": "Validated workload before starting pitch.",
    "discovery": "Did not probe for patient management needs.",
    "compliance": "Used language implying off-label outcome.",
    "clarity": "Concise with logical flow.",
    "accuracy": "Core data point correct but overstated."
  },
  "tips": [
    "Ask one open-ended question before sharing data.",
    "Anchor statements in label language."
  ],
  "rubric_version": "v1.2",
  "timestamp": "2025-11-10T21:05:23Z",
  "rep_message": "Dr. Patel, I know your schedule is packed...",
  "coach_response": "Challenge: You mentioned 'reduce hospital readmissions'..."
}
```

### Storage Layers:

1. **Cloudflare KV (Temporary Cache)**
   - Key: `SESSION_EI:rep101_cardiology_20251110`
   - TTL: 7 days
   - Purpose: Fast retrieval for ongoing sessions

2. **Analytics Database (Persistent)**
   - Options: Supabase / Firestore / Snowflake
   - Schema: `ei_metrics` table
   - Retention: 2 years (compliance requirement)

3. **Data Warehouse (Long-term Analytics)**
   - Aggregated metrics for reporting
   - Powers ReflectivAI Analytics Dashboard

---

## 5. END-TO-END FLOW EXAMPLE

### Scenario: Sales Simulation Mode

**Setup:**
- Mode: Sales Simulation
- Persona: Dr. Patel, Busy Internal Medicine Physician
- Therapeutic Area: Cardiology (Heart Failure)
- Objective: Practice introducing new therapy compliantly

**Step 1: Rep Input**
```
"Dr. Patel, I know your schedule is packed, but I'd love to share
a few updates about Cardionex that can help reduce hospital
readmissions in your HF patients."
```

**Step 2: Worker Processing**
```javascript
// Parse input
const intent = extractIntent(repMessage); // "introduce therapy"
const tone = analyzeTone(repMessage); // "respectful, proactive"
const claims = extractClaims(repMessage); // ["reduce hospital readmissions"]

// Score EI metrics
const scores = {
  empathy: scoreEmpathy(repMessage), // 5 (acknowledged busy schedule)
  discovery: scoreDiscovery(repMessage), // 2 (no question asked)
  compliance: scoreCompliance(repMessage, labelTerms), // 3 (off-label risk)
  clarity: scoreClarity(repMessage), // 4 (concise)
  accuracy: scoreAccuracy(repMessage, factsDB) // 4 (generally correct)
};

// Generate rationales
const rationales = {
  empathy: "Validated workload before starting pitch.",
  discovery: "Did not probe for patient management needs.",
  compliance: "Used language implying off-label outcome.",
  clarity: "Concise with logical flow.",
  accuracy: "Core data point correct but overstated."
};

// Generate tips
const tips = [
  "Ask one open-ended question before sharing data.",
  "Anchor statements in label language."
];
```

**Step 3: LLM Generation (GROQ)**
```xml
<coach>
{
  "challenge": "You mentioned 'reduce hospital readmissions' without referencing the approved label claim.",
  "rep_approach": [
    "Acknowledged the HCP's busy schedule (shows empathy)",
    "Blended an efficacy claim with an outcome not listed on-label"
  ],
  "impact": "The statement risks being flagged by compliance reviewers even though intent was good.",
  "suggested_phrasing": "Dr. Patel, I know your time is limited. Cardionex has shown strong outcomes in maintaining patient stability post-discharge, within its indicated population."
}
</coach>
Dr. Patel appreciates the acknowledgment but wants more specifics.
```

**Step 4: EI Enrichment**
```javascript
// Inject scores into response
const enrichedCoach = {
  ...coachData,
  ei: {
    scores,
    rationales,
    tips,
    rubric_version: "v1.2"
  }
};
```

**Step 5: Widget Display**

User sees:
- Coach feedback card with Challenge/Rep Approach/Impact/Suggested Phrasing
- EI panel at bottom:
  - 🟩 Empathy 5/5
  - 🟧 Discovery 2/5
  - 🟧 Compliance 3/5
  - 🟩 Clarity 4/5
  - 🟩 Accuracy 4/5

**Step 6: Analytics Storage**

JSON record saved to:
- Cloudflare KV (session cache)
- Supabase `ei_metrics` table
- Data warehouse for aggregation

**Step 7: Dashboard Update**

ReflectivAI Analytics shows:
- **Radar chart:** Empathy high, Discovery low
- **Trendline:** Over 10 sessions, Discovery improving +1.2 points
- **Heatmap:** Red cell for Compliance in Cardiology → triggers "Compliance Clinic" microlearning

---

## 6. ENTERPRISE GUARDRAILS

### Compliance Features:

1. **Off-Label Detection**
   ```javascript
   const offLabelTerms = ['cure', 'prevent', 'eliminate', 'better than', 'superior'];
   if (containsOffLabel(text, offLabelTerms)) {
     flagForReview = true;
     complianceScore -= 2;
   }
   ```

2. **Mandatory Citation**
   ```javascript
   const hasCitation = /\[[\w-]+\]/.test(text);
   if (!hasCitation) {
     complianceScore -= 1;
     tips.push("Add citation to support claim.");
   }
   ```

3. **MLR Approval Tracking**
   - Each scenario tagged with MLR approval ID
   - Responses logged for audit trail
   - Version control for content updates

### Scalability Parameters:

| Metric | Current | Target | Notes |
|--------|---------|--------|-------|
| **Concurrent Users** | 100 | 10,000 | Cloudflare Workers auto-scales |
| **Requests/User/Day** | 50 | 200 | Rate limit: 10/min per user |
| **Response Time** | 2-5s | <3s | GROQ API latency |
| **Uptime SLA** | 99.9% | 99.99% | Cloudflare global CDN |
| **Data Retention** | 2 years | 5 years | Compliance requirement |

---

## 7. TECHNICAL SPECIFICATIONS

### Stack:

- **Frontend:** Vanilla JS (widget.js), HTML5, CSS3
- **Backend:** Cloudflare Workers (serverless, global edge)
- **LLM:** GROQ (llama-3.3-70b-versatile)
- **Storage:** Cloudflare KV + Supabase/Firestore
- **Deployment:** GitHub Actions → Cloudflare Workers
- **CDN:** Cloudflare global network (310+ cities)

### API Endpoints:

```
POST /chat
- Input: { mode, user, disease, persona }
- Output: { assistant, coach: { ei: {...} } }

GET /health
- Returns: { ok: true, key_pool: 4 }

GET /version
- Returns: { version: "r10.1", deployed: "2025-11-10" }

POST /coach-metrics
- Input: { session_id, scores, ... }
- Output: { saved: true }
```

### Security:

- ✅ CORS restricted to approved domains
- ✅ API keys rotated (4-key pool)
- ✅ Rate limiting (10 req/min)
- ✅ Input sanitization (XSS prevention)
- ✅ HTTPS only (TLS 1.3)

---

## 8. ROADMAP & FUTURE ENHANCEMENTS

### Q1 2026:
- [ ] Multi-language support (Spanish, French, German)
- [ ] Voice-to-text integration (mobile app)
- [ ] Advanced analytics (predictive scoring)

### Q2 2026:
- [ ] Custom rubric builder (per client)
- [ ] Manager dashboard (team oversight)
- [ ] A/B testing framework

### Q3 2026:
- [ ] Integration with CRM (Salesforce, Veeva)
- [ ] Certification workflow (badge system)
- [ ] White-label deployments

---

**END OF TECHNICAL ARCHITECTURE DOCUMENT**

*For questions or implementation details, contact: engineering@reflectivai.com*
