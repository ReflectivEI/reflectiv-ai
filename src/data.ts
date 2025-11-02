/**
 * Static data and finite state machines
 */

import type { Fact, FSMDefinition } from './types';

export const FACTS_DB: Fact[] = [
  {
    id: "HIV-PREP-ELIG-001",
    ta: "HIV",
    topic: "PrEP Eligibility",
    text: "PrEP is recommended for individuals at substantial risk of HIV. Discuss sexual and injection risk factors.",
    cites: ["CDC PrEP 2024"]
  },
  {
    id: "HIV-PREP-TAF-002",
    ta: "HIV",
    topic: "Descovy for PrEP",
    text: "Descovy (emtricitabine/tenofovir alafenamide) is indicated for PrEP excluding receptive vaginal sex.",
    cites: ["FDA Label Descovy PrEP"]
  },
  {
    id: "HIV-PREP-SAFETY-003",
    ta: "HIV",
    topic: "Safety",
    text: "Assess renal function before and during PrEP. Consider eGFR thresholds per label.",
    cites: ["FDA Label Descovy", "CDC PrEP 2024"]
  }
];

export const FSM: Record<string, FSMDefinition> = {
  "sales-simulation": {
    states: { 
      START: { capSentences: 5, next: "COACH" }, 
      COACH: { capSentences: 6, next: "COACH" } 
    },
    start: "START"
  },
  "role-play": {
    states: { 
      START: { capSentences: 4, next: "HCP" }, 
      HCP: { capSentences: 4, next: "HCP" } 
    },
    start: "START"
  }
};

export const PLAN_SCHEMA = {
  type: "object",
  required: ["mode", "disease", "persona", "goal", "facts"],
  properties: {
    mode: { type: "string" },
    disease: { type: "string" },
    persona: { type: "string" },
    goal: { type: "string" },
    facts: {
      type: "array",
      minItems: 1,
      items: { 
        type: "object", 
        required: ["id", "text"], 
        properties: {
          id: { type: "string" }, 
          text: { type: "string" }, 
          cites: { type: "array", items: { type: "string" } }
        } 
      }
    }
  }
};
