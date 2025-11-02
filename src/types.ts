export interface EiScores {
  empathy: number;
  discovery: number;
  compliance: number;
  clarity: number;
  accuracy: number;
}

export interface EiPayload {
  scores: EiScores;
  rationales?: Record<string, string>;
  tips?: string[];
  rubric_version: string;
}

export interface CoachPayload {
  overall?: number;
  score?: number;
  scores: Record<string, number>;
  subscores?: Record<string, number>;
  worked?: string[];
  improve?: string[];
  phrasing?: string;
  feedback?: string;
  context?: Record<string, any>;
}

export interface ChatResponse {
  reply: string;
  coach?: CoachPayload;
  _coach?: {
    ei?: EiPayload;
  };
  plan?: {
    id: string;
  };
}

export interface Fact {
  id: string;
  text: string;
  cites?: string[];
  ta?: string;
  topic?: string;
}

export interface Plan {
  planId: string;
  mode: string;
  disease: string;
  persona: string;
  goal: string;
  facts: Fact[];
  fsm: any;
}

export interface Config {
  emitEi: boolean;
}

export interface Env {
  PROVIDER_URL: string;
  PROVIDER_MODEL: string;
  PROVIDER_KEY: string;
  CORS_ORIGINS: string;
  REQUIRE_FACTS?: string;
  MAX_OUTPUT_TOKENS?: string;
  SESS?: KVNamespace;
}
