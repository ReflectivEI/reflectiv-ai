#!/usr/bin/env node

/**
 * Metrics Test Script
 * Demonstrates EI metrics counters and latency tracking
 */

import { 
  incrementEiEmitted, 
  incrementEiValidationFailed, 
  recordEiLatency, 
  getMetrics 
} from './src/metrics.ts';

console.log('=== EI Metrics Test ===\n');

// Initial state
console.log('Initial metrics:');
console.log(JSON.stringify(getMetrics(), null, 2));
console.log('');

// Simulate successful EI emissions
console.log('Simulating 3 successful EI emissions...');
incrementEiEmitted();
recordEiLatency(25);

incrementEiEmitted();
recordEiLatency(30);

incrementEiEmitted();
recordEiLatency(28);

// Simulate validation failures
console.log('Simulating 1 validation failure...');
incrementEiValidationFailed();

// Get final metrics
console.log('\nFinal metrics:');
const finalMetrics = getMetrics();
console.log(JSON.stringify(finalMetrics, null, 2));

// Calculate stats
const avgLatency = finalMetrics.ei_latency_histogram.reduce((a, b) => a + b, 0) / 
  finalMetrics.ei_latency_histogram.length;

console.log('\n=== Metrics Summary ===');
console.log(`✓ ei_emitted_total: ${finalMetrics.ei_emitted_total}`);
console.log(`✓ ei_validation_failed_total: ${finalMetrics.ei_validation_failed_total}`);
console.log(`✓ Average EI latency: ${avgLatency.toFixed(2)}ms`);
console.log(`✓ Min latency: ${Math.min(...finalMetrics.ei_latency_histogram)}ms`);
console.log(`✓ Max latency: ${Math.max(...finalMetrics.ei_latency_histogram)}ms`);
