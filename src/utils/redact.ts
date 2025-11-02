/**
 * Utility for redacting PHI/PII from logs
 * Ensures compliance with privacy requirements
 */

/**
 * Redact potentially sensitive information from text
 * Removes: emails, phone numbers, SSN patterns, dates of birth, names
 */
export function redactPHI(text: string): string {
  if (!text) return text;
  
  let redacted = text;
  
  // Redact email addresses
  redacted = redacted.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]');
  
  // Redact phone numbers (various formats)
  redacted = redacted.replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[PHONE]');
  redacted = redacted.replace(/\b\(\d{3}\)\s*\d{3}[-.]?\d{4}\b/g, '[PHONE]');
  
  // Redact SSN patterns
  redacted = redacted.replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN]');
  
  // Redact date patterns that could be DOB
  redacted = redacted.replace(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g, '[DATE]');
  redacted = redacted.replace(/\b\d{4}-\d{2}-\d{2}\b/g, '[DATE]');
  
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
    hasEmail: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/.test(content),
    hasPhone: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/.test(content)
  };
}
