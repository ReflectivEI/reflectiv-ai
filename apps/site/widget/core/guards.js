/**
 * Guards Module - Client-side schema validation for structured responses
 * Validates 4-section schema for sales-simulation mode
 */

import { bus } from './bus.js';

/**
 * Required sections for sales-simulation mode
 */
const SALES_SIM_SECTIONS = [
  'challenge',
  'rep_approach',
  'impact',
  'suggested_phrasing'
];

/**
 * Alternative field names (normalization)
 */
const FIELD_ALIASES = {
  'rep approach': 'rep_approach',
  'rep-approach': 'rep_approach',
  'repapproach': 'rep_approach',
  'suggested phrasing': 'suggested_phrasing',
  'suggested-phrasing': 'suggested_phrasing',
  'suggestedphrasing': 'suggested_phrasing',
  'phrasing': 'suggested_phrasing'
};

/**
 * Parse structured JSON from response
 */
export function parseStructuredResponse(text) {
  const str = String(text || '').trim();
  
  // Try to extract JSON block
  const jsonMatch = str.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      return { success: true, data: parsed, format: 'json' };
    } catch (e) {
      // Fall through to text parsing
    }
  }

  // Parse labeled text format
  return parseLabeledText(str);
}

/**
 * Parse labeled text format (fallback)
 * Example:
 *   Challenge: ...
 *   Rep Approach: ...
 *   Impact: ...
 *   Suggested Phrasing: ...
 */
function parseLabeledText(text) {
  const lines = text.split('\n');
  const sections = {};
  let currentKey = null;
  let currentValue = [];

  const keyPatterns = [
    /^(Challenge|Rep\s*Approach|Impact|Suggested\s*Phrasing)\s*[:：]\s*/i,
    /^\*\*(Challenge|Rep\s*Approach|Impact|Suggested\s*Phrasing)\*\*\s*[:：]?\s*/i,
    /^#{1,3}\s*(Challenge|Rep\s*Approach|Impact|Suggested\s*Phrasing)\s*/i
  ];

  lines.forEach(line => {
    let matchedKey = null;

    for (const pattern of keyPatterns) {
      const match = line.match(pattern);
      if (match) {
        matchedKey = normalizeKey(match[1]);
        break;
      }
    }

    if (matchedKey) {
      // Save previous section
      if (currentKey) {
        sections[currentKey] = currentValue.join('\n').trim();
      }
      
      // Start new section
      currentKey = matchedKey;
      currentValue = [];
      
      // Get content after the label
      const contentMatch = line.match(/[:：]\s*(.+)$/);
      if (contentMatch && contentMatch[1].trim()) {
        currentValue.push(contentMatch[1].trim());
      }
    } else if (currentKey) {
      // Append to current section
      const trimmed = line.trim();
      if (trimmed) {
        currentValue.push(trimmed);
      }
    }
  });

  // Save last section
  if (currentKey) {
    sections[currentKey] = currentValue.join('\n').trim();
  }

  return {
    success: Object.keys(sections).length > 0,
    data: sections,
    format: 'labeled'
  };
}

/**
 * Normalize key to standard format
 */
function normalizeKey(key) {
  const lower = String(key).toLowerCase().trim();
  
  // Check aliases
  if (FIELD_ALIASES[lower]) {
    return FIELD_ALIASES[lower];
  }

  // Direct match
  if (SALES_SIM_SECTIONS.includes(lower)) {
    return lower;
  }

  // Remove spaces/hyphens and try again
  const normalized = lower.replace(/[\s-]/g, '_');
  if (SALES_SIM_SECTIONS.includes(normalized)) {
    return normalized;
  }

  return lower;
}

/**
 * Validate sales-simulation response schema
 */
export function validateSalesSim(response) {
  const parsed = typeof response === 'string' 
    ? parseStructuredResponse(response)
    : { success: true, data: response, format: 'object' };

  if (!parsed.success || !parsed.data) {
    return {
      valid: false,
      missing: SALES_SIM_SECTIONS,
      data: null,
      format: parsed.format
    };
  }

  const data = parsed.data;
  const missing = [];

  // Check for required sections
  SALES_SIM_SECTIONS.forEach(section => {
    const value = data[section];
    if (!value || String(value).trim().length === 0) {
      missing.push(section);
    }
  });

  bus.emit('guards:validate', {
    mode: 'sales-simulation',
    valid: missing.length === 0,
    missing,
    format: parsed.format
  });

  return {
    valid: missing.length === 0,
    missing,
    data: data,
    format: parsed.format
  };
}

/**
 * Create corrective hint for missing sections
 */
export function createCorrectiveHint(missing) {
  if (!missing || missing.length === 0) {
    return null;
  }

  const sectionNames = missing.map(s => 
    s.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
  ).join(', ');

  return `Your response is missing the following required sections: ${sectionNames}. Please provide all four sections: Challenge, Rep Approach, Impact, and Suggested Phrasing.`;
}

/**
 * Validate and auto-correct response (with retry limit)
 */
let retryCount = 0;
const MAX_RETRIES = 1;

export function guardedValidate(response, mode = 'sales-simulation') {
  // Only validate sales-simulation for now
  if (mode !== 'sales-simulation') {
    return {
      valid: true,
      shouldRetry: false,
      data: response,
      hint: null
    };
  }

  const result = validateSalesSim(response);

  if (result.valid) {
    // Reset retry count on success
    retryCount = 0;
    return {
      valid: true,
      shouldRetry: false,
      data: result.data,
      hint: null,
      format: result.format
    };
  }

  // Check if we should retry
  const shouldRetry = retryCount < MAX_RETRIES;
  if (shouldRetry) {
    retryCount++;
  }

  const hint = createCorrectiveHint(result.missing);

  bus.emit('guards:invalid', {
    mode,
    missing: result.missing,
    shouldRetry,
    retryCount,
    hint
  });

  return {
    valid: false,
    shouldRetry,
    data: result.data,
    hint,
    missing: result.missing,
    format: result.format
  };
}

/**
 * Reset retry counter (call when starting new conversation)
 */
export function resetGuards() {
  retryCount = 0;
  bus.emit('guards:reset');
}

/**
 * Check if response contains all sections (quick check)
 */
export function hasSections(text, sections = SALES_SIM_SECTIONS) {
  const lower = String(text || '').toLowerCase();
  return sections.every(section => {
    const display = section.replace(/_/g, ' ');
    return lower.includes(display) || lower.includes(section);
  });
}
