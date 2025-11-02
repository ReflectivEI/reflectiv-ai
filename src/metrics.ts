/**
 * Metrics collection for monitoring and observability
 * Tracks counters and histograms without logging PHI/PII
 */

interface MetricsCollector {
  counters: Map<string, number>;
  histograms: Map<string, number[]>;
}

const metrics: MetricsCollector = {
  counters: new Map(),
  histograms: new Map()
};

/**
 * Increment a counter metric
 */
export function incrementCounter(name: string, value: number = 1): void {
  const current = metrics.counters.get(name) || 0;
  metrics.counters.set(name, current + value);
}

/**
 * Record a histogram value
 */
export function recordHistogram(name: string, value: number): void {
  const values = metrics.histograms.get(name) || [];
  values.push(value);
  metrics.histograms.set(name, values);
}

/**
 * Get current metrics snapshot
 */
export function getMetrics(): {
  counters: Record<string, number>;
  histograms: Record<string, { count: number; min: number; max: number; avg: number }>;
} {
  const counterObj: Record<string, number> = {};
  for (const [key, value] of metrics.counters.entries()) {
    counterObj[key] = value;
  }
  
  const histogramObj: Record<string, { count: number; min: number; max: number; avg: number }> = {};
  for (const [key, values] of metrics.histograms.entries()) {
    if (values.length > 0) {
      histogramObj[key] = {
        count: values.length,
        min: Math.min(...values),
        max: Math.max(...values),
        avg: values.reduce((a, b) => a + b, 0) / values.length
      };
    }
  }
  
  return { counters: counterObj, histograms: histogramObj };
}

/**
 * Reset all metrics (useful for testing)
 */
export function resetMetrics(): void {
  metrics.counters.clear();
  metrics.histograms.clear();
}

/**
 * Track chat request metrics
 */
export function trackChatRequest(mode: string, emitEi: boolean, durationMs: number): void {
  incrementCounter('chat_requests_total');
  incrementCounter(`chat_requests_${mode}`);
  
  if (emitEi) {
    incrementCounter('chat_requests_with_ei');
  }
  
  recordHistogram('chat_request_duration_ms', durationMs);
}

/**
 * Track EI computation metrics
 */
export function trackEIComputation(overallScore: number, durationMs: number): void {
  incrementCounter('ei_computations_total');
  recordHistogram('ei_score', overallScore);
  recordHistogram('ei_computation_duration_ms', durationMs);
}

/**
 * Track provider call metrics
 */
export function trackProviderCall(success: boolean, durationMs: number, tokens?: number): void {
  incrementCounter('provider_calls_total');
  
  if (success) {
    incrementCounter('provider_calls_success');
  } else {
    incrementCounter('provider_calls_failure');
  }
  
  recordHistogram('provider_call_duration_ms', durationMs);
  
  if (tokens !== undefined) {
    recordHistogram('provider_tokens', tokens);
  }
}

/**
 * Track coach extraction metrics
 */
export function trackCoachExtraction(hasCoach: boolean, coachValid: boolean): void {
  incrementCounter('coach_extractions_total');
  
  if (hasCoach) {
    incrementCounter('coach_extractions_found');
  }
  
  if (coachValid) {
    incrementCounter('coach_extractions_valid');
  }
}
