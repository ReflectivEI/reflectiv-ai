import coachSchema from './schema/coach.json';

/**
 * Simple JSON schema validator for EI payload
 */
export function validateEiPayload(payload: any): boolean {
  try {
    if (!payload || typeof payload !== 'object') {
      return false;
    }

    // Check required fields
    if (!payload.scores || typeof payload.scores !== 'object') {
      return false;
    }

    if (!payload.rubric_version || typeof payload.rubric_version !== 'string') {
      return false;
    }

    // Validate scores
    const requiredScores = ['empathy', 'discovery', 'compliance', 'clarity', 'accuracy'];
    for (const score of requiredScores) {
      const value = payload.scores[score];
      if (typeof value !== 'number' || value < 1 || value > 5 || !Number.isInteger(value)) {
        return false;
      }
    }

    // Validate optional fields if present
    if (payload.rationales !== undefined) {
      if (typeof payload.rationales !== 'object' || Array.isArray(payload.rationales)) {
        return false;
      }
      for (const key in payload.rationales) {
        if (typeof payload.rationales[key] !== 'string') {
          return false;
        }
      }
    }

    if (payload.tips !== undefined) {
      if (!Array.isArray(payload.tips) || payload.tips.length > 5) {
        return false;
      }
      for (const tip of payload.tips) {
        if (typeof tip !== 'string') {
          return false;
        }
      }
    }

    return true;
  } catch {
    return false;
  }
}
