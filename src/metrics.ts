/**
 * Metrics for EI feature
 * Counters: ei_emitted_total, ei_validation_failed_total
 * Histogram: ei_latency_ms
 */

interface Metrics {
  ei_emitted_total: number;
  ei_validation_failed_total: number;
  ei_latency_histogram: number[];
}

// In-memory metrics store (per worker instance)
const metrics: Metrics = {
  ei_emitted_total: 0,
  ei_validation_failed_total: 0,
  ei_latency_histogram: []
};

/**
 * Increment the EI emitted counter
 */
export function incrementEiEmitted(): void {
  metrics.ei_emitted_total++;
}

/**
 * Increment the EI validation failed counter
 */
export function incrementEiValidationFailed(): void {
  metrics.ei_validation_failed_total++;
}

/**
 * Record EI scoring latency in milliseconds
 */
export function recordEiLatency(latencyMs: number): void {
  metrics.ei_latency_histogram.push(latencyMs);
  
  // Keep only last 1000 measurements to prevent unbounded growth
  if (metrics.ei_latency_histogram.length > 1000) {
    metrics.ei_latency_histogram.shift();
  }
}

/**
 * Get current metrics snapshot
 */
export function getMetrics(): Readonly<Metrics> {
  return {
    ei_emitted_total: metrics.ei_emitted_total,
    ei_validation_failed_total: metrics.ei_validation_failed_total,
    ei_latency_histogram: [...metrics.ei_latency_histogram]
  };
}

/**
 * Wrap a function with latency tracking
 */
export async function withTiming<T>(
  fn: () => T | Promise<T>
): Promise<{ result: T; latencyMs: number }> {
  const start = Date.now();
  const result = await fn();
  const latencyMs = Date.now() - start;
  
  return { result, latencyMs };
}
