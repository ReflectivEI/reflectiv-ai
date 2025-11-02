/**
 * Deterministic Emotional Intelligence (EI) scoring rules
 * Uses heuristic analysis of conversation patterns to compute EI metrics
 */

import type { EIPayload, EIScores } from '../types';
import { EI_PATTERNS, EI_WEIGHTS, EI_SCALE_FACTOR } from '../constants';
import { clamp } from '../utils/common';

interface EIContext {
  reply: string;
  userQuestion: string;
  questionCount: number;
  acknowledgmentPatterns: number;
  factReferences: number;
  wordCount: number;
}

/**
 * Compute deterministic EI scores based on conversation heuristics
 */
export function computeEI(context: EIContext): EIPayload {
  const { reply, userQuestion, questionCount, acknowledgmentPatterns, factReferences, wordCount } = context;
  
  const scores: EIScores = {
    confidence: calculateConfidence(reply, factReferences, wordCount),
    active_listening: calculateActiveListening(userQuestion, reply, acknowledgmentPatterns),
    rapport: calculateRapport(reply, acknowledgmentPatterns),
    adaptability: calculateAdaptability(reply, questionCount),
    persistence: calculatePersistence(reply, questionCount)
  };
  
  // Overall EI score is weighted average, scaled from 0-5 to 0-100
  // Using Object.entries for cleaner calculation
  const weightedSum = Object.entries(scores).reduce((sum, [dimension, score]) => {
    const weight = EI_WEIGHTS[dimension as keyof typeof EI_WEIGHTS];
    return sum + (score * weight);
  }, 0);
  
  const overall = Math.round(weightedSum * EI_SCALE_FACTOR);
  
  const insights = generateInsights(scores, reply);
  const recommendations = generateRecommendations(scores, reply);
  
  return {
    overall,
    scores,
    insights,
    recommendations
  };
}

/**
 * Calculate confidence score based on fact usage and assertiveness
 */
function calculateConfidence(reply: string, factReferences: number, wordCount: number): number {
  let score = 3.0; // Base confidence
  
  // Boost for fact references (shows knowledge-based confidence)
  score += Math.min(1.5, factReferences * 0.3);
  
  // Penalize overly brief responses (may indicate uncertainty)
  if (wordCount < 40) {
    score -= 0.5;
  }
  
  // Boost for assertive language patterns
  const assertiveCount = (reply.match(EI_PATTERNS.ASSERTIVE) || []).length;
  score += Math.min(0.5, assertiveCount * 0.15);
  
  // Check for hedging language (reduces confidence)
  const hedgingCount = (reply.match(EI_PATTERNS.HEDGING) || []).length;
  score -= Math.min(1.0, hedgingCount * 0.3);
  
  return clamp(score, 0, 5);
}

/**
 * Calculate active listening score based on acknowledgment and reflection
 */
function calculateActiveListening(userQuestion: string, reply: string, acknowledgmentPatterns: number): number {
  let score = 2.5; // Base score
  
  // Boost for acknowledgment patterns
  score += Math.min(1.5, acknowledgmentPatterns * 0.5);
  
  // Check if reply references specific terms from user question
  const userWords = userQuestion.toLowerCase().split(/\s+/).filter(w => w.length > 4);
  const replyLower = reply.toLowerCase();
  const referencedWords = userWords.filter(w => replyLower.includes(w));
  score += Math.min(1.0, referencedWords.length * 0.2);
  
  // Boost for clarifying questions
  const clarifyingCount = (reply.match(EI_PATTERNS.CLARIFYING) || []).length;
  score += Math.min(1.0, clarifyingCount * 0.4);
  
  return clamp(score, 0, 5);
}

/**
 * Calculate rapport score based on empathetic and personalized language
 */
function calculateRapport(reply: string, acknowledgmentPatterns: number): number {
  let score = 2.5; // Base score
  
  // Boost for empathetic language
  const empatheticCount = (reply.match(EI_PATTERNS.EMPATHETIC) || []).length;
  score += Math.min(1.5, empatheticCount * 0.3);
  
  // Boost for acknowledgment
  score += Math.min(1.0, acknowledgmentPatterns * 0.3);
  
  // Check for collaborative language
  const collaborativeCount = (reply.match(EI_PATTERNS.COLLABORATIVE) || []).length;
  score += Math.min(0.5, collaborativeCount * 0.25);
  
  return clamp(score, 0, 5);
}

