/**
 * Utility for redacting PHI/PII from logs
 * Ensures compliance with privacy requirements
 */

import { PHI_PATTERNS, REDACTED_VALUES } from '../constants';

/**
 * Redact potentially sensitive information from text
 * Removes: emails, phone numbers, SSN patterns, dates of birth
 * Uses a single-pass approach for better performance
 */
export function redactPHI(text: string): string {
  if (!text) return text;
  
  // Apply all redactions in a single chain for efficiency
  return text
    .replace(PHI_PATTERNS.EMAIL, REDACTED_VALUES.EMAIL)
    .replace(PHI_PATTERNS.PHONE_DASH, REDACTED_VALUES.PHONE)
    .replace(PHI_PATTERNS.PHONE_PAREN, REDACTED_VALUES.PHONE)
    .replace(PHI_PATTERNS.SSN, REDACTED_VALUES.SSN)
    .replace(PHI_PATTERNS.DATE_SLASH, REDACTED_VALUES.DATE)
    .replace(PHI_PATTERNS.DATE_DASH, REDACTED_VALUES.DATE);
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
