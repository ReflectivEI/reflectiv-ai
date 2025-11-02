/**
 * Configuration management for ReflectivAI Gateway
 */

import type { Config, Env } from './types';

/**
 * Extract configuration from request (query params or headers)
 * Feature flags like emitEi can be controlled per-request
 */
export function fromRequest(req: Request, env: Env): Config {
  const url = new URL(req.url);
  
  // Check query parameter ?emitEi=true
  const queryEmitEi = url.searchParams.get('emitEi');
  
  // Check header X-Emit-EI: true
  const headerEmitEi = req.headers.get('X-Emit-EI');
  
  // Default to false unless explicitly enabled
  const emitEi = queryEmitEi === 'true' || headerEmitEi === 'true';
  
  return {
    emitEi
  };
}

/**
 * Get default configuration
 */
export function getDefaultConfig(): Config {
  return {
    emitEi: false
  };
}
