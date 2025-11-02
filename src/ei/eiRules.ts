import { EiPayload, EiScores } from '../types';

interface ScoreEiInput {
  text: string;
  mode: string;
}

/**
 * Deterministic EI scoring based on heuristics
 * Analyzes text for empathy, discovery, compliance, clarity, and accuracy
 */
export function scoreEi({ text, mode }: ScoreEiInput): EiPayload {
  const words = text.split(/\s+/).filter(Boolean);
  const sentences = text.match(/[^.!?]+[.!?]?/g) || [];
  const avgSentenceLength = sentences.length > 0 
    ? words.length / sentences.length 
    : 0;
  
  // Question density for discovery
  const questions = (text.match(/\?/g) || []).length;
  const questionDensity = words.length > 0 ? questions / sentences.length : 0;
  
  // Empathy keywords
  const empathyKeywords = [
    'understand', 'feel', 'appreciate', 'concern', 'care',
    'patient', 'important', 'help', 'support', 'experience'
  ];
  const empathyCount = empathyKeywords.filter(kw => 
    text.toLowerCase().includes(kw)
  ).length;
  
  // Discovery keywords
  const discoveryKeywords = [
    'would', 'could', 'might', 'consider', 'think',
    'what if', 'have you', 'would you', 'tell me', 'how'
  ];
  const discoveryCount = discoveryKeywords.filter(kw =>
    text.toLowerCase().includes(kw)
  ).length;
  
  // Compliance/label anchors
  const complianceAnchors = [
    'per label', 'according to', 'fda', 'cdc', 'ias',
    'indicated', 'approved', 'guideline', 'recommendation'
  ];
  const complianceCount = complianceAnchors.filter(anchor =>
    text.toLowerCase().includes(anchor)
  ).length;
  
  // Prohibited claims (red flags)
  const prohibitedClaims = [
    'cure', 'guarantee', 'best', 'only', 'always works',
    'no side effects', 'completely safe', 'never fails'
  ];
  const prohibitedCount = prohibitedClaims.filter(claim =>
    text.toLowerCase().includes(claim)
  ).length;
  
  // Clarity - based on sentence length and structure
  const clarityScore = clamp(
    Math.round(5 - Math.abs(avgSentenceLength - 18) / 8),
    1,
    5
  );
  
  // Empathy - based on empathy keywords
  const empathyScore = clamp(
    Math.round(2 + empathyCount * 0.8),
    1,
    5
  );
  
  // Discovery - based on questions and discovery keywords
  const discoveryScore = clamp(
    Math.round(2 + questionDensity * 8 + discoveryCount * 0.5),
    1,
    5
  );
  
  // Compliance - based on label anchors, penalize prohibited claims
  const complianceScore = clamp(
    Math.round(3 + complianceCount * 0.8 - prohibitedCount * 2),
    1,
    5
  );
  
  // Accuracy - based on word count (not too short, not too long) and structure
  const accuracyScore = clamp(
    Math.round(5 - Math.abs(words.length - 100) / 40),
    1,
    5
  );
  
  const scores: EiScores = {
    empathy: empathyScore,
    discovery: discoveryScore,
    compliance: complianceScore,
    clarity: clarityScore,
    accuracy: accuracyScore
  };
  
  // Generate rationales
  const rationales: Record<string, string> = {
    empathy: empathyScore >= 4 
      ? 'Good use of patient-centered language'
      : 'Consider more empathetic phrasing',
    discovery: discoveryScore >= 4
      ? 'Strong discovery questions present'
      : 'Add more open-ended questions to engage',
    compliance: complianceScore >= 4
      ? 'Well-anchored to label and guidelines'
      : 'Strengthen label references',
    clarity: clarityScore >= 4
      ? 'Clear and concise messaging'
      : 'Simplify sentence structure for clarity',
    accuracy: accuracyScore >= 4
      ? 'Appropriate level of detail'
      : 'Adjust detail level for better accuracy'
  };
  
  // Generate tips (max 5)
  const tips: string[] = [];
  if (empathyScore < 4) {
    tips.push('Use more patient-centered language to show empathy');
  }
  if (discoveryScore < 4) {
    tips.push('End with a specific discovery question');
  }
  if (complianceScore < 4) {
    tips.push('Anchor claims to FDA label or guidelines');
  }
  if (clarityScore < 4) {
    tips.push('Keep sentences concise (15-20 words average)');
  }
  if (accuracyScore < 4) {
    tips.push('Balance detail level - not too brief, not too lengthy');
  }
  
  return {
    scores,
    rationales,
    tips: tips.slice(0, 5),
    rubric_version: 'v1.2'
  };
}

/**
 * Clamp a value between min and max
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
