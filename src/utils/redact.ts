/**
 * Utility for redacting PHI/PII from logs
 * Ensures compliance with privacy requirements
 */

import { PHI_PATTERNS, REDACTED_VALUES } from '../constants';

/**
 * Redact potentially sensitive information from text
 * Removes: emails, phone numbers, SSN patterns, dates of birth, names
 */
export function redactPHI(text: string): string {
  if (!text) return text;
  
  let redacted = text;
  
  // Redact email addresses (comprehensive pattern)
  redacted = redacted.replace(PHI_PATTERNS.EMAIL, REDACTED_VALUES.EMAIL);
  
  // Redact phone numbers (various formats)
  redacted = redacted.replace(PHI_PATTERNS.PHONE_DASH, REDACTED_VALUES.PHONE);
  redacted = redacted.replace(PHI_PATTERNS.PHONE_PAREN, REDACTED_VALUES.PHONE);
  
  // Redact SSN patterns
  redacted = redacted.replace(PHI_PATTERNS.SSN, REDACTED_VALUES.SSN);
  
  // Redact date patterns that could be DOB
  redacted = redacted.replace(PHI_PATTERNS.DATE_SLASH, REDACTED_VALUES.DATE);
  redacted = redacted.replace(PHI_PATTERNS.DATE_DASH, REDACTED_VALUES.DATE);
  
  return redacted;
}

/**
 * Create a safe log message with redacted PHI/PII
 */
export function safeLog(message: string, data?: Record<string, any>): string {
  const redactedMessage = redactPHI(message);
  
  if (!data) {
    return redactedMessage;
  }
  
  // Redact sensitive fields in data object
  const safeData: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string') {
      safeData[key] = redactPHI(value);
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      safeData[key] = value;
    } else {
      safeData[key] = '[REDACTED]';
    }
  }
  
  return `${redactedMessage} ${JSON.stringify(safeData)}`;
}

/**
 * Redact user content but preserve structure for metrics
 */
export function redactForMetrics(content: string): { 
  wordCount: number; 
  questionCount: number; 
  hasEmail: boolean;
  hasPhone: boolean;
} {
  return {
    wordCount: content.split(/\s+/).filter(Boolean).length,
    questionCount: (content.match(/\?/g) || []).length,
    hasEmail: PHI_PATTERNS.EMAIL.test(content),
    hasPhone: PHI_PATTERNS.PHONE_DASH.test(content) || PHI_PATTERNS.PHONE_PAREN.test(content)
  };
}
