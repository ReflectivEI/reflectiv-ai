/**
 * Type definitions for ReflectivAI Gateway
 */

export interface Env {
  PROVIDER_URL: string;
  PROVIDER_MODEL: string;
  PROVIDER_KEY: string;
  CORS_ORIGINS: string;
  REQUIRE_FACTS?: string;
  MAX_OUTPUT_TOKENS?: string;
  ENVIRONMENT?: string;
  SESS?: KVNamespace;
}

export interface Fact {
  id: string;
  ta?: string;
  topic?: string;
  text: string;
  cites?: string[];
}

export interface Plan {
  planId: string;
  mode: string;
  disease: string;
  persona: string;
  goal: string;
  facts: Fact[];
  fsm?: FSMDefinition;
}

export interface FSMDefinition {
  states: Record<string, { capSentences: number; next: string }>;
  start: string;
}

export interface CoachScores {
  accuracy: number;
  compliance: number;
  discovery: number;
  clarity: number;
  objection_handling: number;
  empathy: number;
}

export interface EIScores {
  confidence: number;
  active_listening: number;
  rapport: number;
  adaptability: number;
  persistence: number;
}

export interface CoachPayload {
  overall?: number;
  score?: number;
  scores: CoachScores;
  subscores?: Record<string, number>;
  worked: string[];
  improve: string[];
  phrasing: string;
  feedback: string;
  context: {
    rep_question: string;
    hcp_reply: string;
  };
  ei?: EIPayload;
}

export interface EIPayload {
  overall: number;
  scores: EIScores;
  insights: string[];
  recommendations: string[];
}

export interface ChatRequest {
  mode?: string;
  user: string;
  history?: Array<{ role: string; content: string }>;
  disease?: string;
  persona?: string;
  goal?: string;
  plan?: Plan;
  planId?: string;
  session?: string;
}

export interface ChatResponse {
  reply: string;
  coach?: CoachPayload;
  plan?: { id: string };
}

export interface SessionState {
  lastNorm: string;
  fsm: Record<string, any>;
}

export interface Config {
  emitEi: boolean;
}
