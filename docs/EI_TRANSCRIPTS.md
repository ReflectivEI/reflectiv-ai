# EI Emission Feature - Sample Transcripts

## Sample JSON Response (with emitEi=1 and mode=sales-simulation)

### Request
```http
POST /chat?emitEi=1
Content-Type: application/json

{
  "mode": "sales-simulation",
  "user": "How should I approach an HCP about HIV PrEP?",
  "disease": "HIV",
  "persona": "Busy primary care physician",
  "goal": "Discuss PrEP eligibility",
  "history": []
}
```

### Response
```json
{
  "reply": "Focus on eligibility and risk factors per CDC guidelines. Discuss sexual and injection risk. Ask: 'Do you have patients with consistent risk who might benefit from PrEP?' Suggested Phrasing: 'For patients with substantial HIV risk, would confirming eGFR today help you start one eligible person this month?'",
  "coach": {
    "overall": 85,
    "scores": {
      "accuracy": 4,
      "compliance": 4,
      "discovery": 4,
      "clarity": 4,
      "objection_handling": 3,
      "empathy": 3
    },
    "worked": ["Tied guidance to facts"],
    "improve": ["End with one specific discovery question"],
    "phrasing": "Would confirming eGFR today help you identify one patient to start this month?",
    "feedback": "Stay concise. Cite label-aligned facts. Close with one clear question.",
    "context": {
      "rep_question": "How should I approach an HCP about HIV PrEP?",
      "hcp_reply": "Focus on eligibility and risk factors..."
    }
  },
  "_coach": {
    "ei": {
      "scores": {
        "empathy": 3,
        "discovery": 4,
        "compliance": 4,
        "clarity": 4,
        "accuracy": 4
      },
      "rationales": {
        "empathy": "Consider more empathetic phrasing",
        "discovery": "Strong discovery questions present",
        "compliance": "Well-anchored to label and guidelines",
        "clarity": "Clear and concise messaging",
        "accuracy": "Appropriate level of detail"
      },
      "tips": [
        "Use more patient-centered language to show empathy"
      ],
      "rubric_version": "v1.2"
    }
  },
  "plan": {
    "id": "a1b2c3d4e5f6g7h8"
  }
}
```

## Sample SSE Response (with emitEi=1, mode=sales-simulation, Accept: text/event-stream)

### Request
```http
POST /chat?emitEi=1
Accept: text/event-stream
Content-Type: application/json

{
  "mode": "sales-simulation",
  "user": "What's the best way to discuss PrEP safety?",
  "disease": "HIV",
  "persona": "Cautious HCP",
  "goal": "Address safety concerns"
}
```

### Response Stream
```
data: {"type":"reply","content":"Per FDA label, assess renal function before and during PrEP. Descovy has eGFR thresholds. Ask: 'What's your typical process for monitoring kidney function?' Suggested Phrasing: 'Would a quick eGFR check today help you feel confident about starting one patient?'"}

event: coach.partial
data: {"scores":{"empathy":3,"discovery":4,"compliance":5,"clarity":4,"accuracy":4}}

event: coach.final
data: {"scores":{"empathy":3,"discovery":4,"compliance":5,"clarity":4,"accuracy":4},"rationales":{"empathy":"Consider more empathetic phrasing","discovery":"Strong discovery questions present","compliance":"Well-anchored to label and guidelines","clarity":"Clear and concise messaging","accuracy":"Appropriate level of detail"},"tips":["Use more patient-centered language to show empathy"],"rubric_version":"v1.2"}

data: [DONE]

```

## Sample Response WITHOUT emitEi (mode=sales-simulation, no flag)

### Request
```http
POST /chat
Content-Type: application/json

{
  "mode": "sales-simulation",
  "user": "How should I approach an HCP about HIV PrEP?",
  "disease": "HIV"
}
```

### Response
```json
{
  "reply": "Focus on eligibility and risk factors per CDC guidelines...",
  "coach": {
    "overall": 85,
    "scores": {
      "accuracy": 4,
      "compliance": 4,
      "discovery": 4,
      "clarity": 4,
      "objection_handling": 3,
      "empathy": 3
    }
  },
  "plan": {
    "id": "a1b2c3d4e5f6g7h8"
  }
}
```

Note: No `_coach.ei` field is present when emitEi is not enabled.

## Sample Response with emitEi for role-play mode (should NOT include EI)

### Request
```http
POST /chat?emitEi=1
Content-Type: application/json

{
  "mode": "role-play",
  "user": "Tell me about PrEP.",
  "disease": "HIV",
  "persona": "HCP"
}
```

### Response
```json
{
  "reply": "In my clinic, we consider PrEP for patients with substantial HIV risk...",
  "plan": {
    "id": "x1y2z3a4b5c6d7e8"
  }
}
```

Note: EI is only emitted for `mode=sales-simulation`, not for `role-play` mode.