/**
 * Calculate adaptability based on response variety and question handling
 */
function calculateAdaptability(reply: string, questionCount: number): number {
  let score = 3.0; // Base score
  
  // Boost for ending with a question (shows flexibility in approach)
  if (/\?\s*$/.test(reply)) {
    score += 0.8;
  }
  
  // Check for conditional language (shows adaptability)
  const conditionalCount = (reply.match(EI_PATTERNS.CONDITIONAL) || []).length;
  score += Math.min(1.0, conditionalCount * 0.3);
  
  // Penalize if no questions asked over multiple turns
  if (questionCount === 0) {
    score -= 0.5;
  }
  
  return clamp(score, 0, 5);
}

/**
 * Calculate persistence based on follow-up questions and call-to-action
 */
function calculatePersistence(reply: string, questionCount: number): number {
  let score = 2.5; // Base score
  
  // Boost for questions (shows persistent engagement)
  score += Math.min(1.5, questionCount * 0.5);
  
  // Boost for action-oriented language
  const actionCount = (reply.match(EI_PATTERNS.ACTION_ORIENTED) || []).length;
  score += Math.min(1.0, actionCount * 0.4);
  
  // Check for specific timeframes (shows commitment)
  const timeframeCount = (reply.match(EI_PATTERNS.TIMEFRAME) || []).length;
  score += Math.min(0.5, timeframeCount * 0.3);
  
  return clamp(score, 0, 5);
}

/**
 * Generate insights based on EI scores
 */
function generateInsights(scores: EIScores, reply: string): string[] {
  const insights: string[] = [];
  
  if (scores.confidence >= 4) {
    insights.push('Strong knowledge-based confidence demonstrated');
  }
  if (scores.active_listening >= 4) {
    insights.push('Effectively acknowledged and referenced HCP concerns');
  }
  if (scores.rapport >= 4) {
    insights.push('Empathetic and collaborative tone maintained');
  }
  if (scores.adaptability >= 4) {
    insights.push('Flexible approach with discovery questions');
  }
  if (scores.persistence >= 4) {
    insights.push('Clear next steps with actionable follow-up');
  }
  
  // Ensure at least one insight
  if (insights.length === 0) {
    insights.push('Solid foundation with room for enhancement');
  }
  
  return insights;
}

/**
 * Generate recommendations based on EI scores
 */
function generateRecommendations(scores: EIScores, reply: string): string[] {
  const recommendations: string[] = [];
  
  if (scores.confidence < 3.5) {
    recommendations.push('Reference more clinical data or label information to strengthen confidence');
  }
  if (scores.active_listening < 3.5) {
    recommendations.push('Echo back specific HCP concerns before presenting solution');
  }
  if (scores.rapport < 3.5) {
    recommendations.push('Use more empathetic language to build connection');
  }
  if (scores.adaptability < 3.5) {
    recommendations.push('End with a discovery question to show flexibility');
  }
  if (scores.persistence < 3.5) {
    recommendations.push('Include specific next steps or timeframe for follow-up');
  }
  
  // Ensure at least one recommendation
  if (recommendations.length === 0) {
    recommendations.push('Continue building on these EI strengths in future interactions');
  }
  
  return recommendations;
}

/**
 * Analyze reply text for EI-relevant patterns
 */
export function analyzeReply(reply: string, userQuestion: string): EIContext {
  // Count questions in reply
  const questionCount = (reply.match(/\?/g) || []).length;
  
  // Count acknowledgment patterns
  const acknowledgmentPatterns = (reply.match(EI_PATTERNS.ACKNOWLEDGMENT) || []).length;
  
  // Count fact references (citations or specific data points)
  const factReferences = (reply.match(EI_PATTERNS.FACT_REFERENCE) || []).length;
  
  // Word count
  const wordCount = reply.split(/\s+/).filter(Boolean).length;
  
  return {
    reply,
    userQuestion,
    questionCount,
    acknowledgmentPatterns,
    factReferences,
    wordCount
  };
}
