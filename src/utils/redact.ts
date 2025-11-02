/**
 * Redact PII/PHI from text for safe logging
 * Removes: emails, phone numbers, MRNs, and potential HCP names
 */
export function redactPII(text: string): string {
  if (!text) return text;
  
  let redacted = text;
  
  // Redact emails
  redacted = redacted.replace(
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    '[EMAIL]'
  );
  
  // Redact phone numbers (various formats)
  redacted = redacted.replace(
    /\b(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b/g,
    '[PHONE]'
  );
  
  // Redact potential MRNs (alphanumeric patterns 6-12 chars)
  redacted = redacted.replace(
    /\b[A-Z0-9]{6,12}\b/g,
    (match) => {
      // Only redact if it looks like an ID (mix of letters and numbers)
      if (/[A-Z]/.test(match) && /[0-9]/.test(match)) {
        return '[MRN]';
      }
      return match;
    }
  );
  
  // Redact potential names (Dr. X, MD patterns)
  redacted = redacted.replace(
    /\b(?:Dr\.?|Doctor)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b/gi,
    '[HCP_NAME]'
  );
  
  return redacted;
}

/**
 * Redact an object's string values recursively
 */
export function redactObject(obj: any): any {
  if (typeof obj === 'string') {
    return redactPII(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(redactObject);
  }
  
  if (obj && typeof obj === 'object') {
    const redactedObj: any = {};
    for (const key in obj) {
      redactedObj[key] = redactObject(obj[key]);
    }
    return redactedObj;
  }
  
  return obj;
}
