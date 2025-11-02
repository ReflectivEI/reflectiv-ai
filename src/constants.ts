/**
 * Constants for the ReflectivAI Gateway
 */

// Fallback responses for loop detection
export const FALLBACK_RESPONSES = {
  ROLE_PLAY: "In my clinic, we review history, adherence, and recent exposures before deciding. Follow-up timing guides next steps.",
  SALES_SIMULATION: 'Anchor to eligibility, one safety check, and end with a single discovery question about patient selection. Suggested Phrasing: "For patients with consistent risk, would confirming eGFR today help you start one eligible person this month?"'
};

// EI analysis patterns
export const EI_PATTERNS = {
  ASSERTIVE: /\b(recommend|suggest|important|should|will|can help)\b/gi,
  HEDGING: /\b(maybe|perhaps|might|possibly|could be)\b/gi,
  ACKNOWLEDGMENT: /\b(I understand|I see|thank you|that's|yes,|right,|good question|appreciate)\b/gi,
  FACT_REFERENCE: /\b(study|data|research|label|indication|FDA|clinical|trial)\b/gi,
  EMPATHETIC: /\b(understand|appreciate|recognize|consider|help you|support)\b/gi,
  COLLABORATIVE: /\b(we can|together|let's|our goal|work with)\b/gi,
  CONDITIONAL: /\b(if|depending|based on|considering|given that)\b/gi,
  ACTION_ORIENTED: /\b(next step|follow up|schedule|plan|start|begin)\b/gi,
  TIMEFRAME: /\b(today|this week|this month|next visit)\b/gi,
  CLARIFYING: /\b(you mentioned|you asked|you're asking|regarding|about your)\b/gi
};

// PHI/PII redaction patterns
export const PHI_PATTERNS = {
  // More comprehensive email pattern
  EMAIL: /\b[A-Za-z0-9]([A-Za-z0-9._%+-]{0,63})@[A-Za-z0-9]([A-Za-z0-9.-]{0,253})\.[A-Za-z]{2,}\b/g,
  PHONE_DASH: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
  PHONE_PAREN: /\b\(\d{3}\)\s*\d{3}[-.]?\d{4}\b/g,
  SSN: /\b\d{3}-\d{2}-\d{4}\b/g,
  DATE_SLASH: /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g,
  DATE_DASH: /\b\d{4}-\d{2}-\d{2}\b/g
};

// Redaction replacements
export const REDACTED_VALUES = {
  EMAIL: '[EMAIL]',
  PHONE: '[PHONE]',
  SSN: '[SSN]',
  DATE: '[DATE]'
};
